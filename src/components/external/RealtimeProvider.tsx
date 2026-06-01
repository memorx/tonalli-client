'use client'

import { useRouter } from 'next/navigation'
import { useClientRealtime } from '@/hooks/useClientRealtime'

interface RealtimeProviderProps {
  clientId: string
  projectIds: string[]
  children: React.ReactNode
}

/**
 * Wraps the client portal layout with a live connection to Supabase Realtime.
 * On any event scoped to this client, refreshes the current route so server
 * components re-render with fresh data.
 *
 * Degrades silently if NEXT_PUBLIC_SUPABASE_* env vars are missing
 * (hook will not subscribe and `isConnected` stays false).
 */
export function RealtimeProvider({ clientId, projectIds, children }: RealtimeProviderProps) {
  const router = useRouter()

  useClientRealtime({
    enabled: true,
    clientId,
    projectIds,
    onApproval: () => router.refresh(),
    onProject: () => router.refresh(),
    onActivityLog: () => router.refresh(),
  })

  return <>{children}</>
}
