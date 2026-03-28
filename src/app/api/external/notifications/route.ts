import { NextResponse } from 'next/server'
import { getClientSessionForApi } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'

// GET /api/external/notifications
// Returns the 50 most recent notifications for the authenticated client user.
// Query params:
//   ?unread=true  — only unread notifications
export async function GET(req: Request) {
  try {
    const session = await getClientSessionForApi()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const onlyUnread = searchParams.get('unread') === 'true'

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.userId,
        ...(onlyUnread ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
        projectId: true,
      },
    })

    const unreadCount = onlyUnread
      ? notifications.length
      : notifications.filter((n) => !n.isRead).length

    return NextResponse.json({ notifications, unreadCount })
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
