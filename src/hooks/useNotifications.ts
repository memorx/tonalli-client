'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ClientNotification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  projectId: string | null
}

interface UseNotificationsResult {
  notifications: ClientNotification[]
  unreadCount: number
  isLoading: boolean
  markAsRead: (ids?: string[]) => Promise<void>
  refresh: () => void
}

export function useNotifications(
  pollIntervalMs = 60_000,
): UseNotificationsResult {
  const [notifications, setNotifications] = useState<ClientNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/external/notifications')
      if (!res.ok) return
      const data = (await res.json()) as {
        notifications: ClientNotification[]
        unreadCount: number
      }
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, pollIntervalMs)
    return () => clearInterval(interval)
  }, [fetchNotifications, pollIntervalMs])

  const markAsRead = useCallback(
    async (ids?: string[]) => {
      await fetch('/api/external/notifications/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : {}),
      })
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          !ids || ids.includes(n.id) ? { ...n, isRead: true } : n,
        ),
      )
      setUnreadCount(0)
    },
    [],
  )

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    refresh: fetchNotifications,
  }
}
