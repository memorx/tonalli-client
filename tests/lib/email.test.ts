import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.hoisted ensures `sendMock` and `capturedApiKeys` are initialized before
// vi.mock runs (which is itself hoisted to top by vitest).
const { sendMock, capturedApiKeys } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  capturedApiKeys: [] as string[],
}))

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: sendMock }
    constructor(apiKey: string) {
      capturedApiKeys.push(apiKey)
    }
  },
}))

import { sendEmail } from '@/lib/email'

describe('sendEmail', () => {
  beforeEach(() => {
    sendMock.mockReset()
    capturedApiKeys.length = 0
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns false (and never throws) when RESEND_API_KEY is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')

    const result = await sendEmail({
      to: 'cliente@example.com',
      subject: 'Hola',
      html: '<p>x</p>',
    })

    expect(result).toBe(false)
    expect(capturedApiKeys).toEqual([])
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('returns true on successful send', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('EMAIL_FROM', 'Test <test@example.com>')
    sendMock.mockResolvedValueOnce({ data: { id: 'abc' }, error: null })

    const result = await sendEmail({
      to: 'cliente@example.com',
      subject: 'Hola',
      html: '<p>x</p>',
    })

    expect(result).toBe(true)
    expect(capturedApiKeys).toEqual(['test-key'])
    expect(sendMock).toHaveBeenCalledWith({
      from: 'Test <test@example.com>',
      to: 'cliente@example.com',
      subject: 'Hola',
      html: '<p>x</p>',
    })
  })

  it('uses default EMAIL_FROM when not set', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('EMAIL_FROM', '')
    sendMock.mockResolvedValueOnce({ data: { id: 'abc' }, error: null })

    await sendEmail({ to: 'a@b.com', subject: 's', html: 'h' })

    expect(sendMock.mock.calls[0][0].from).toBe('Bureau Tonalli <notifications@bureautonalli.com>')
  })

  it('returns false when Resend returns an error (does not throw)', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'rate limit' } })

    const result = await sendEmail({ to: 'a@b.com', subject: 's', html: 'h' })

    expect(result).toBe(false)
  })

  it('returns false when Resend throws (does not propagate)', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    sendMock.mockRejectedValueOnce(new Error('network down'))

    const result = await sendEmail({ to: 'a@b.com', subject: 's', html: 'h' })

    expect(result).toBe(false)
  })
})
