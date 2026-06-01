'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'

// ══════════════════════════════════════════════
// Event payload shapes (mirror Prisma rows for the 3 watched tables)
// ══════════════════════════════════════════════

export interface ApprovalEvent {
  id: string
  projectId: string
  fileVersionId: string | null
  status: string
  reviewerId: string | null
  createdAt: string
}

export interface ProjectEvent {
  id: string
  clientId: string
  status: string
  updatedAt: string
}

export interface ActivityLogEvent {
  id: string
  projectId: string | null
  action: string
  createdAt: string
}

// ══════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════

export interface UseClientRealtimeOptions {
  enabled: boolean
  clientId: string
  /**
   * Project IDs owned by the current client. Used to filter Approval and
   * ActivityLog events in-memory (those tables don't have clientId directly).
   */
  projectIds: string[]
  onApproval?: (approval: ApprovalEvent) => void
  onProject?: (project: ProjectEvent) => void
  onActivityLog?: (log: ActivityLogEvent) => void
}

export interface UseClientRealtimeResult {
  isConnected: boolean
}

export function useClientRealtime({
  enabled,
  clientId,
  projectIds,
  onApproval,
  onProject,
  onActivityLog,
}: UseClientRealtimeOptions): UseClientRealtimeResult {
  const [isConnected, setIsConnected] = useState(false)

  // Keep callbacks in refs so changing them doesn't re-subscribe
  const onApprovalRef = useRef(onApproval)
  const onProjectRef = useRef(onProject)
  const onActivityLogRef = useRef(onActivityLog)
  useEffect(() => {
    onApprovalRef.current = onApproval
    onProjectRef.current = onProject
    onActivityLogRef.current = onActivityLog
  })

  // Keep projectIds in a ref Set so the in-memory filter doesn't re-subscribe
  // when the list of projects changes (e.g. user opens a new project page)
  const projectIdsRef = useRef(new Set(projectIds))
  useEffect(() => {
    projectIdsRef.current = new Set(projectIds)
  }, [projectIds])

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false)
      return
    }
    if (!supabase) {
      setIsConnected(false)
      return
    }

    let approvalReady = false
    let projectReady = false
    let activityReady = false
    const updateConnected = () =>
      setIsConnected(approvalReady && projectReady && activityReady)

    // ── Approval INSERT (filter in-memory by projectId) ──────────
    const approvalChannel: RealtimeChannel = supabase
      .channel(`client:${clientId}:approvals`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'Approval' },
        (payload: { new: ApprovalEvent }) => {
          const a = payload.new
          if (!a?.projectId) return
          if (!projectIdsRef.current.has(a.projectId)) return
          onApprovalRef.current?.(a)
        },
      )
      .subscribe((status) => {
        approvalReady = status === 'SUBSCRIBED'
        updateConnected()
      })

    // ── Project UPDATE (server-side filter by clientId) ─────────
    const projectChannel: RealtimeChannel = supabase
      .channel(`client:${clientId}:projects`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Project',
          filter: `clientId=eq.${clientId}`,
        },
        (payload: { new: ProjectEvent }) => {
          onProjectRef.current?.(payload.new)
        },
      )
      .subscribe((status) => {
        projectReady = status === 'SUBSCRIBED'
        updateConnected()
      })

    // ── ActivityLog INSERT (filter in-memory by projectId) ──────
    const activityChannel: RealtimeChannel = supabase
      .channel(`client:${clientId}:activity`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'ActivityLog' },
        (payload: { new: ActivityLogEvent }) => {
          const log = payload.new
          if (!log?.projectId) return
          if (!projectIdsRef.current.has(log.projectId)) return
          onActivityLogRef.current?.(log)
        },
      )
      .subscribe((status) => {
        activityReady = status === 'SUBSCRIBED'
        updateConnected()
      })

    return () => {
      void supabase!.removeChannel(approvalChannel)
      void supabase!.removeChannel(projectChannel)
      void supabase!.removeChannel(activityChannel)
      setIsConnected(false)
    }
  }, [enabled, clientId])

  return { isConnected }
}
