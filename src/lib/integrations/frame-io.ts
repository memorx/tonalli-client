import { createHmac, timingSafeEqual } from 'node:crypto'

// ══════════════════════════════════════════════
// API client (Frame.io v2 — stable for Personal Token auth)
// ══════════════════════════════════════════════

const API_BASE = 'https://api.frame.io/v2'

export interface FrameIoAsset {
  id: string
  name: string
  type: string
  filesize: number | null
  description: string | null
  properties: Record<string, unknown> | null
  view_count: number | null
  created_at: string
  updated_at: string
}

export interface FrameIoComment {
  id: string
  text: string
  author: { id: string; name: string | null } | null
  timestamp: number | null
  created_at: string
}

interface RequestOptions {
  signal?: AbortSignal
}

async function frameIoFetch(path: string, options: RequestOptions = {}): Promise<Response | null> {
  const token = process.env.FRAME_IO_TOKEN
  if (!token) {
    console.warn('[frame-io] FRAME_IO_TOKEN not configured, skipping', { path })
    return null
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: options.signal,
    })

    if (res.status === 429) {
      console.warn('[frame-io] rate limited (429)', { path })
      return null
    }

    return res
  } catch (err) {
    console.error('[frame-io] fetch failed', { path, err })
    return null
  }
}

/**
 * Fetch a single asset by id. Returns null when not configured, 404, or any
 * unexpected error — caller should treat null as "asset not available now".
 */
export async function getAsset(
  assetId: string,
  options: RequestOptions = {},
): Promise<FrameIoAsset | null> {
  const res = await frameIoFetch(`/assets/${encodeURIComponent(assetId)}`, options)
  if (!res || !res.ok) return null

  try {
    return (await res.json()) as FrameIoAsset
  } catch (err) {
    console.error('[frame-io] getAsset: invalid JSON', { assetId, err })
    return null
  }
}

/**
 * List comments on an asset. Returns [] when not configured or on any error.
 */
export async function listAssetComments(
  assetId: string,
  options: RequestOptions = {},
): Promise<FrameIoComment[]> {
  const res = await frameIoFetch(
    `/assets/${encodeURIComponent(assetId)}/comments`,
    options,
  )
  if (!res || !res.ok) return []

  try {
    const data = await res.json()
    return Array.isArray(data) ? (data as FrameIoComment[]) : []
  } catch (err) {
    console.error('[frame-io] listAssetComments: invalid JSON', { assetId, err })
    return []
  }
}

// ══════════════════════════════════════════════
// Webhook signature verification
// ══════════════════════════════════════════════
//
// Frame.io webhook signature scheme:
//   - Header X-Frameio-Signature:        "v0=<hex>"
//   - Header X-Frameio-Request-Timestamp: "<unix>"
//   - HMAC-SHA256(secret, "v0:<timestamp>:<rawBody>")
//
// Always compare with `timingSafeEqual` to avoid timing attacks. Reject if the
// secret is missing or the signature header is malformed.

export interface VerifySignatureParams {
  signature: string | null
  timestamp: string | null
  body: string
  secret: string
}

export function verifyFrameIoSignature({
  signature,
  timestamp,
  body,
  secret,
}: VerifySignatureParams): boolean {
  if (!signature || !timestamp || !secret) return false

  // Header looks like "v0=<hex>"
  const match = /^v0=([a-f0-9]+)$/i.exec(signature)
  if (!match) return false
  const received = match[1]

  const expected = createHmac('sha256', secret)
    .update(`v0:${timestamp}:${body}`)
    .digest('hex')

  // Length-mismatched buffers throw on timingSafeEqual — guard first
  if (received.length !== expected.length) return false

  return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
}
