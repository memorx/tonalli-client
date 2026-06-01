import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { POST } from '@/app/api/integrations/frame-io/webhook/route'

const SECRET = 'test-webhook-secret'

function sign(body: string, ts: string, secret: string = SECRET): string {
  const hex = createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex')
  return `v0=${hex}`
}

function makeReq(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/integrations/frame-io/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

describe('POST /api/integrations/frame-io/webhook', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns 503 when FRAME_IO_WEBHOOK_SECRET is not configured', async () => {
    vi.stubEnv('FRAME_IO_WEBHOOK_SECRET', '')
    const res = await POST(makeReq('{}'))
    expect(res.status).toBe(503)
  })

  it('returns 403 when signature is invalid', async () => {
    vi.stubEnv('FRAME_IO_WEBHOOK_SECRET', SECRET)
    const body = JSON.stringify({ type: 'asset.ready' })
    const res = await POST(
      makeReq(body, {
        'x-frameio-signature': 'v0=deadbeef'.padEnd(67, '0'), // wrong length-correct but wrong digest
        'x-frameio-request-timestamp': '1717172000',
      }),
    )
    expect(res.status).toBe(403)
  })

  it('returns 403 when signature header is missing', async () => {
    vi.stubEnv('FRAME_IO_WEBHOOK_SECRET', SECRET)
    const res = await POST(makeReq('{}', { 'x-frameio-request-timestamp': '1717172000' }))
    expect(res.status).toBe(403)
  })

  it('returns 200 when signature is valid + handled event', async () => {
    vi.stubEnv('FRAME_IO_WEBHOOK_SECRET', SECRET)
    const ts = '1717172000'
    const body = JSON.stringify({ type: 'asset.ready', resource: { id: 'a1' } })
    const res = await POST(
      makeReq(body, {
        'x-frameio-signature': sign(body, ts),
        'x-frameio-request-timestamp': ts,
      }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ received: true })
  })

  it('returns 200 for unknown event type (still ack to avoid retries)', async () => {
    vi.stubEnv('FRAME_IO_WEBHOOK_SECRET', SECRET)
    const ts = '1717172000'
    const body = JSON.stringify({ type: 'project.created', resource: { id: 'p1' } })
    const res = await POST(
      makeReq(body, {
        'x-frameio-signature': sign(body, ts),
        'x-frameio-request-timestamp': ts,
      }),
    )
    expect(res.status).toBe(200)
  })

  it('returns 500 on invalid JSON body (so Frame.io retries)', async () => {
    vi.stubEnv('FRAME_IO_WEBHOOK_SECRET', SECRET)
    const ts = '1717172000'
    const body = 'not-json'
    const res = await POST(
      makeReq(body, {
        'x-frameio-signature': sign(body, ts),
        'x-frameio-request-timestamp': ts,
      }),
    )
    expect(res.status).toBe(500)
  })

  it('handles comment.created event', async () => {
    vi.stubEnv('FRAME_IO_WEBHOOK_SECRET', SECRET)
    const ts = '1717172000'
    const body = JSON.stringify({ type: 'comment.created', resource: { id: 'c1', type: 'comment' } })
    const res = await POST(
      makeReq(body, {
        'x-frameio-signature': sign(body, ts),
        'x-frameio-request-timestamp': ts,
      }),
    )
    expect(res.status).toBe(200)
  })
})
