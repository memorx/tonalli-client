import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    activityLog: {
      create: createMock,
    },
  },
}))

import { logActivity, logAuditEvent } from '@/lib/activity-log'

describe('logActivity (legacy helper)', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  it('persists the action with userId, projectId, details', async () => {
    createMock.mockResolvedValueOnce({ id: 'log-1' })

    await logActivity({
      userId: 'u1',
      action: 'PROJECT_CREATED',
      projectId: 'p1',
      details: { foo: 'bar' },
    })

    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        action: 'PROJECT_CREATED',
        projectId: 'p1',
        details: { foo: 'bar' },
      },
    })
  })
})

describe('logAuditEvent', () => {
  beforeEach(() => {
    createMock.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('persists with metadata from caller', async () => {
    createMock.mockResolvedValueOnce({ id: 'log-1' })

    await logAuditEvent({
      userId: 'u1',
      action: 'APPROVAL_VIEWED',
      projectId: 'p1',
      metadata: { approvalId: 'a1' },
    })

    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        action: 'APPROVAL_VIEWED',
        projectId: 'p1',
        details: { approvalId: 'a1' },
      },
    })
  })

  it('extracts IP from x-forwarded-for (first value)', async () => {
    createMock.mockResolvedValueOnce({ id: 'log-1' })

    const req = new Request('http://localhost/', {
      headers: {
        'x-forwarded-for': '203.0.113.42, 198.51.100.1, 192.0.2.7',
        'user-agent': 'Mozilla/5.0 (Test)',
      },
    })

    await logAuditEvent({ userId: 'u1', action: 'LOGIN_SUCCESS', request: req })

    const callArg = createMock.mock.calls[0][0]
    expect(callArg.data.details).toMatchObject({
      ip: '203.0.113.42',
      userAgent: 'Mozilla/5.0 (Test)',
    })
  })

  it('falls back to x-real-ip when x-forwarded-for is missing', async () => {
    createMock.mockResolvedValueOnce({ id: 'log-1' })

    const req = new Request('http://localhost/', {
      headers: { 'x-real-ip': '203.0.113.99' },
    })

    await logAuditEvent({ userId: 'u1', action: 'LOGIN_SUCCESS', request: req })

    const callArg = createMock.mock.calls[0][0]
    expect(callArg.data.details.ip).toBe('203.0.113.99')
  })

  it('sets ip and userAgent to null when neither header is present', async () => {
    createMock.mockResolvedValueOnce({ id: 'log-1' })

    const req = new Request('http://localhost/')
    await logAuditEvent({ userId: 'u1', action: 'LOGIN_SUCCESS', request: req })

    const callArg = createMock.mock.calls[0][0]
    expect(callArg.data.details.ip).toBeNull()
    expect(callArg.data.details.userAgent).toBeNull()
  })

  it('merges caller metadata with request-derived metadata', async () => {
    createMock.mockResolvedValueOnce({ id: 'log-1' })

    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '203.0.113.42' },
    })

    await logAuditEvent({
      userId: 'u1',
      action: 'APPROVAL_APPROVED',
      request: req,
      metadata: { approvalId: 'a1', status: 'APPROVED' },
    })

    const details = createMock.mock.calls[0][0].data.details
    expect(details).toMatchObject({
      approvalId: 'a1',
      status: 'APPROVED',
      ip: '203.0.113.42',
    })
  })

  it('NEVER throws when persistence fails — logs and returns', async () => {
    createMock.mockRejectedValueOnce(new Error('DB down'))

    await expect(
      logAuditEvent({ userId: 'u1', action: 'LOGIN_FAILED' }),
    ).resolves.toBeUndefined()

    expect(console.error).toHaveBeenCalled()
  })

  it('works without request and without metadata', async () => {
    createMock.mockResolvedValueOnce({ id: 'log-1' })

    await logAuditEvent({ userId: 'u1', action: 'BRAND_VIEWED' })

    expect(createMock).toHaveBeenCalledOnce()
    const details = createMock.mock.calls[0][0].data.details
    expect(details).toEqual({})
  })
})
