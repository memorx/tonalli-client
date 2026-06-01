import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  getAsset,
  listAssetComments,
  verifyFrameIoSignature,
} from '@/lib/integrations/frame-io'

describe('frame-io adapter', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Silence expected warn/error logs from the adapter
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchSpy = vi.spyOn(globalThis, 'fetch') as any
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('getAsset', () => {
    it('returns null and does NOT fetch when FRAME_IO_TOKEN is missing', async () => {
      vi.stubEnv('FRAME_IO_TOKEN', '')

      const asset = await getAsset('abc')

      expect(asset).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('sends Bearer header and parses successful response', async () => {
      vi.stubEnv('FRAME_IO_TOKEN', 'token-xyz')
      const fakeAsset = { id: 'a1', name: 'shot.mp4', type: 'file' }
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(fakeAsset), { status: 200 }),
      )

      const asset = await getAsset('a1')

      expect(asset?.id).toBe('a1')
      expect(asset?.name).toBe('shot.mp4')
      const call = fetchSpy.mock.calls[0]
      expect(call[0]).toBe('https://api.frame.io/v2/assets/a1')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headers = (call[1] as any).headers
      expect(headers.Authorization).toBe('Bearer token-xyz')
      expect(headers.Accept).toBe('application/json')
    })

    it('URL-encodes the asset id', async () => {
      vi.stubEnv('FRAME_IO_TOKEN', 'token-xyz')
      fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 200 }))

      await getAsset('a b/c')

      expect(fetchSpy.mock.calls[0][0]).toBe('https://api.frame.io/v2/assets/a%20b%2Fc')
    })

    it('returns null on 404 (no throw)', async () => {
      vi.stubEnv('FRAME_IO_TOKEN', 'token-xyz')
      fetchSpy.mockResolvedValueOnce(new Response('not found', { status: 404 }))

      const asset = await getAsset('missing')

      expect(asset).toBeNull()
    })

    it('returns null on 429 rate limit', async () => {
      vi.stubEnv('FRAME_IO_TOKEN', 'token-xyz')
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 429 }))

      const asset = await getAsset('a1')

      expect(asset).toBeNull()
    })

    it('returns null on fetch throwing (network error)', async () => {
      vi.stubEnv('FRAME_IO_TOKEN', 'token-xyz')
      fetchSpy.mockRejectedValueOnce(new Error('network down'))

      const asset = await getAsset('a1')

      expect(asset).toBeNull()
    })

    it('returns null on invalid JSON in response', async () => {
      vi.stubEnv('FRAME_IO_TOKEN', 'token-xyz')
      fetchSpy.mockResolvedValueOnce(new Response('not json', { status: 200 }))

      const asset = await getAsset('a1')

      expect(asset).toBeNull()
    })
  })

  describe('listAssetComments', () => {
    it('returns [] without token', async () => {
      vi.stubEnv('FRAME_IO_TOKEN', '')
      const comments = await listAssetComments('a1')
      expect(comments).toEqual([])
    })

    it('returns array on success', async () => {
      vi.stubEnv('FRAME_IO_TOKEN', 'token-xyz')
      const fake = [
        { id: 'c1', text: 'hi', author: null, timestamp: null, created_at: 'now' },
      ]
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(fake), { status: 200 }))

      const comments = await listAssetComments('a1')

      expect(comments).toHaveLength(1)
      expect(comments[0].id).toBe('c1')
    })

    it('returns [] when response is not an array', async () => {
      vi.stubEnv('FRAME_IO_TOKEN', 'token-xyz')
      fetchSpy.mockResolvedValueOnce(new Response('{"error":"x"}', { status: 200 }))

      const comments = await listAssetComments('a1')

      expect(comments).toEqual([])
    })
  })
})

describe('verifyFrameIoSignature', () => {
  const SECRET = 'webhook-secret-shhh'
  const BODY = '{"type":"asset.ready","resource":{"id":"a1"}}'
  const TS = '1717172000'

  function sign(body: string, ts: string, secret: string): string {
    const hex = createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex')
    return `v0=${hex}`
  }

  it('accepts a valid signature', () => {
    const ok = verifyFrameIoSignature({
      signature: sign(BODY, TS, SECRET),
      timestamp: TS,
      body: BODY,
      secret: SECRET,
    })
    expect(ok).toBe(true)
  })

  it('rejects when secret is missing', () => {
    const ok = verifyFrameIoSignature({
      signature: sign(BODY, TS, SECRET),
      timestamp: TS,
      body: BODY,
      secret: '',
    })
    expect(ok).toBe(false)
  })

  it('rejects when signature header is missing', () => {
    const ok = verifyFrameIoSignature({
      signature: null,
      timestamp: TS,
      body: BODY,
      secret: SECRET,
    })
    expect(ok).toBe(false)
  })

  it('rejects when timestamp header is missing', () => {
    const ok = verifyFrameIoSignature({
      signature: sign(BODY, TS, SECRET),
      timestamp: null,
      body: BODY,
      secret: SECRET,
    })
    expect(ok).toBe(false)
  })

  it('rejects malformed signature format (missing v0= prefix)', () => {
    const hex = createHmac('sha256', SECRET).update(`v0:${TS}:${BODY}`).digest('hex')
    const ok = verifyFrameIoSignature({
      signature: hex, // no "v0=" prefix
      timestamp: TS,
      body: BODY,
      secret: SECRET,
    })
    expect(ok).toBe(false)
  })

  it('rejects when body is tampered', () => {
    const validSig = sign(BODY, TS, SECRET)
    const ok = verifyFrameIoSignature({
      signature: validSig,
      timestamp: TS,
      body: BODY + 'tampered',
      secret: SECRET,
    })
    expect(ok).toBe(false)
  })

  it('rejects when wrong secret', () => {
    const ok = verifyFrameIoSignature({
      signature: sign(BODY, TS, SECRET),
      timestamp: TS,
      body: BODY,
      secret: 'wrong-secret',
    })
    expect(ok).toBe(false)
  })

  it('rejects when signature hex length is mismatched', () => {
    const ok = verifyFrameIoSignature({
      signature: 'v0=abc', // too short to be a sha256 hex
      timestamp: TS,
      body: BODY,
      secret: SECRET,
    })
    expect(ok).toBe(false)
  })
})
