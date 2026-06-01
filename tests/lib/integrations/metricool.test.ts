import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listBrands,
  getInstagramStats,
  getTwitterStats,
  formatMetricoolDate,
} from '@/lib/integrations/metricool'

describe('formatMetricoolDate', () => {
  it('formats a Date as YYYYMMDD (UTC)', () => {
    expect(formatMetricoolDate(new Date('2026-06-01T12:34:56Z'))).toBe('20260601')
  })

  it('accepts ISO strings', () => {
    expect(formatMetricoolDate('2026-01-09T00:00:00Z')).toBe('20260109')
  })

  it('throws on invalid dates', () => {
    expect(() => formatMetricoolDate('not-a-date')).toThrow(/Invalid date/)
  })
})

describe('metricool adapter', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchSpy = vi.spyOn(globalThis, 'fetch') as any
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('listBrands', () => {
    it('returns [] without env vars and does NOT fetch', async () => {
      vi.stubEnv('METRICOOL_API_KEY', '')
      vi.stubEnv('METRICOOL_USER_ID', '')

      const brands = await listBrands()

      expect(brands).toEqual([])
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('returns [] when only one env var is set', async () => {
      vi.stubEnv('METRICOOL_API_KEY', 'key')
      vi.stubEnv('METRICOOL_USER_ID', '')

      expect(await listBrands()).toEqual([])
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('sends userToken + userId as query params', async () => {
      vi.stubEnv('METRICOOL_API_KEY', 'tok-xyz')
      vi.stubEnv('METRICOOL_USER_ID', '42')
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 1, label: 'Givenchy', url: null, timezone: 'Europe/Paris' }]), {
          status: 200,
        }),
      )

      const brands = await listBrands()

      expect(brands).toHaveLength(1)
      const url = new URL(fetchSpy.mock.calls[0][0] as string)
      expect(url.pathname).toBe('/api/admin/simpleProfiles')
      expect(url.searchParams.get('userToken')).toBe('tok-xyz')
      expect(url.searchParams.get('userId')).toBe('42')
    })

    it('returns [] on non-array response', async () => {
      vi.stubEnv('METRICOOL_API_KEY', 'tok')
      vi.stubEnv('METRICOOL_USER_ID', '1')
      fetchSpy.mockResolvedValueOnce(new Response('{"error":"x"}', { status: 200 }))

      expect(await listBrands()).toEqual([])
    })

    it('returns [] on 429 rate-limit', async () => {
      vi.stubEnv('METRICOOL_API_KEY', 'tok')
      vi.stubEnv('METRICOOL_USER_ID', '1')
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 429 }))

      expect(await listBrands()).toEqual([])
    })

    it('returns [] on network error (no throw)', async () => {
      vi.stubEnv('METRICOOL_API_KEY', 'tok')
      vi.stubEnv('METRICOOL_USER_ID', '1')
      fetchSpy.mockRejectedValueOnce(new Error('network down'))

      expect(await listBrands()).toEqual([])
    })
  })

  describe('getInstagramStats', () => {
    it('returns [] without env vars', async () => {
      vi.stubEnv('METRICOOL_API_KEY', '')
      vi.stubEnv('METRICOOL_USER_ID', '')

      const stats = await getInstagramStats({ blogId: 1, start: '2026-06-01', end: '2026-06-30' })

      expect(stats).toEqual([])
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('formats dates as YYYYMMDD and includes blogId', async () => {
      vi.stubEnv('METRICOOL_API_KEY', 'tok')
      vi.stubEnv('METRICOOL_USER_ID', '42')
      fetchSpy.mockResolvedValueOnce(new Response('[]', { status: 200 }))

      await getInstagramStats({
        blogId: 99,
        start: new Date('2026-06-01T00:00:00Z'),
        end: new Date('2026-06-30T23:59:59Z'),
      })

      const url = new URL(fetchSpy.mock.calls[0][0] as string)
      expect(url.pathname).toBe('/api/stats/instagram')
      expect(url.searchParams.get('blogId')).toBe('99')
      expect(url.searchParams.get('start')).toBe('20260601')
      expect(url.searchParams.get('end')).toBe('20260630')
    })

    it('returns parsed array on 200', async () => {
      vi.stubEnv('METRICOOL_API_KEY', 'tok')
      vi.stubEnv('METRICOOL_USER_ID', '1')
      const fake = [
        { date: '20260601', followers: 1234, posts: 2, reach: null, engagement: 56 },
      ]
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(fake), { status: 200 }))

      const stats = await getInstagramStats({ blogId: 1, start: '2026-06-01', end: '2026-06-30' })

      expect(stats).toEqual(fake)
    })

    it('returns [] on invalid JSON', async () => {
      vi.stubEnv('METRICOOL_API_KEY', 'tok')
      vi.stubEnv('METRICOOL_USER_ID', '1')
      fetchSpy.mockResolvedValueOnce(new Response('not json', { status: 200 }))

      expect(await getInstagramStats({ blogId: 1, start: '2026-06-01', end: '2026-06-30' })).toEqual([])
    })
  })

  describe('getTwitterStats', () => {
    it('hits /stats/twitter with right params', async () => {
      vi.stubEnv('METRICOOL_API_KEY', 'tok')
      vi.stubEnv('METRICOOL_USER_ID', '7')
      fetchSpy.mockResolvedValueOnce(new Response('[]', { status: 200 }))

      await getTwitterStats({ blogId: 'abc', start: '2026-06-01', end: '2026-06-07' })

      const url = new URL(fetchSpy.mock.calls[0][0] as string)
      expect(url.pathname).toBe('/api/stats/twitter')
      expect(url.searchParams.get('blogId')).toBe('abc')
      expect(url.searchParams.get('userToken')).toBe('tok')
      expect(url.searchParams.get('userId')).toBe('7')
    })

    it('returns [] on 404', async () => {
      vi.stubEnv('METRICOOL_API_KEY', 'tok')
      vi.stubEnv('METRICOOL_USER_ID', '1')
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 404 }))

      expect(await getTwitterStats({ blogId: 1, start: '2026-06-01', end: '2026-06-30' })).toEqual([])
    })
  })
})
