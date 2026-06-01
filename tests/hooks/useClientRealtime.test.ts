// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// vi.hoisted so these mocks are initialized before vi.mock runs (hoisted to top)
const { channelMock, onMock, subscribeMock, removeChannelMock, capturedHandlers } = vi.hoisted(() => {
  const capturedHandlers: Array<(payload: unknown) => void> = []
  const subscribeMock = vi.fn((cb?: (status: string) => void) => {
    cb?.('SUBSCRIBED')
    return { /* a channel-like return */ }
  })
  const onMock = vi.fn(function (
    this: { on: typeof onMock; subscribe: typeof subscribeMock },
    _event: string,
    _config: unknown,
    handler: (payload: unknown) => void,
  ) {
    capturedHandlers.push(handler)
    return this
  })
  const channelMock = vi.fn(() => ({
    on: onMock,
    subscribe: subscribeMock,
  }))
  const removeChannelMock = vi.fn()
  return { channelMock, onMock, subscribeMock, removeChannelMock, capturedHandlers }
})

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    channel: channelMock,
    removeChannel: removeChannelMock,
  },
}))

import { useClientRealtime } from '@/hooks/useClientRealtime'

describe('useClientRealtime', () => {
  beforeEach(() => {
    channelMock.mockClear()
    onMock.mockClear()
    subscribeMock.mockClear()
    removeChannelMock.mockClear()
    capturedHandlers.length = 0
  })

  it('does NOT subscribe when enabled=false', () => {
    renderHook(() =>
      useClientRealtime({
        enabled: false,
        clientId: 'c1',
        projectIds: ['p1'],
      }),
    )
    expect(channelMock).not.toHaveBeenCalled()
  })

  it('subscribes to 3 channels when enabled=true', () => {
    renderHook(() =>
      useClientRealtime({
        enabled: true,
        clientId: 'c1',
        projectIds: ['p1'],
      }),
    )
    expect(channelMock).toHaveBeenCalledTimes(3)
    expect(channelMock).toHaveBeenNthCalledWith(1, 'client:c1:approvals')
    expect(channelMock).toHaveBeenNthCalledWith(2, 'client:c1:projects')
    expect(channelMock).toHaveBeenNthCalledWith(3, 'client:c1:activity')
  })

  it('subscribes Project channel with server-side clientId filter', () => {
    renderHook(() =>
      useClientRealtime({
        enabled: true,
        clientId: 'c1',
        projectIds: ['p1'],
      }),
    )
    // onMock was called once per channel — Project is the 2nd call
    const projectConfig = onMock.mock.calls[1][1] as { filter?: string }
    expect(projectConfig.filter).toBe('clientId=eq.c1')
  })

  it('removes all 3 channels on unmount (cleanup)', () => {
    const { unmount } = renderHook(() =>
      useClientRealtime({
        enabled: true,
        clientId: 'c1',
        projectIds: ['p1'],
      }),
    )
    expect(removeChannelMock).not.toHaveBeenCalled()
    unmount()
    expect(removeChannelMock).toHaveBeenCalledTimes(3)
  })

  it('onApproval fires only when payload.projectId is in projectIds', () => {
    const onApproval = vi.fn()
    renderHook(() =>
      useClientRealtime({
        enabled: true,
        clientId: 'c1',
        projectIds: ['p1', 'p2'],
        onApproval,
      }),
    )

    const approvalHandler = capturedHandlers[0]

    approvalHandler({
      new: {
        id: 'a1',
        projectId: 'p1',
        status: 'PENDING',
        fileVersionId: null,
        reviewerId: null,
        createdAt: 'now',
      },
    })
    expect(onApproval).toHaveBeenCalledTimes(1)

    approvalHandler({
      new: {
        id: 'a2',
        projectId: 'p99',
        status: 'PENDING',
        fileVersionId: null,
        reviewerId: null,
        createdAt: 'now',
      },
    })
    // Still 1 — second event was filtered out
    expect(onApproval).toHaveBeenCalledTimes(1)
  })

  it('onActivityLog fires only when payload.projectId is in projectIds', () => {
    const onActivityLog = vi.fn()
    renderHook(() =>
      useClientRealtime({
        enabled: true,
        clientId: 'c1',
        projectIds: ['p1'],
        onActivityLog,
      }),
    )

    const activityHandler = capturedHandlers[2] // 3rd channel = activity

    activityHandler({ new: { id: 'l1', projectId: 'p1', action: 'FILE_UPLOADED', createdAt: 'now' } })
    expect(onActivityLog).toHaveBeenCalledTimes(1)

    activityHandler({ new: { id: 'l2', projectId: 'p99', action: 'FILE_UPLOADED', createdAt: 'now' } })
    expect(onActivityLog).toHaveBeenCalledTimes(1)
  })

  it('onProject fires for every event on the project channel (server-side filtered)', () => {
    const onProject = vi.fn()
    renderHook(() =>
      useClientRealtime({
        enabled: true,
        clientId: 'c1',
        projectIds: ['p1'],
        onProject,
      }),
    )

    const projectHandler = capturedHandlers[1]

    projectHandler({ new: { id: 'p1', clientId: 'c1', status: 'IN_PRODUCTION', updatedAt: 'now' } })
    expect(onProject).toHaveBeenCalledTimes(1)
  })
})
