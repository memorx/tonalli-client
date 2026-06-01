// Metricool API client (read-only). Pull-only — no webhooks supported.
// Auth scheme: `userToken` + `userId` as query params (legacy, but stable).
// Base: https://app.metricool.com/api
// Docs: https://docs.metricool.com/api

const API_BASE = 'https://app.metricool.com/api'

// ══════════════════════════════════════════════
// Types (loose — Metricool returns many fields, we keep what we use)
// ══════════════════════════════════════════════

export interface MetricoolBrand {
  id: number
  label: string
  url: string | null
  timezone: string | null
}

export interface MetricoolDailyStat {
  date: string
  followers: number | null
  posts: number | null
  reach: number | null
  engagement: number | null
  /** Network-specific extras kept opaque */
  [key: string]: unknown
}

// ══════════════════════════════════════════════
// Internal fetch helper
// ══════════════════════════════════════════════

interface AuthQuery {
  userToken: string
  userId: string
}

function getAuth(): AuthQuery | null {
  const userToken = process.env.METRICOOL_API_KEY
  const userId = process.env.METRICOOL_USER_ID
  if (!userToken || !userId) {
    console.warn('[metricool] METRICOOL_API_KEY or METRICOOL_USER_ID not configured, skipping')
    return null
  }
  return { userToken, userId }
}

/** Metricool wants dates as YYYYMMDD (no separators) */
export function formatMetricoolDate(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date for Metricool: ${String(input)}`)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

async function metricoolFetch(path: string, params: Record<string, string>): Promise<Response | null> {
  const auth = getAuth()
  if (!auth) return null

  const url = new URL(`${API_BASE}${path}`)
  for (const [k, v] of Object.entries({ ...auth, ...params })) {
    url.searchParams.set(k, v)
  }

  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
    if (res.status === 429) {
      console.warn('[metricool] rate limited (429)', { path })
      return null
    }
    return res
  } catch (err) {
    console.error('[metricool] fetch failed', { path, err })
    return null
  }
}

async function parseJson<T>(res: Response | null, context: string): Promise<T | null> {
  if (!res || !res.ok) return null
  try {
    return (await res.json()) as T
  } catch (err) {
    console.error(`[metricool] ${context}: invalid JSON`, { err })
    return null
  }
}

// ══════════════════════════════════════════════
// Public methods
// ══════════════════════════════════════════════

/** Lists the brands ("blogs") accessible to the configured userId. */
export async function listBrands(): Promise<MetricoolBrand[]> {
  const res = await metricoolFetch('/admin/simpleProfiles', {})
  const data = await parseJson<MetricoolBrand[]>(res, 'listBrands')
  return Array.isArray(data) ? data : []
}

interface StatsParams {
  blogId: string | number
  start: Date | string
  end: Date | string
}

export async function getInstagramStats({
  blogId,
  start,
  end,
}: StatsParams): Promise<MetricoolDailyStat[]> {
  const res = await metricoolFetch('/stats/instagram', {
    blogId: String(blogId),
    start: formatMetricoolDate(start),
    end: formatMetricoolDate(end),
  })
  const data = await parseJson<MetricoolDailyStat[]>(res, 'getInstagramStats')
  return Array.isArray(data) ? data : []
}

export async function getTwitterStats({
  blogId,
  start,
  end,
}: StatsParams): Promise<MetricoolDailyStat[]> {
  const res = await metricoolFetch('/stats/twitter', {
    blogId: String(blogId),
    start: formatMetricoolDate(start),
    end: formatMetricoolDate(end),
  })
  const data = await parseJson<MetricoolDailyStat[]>(res, 'getTwitterStats')
  return Array.isArray(data) ? data : []
}
