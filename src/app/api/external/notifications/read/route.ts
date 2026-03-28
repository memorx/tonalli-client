import { NextResponse } from 'next/server'
import { getClientSessionForApi } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  // Omit ids to mark ALL notifications as read
  ids: z.array(z.string()).optional(),
})

// PATCH /api/external/notifications/read
// Marks one, several, or all notifications as read for the current user.
// Body: { ids?: string[] }  — omit ids to mark all as read
export async function PATCH(req: Request) {
  try {
    const session = await getClientSessionForApi()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    const { ids } = parsed.data

    await prisma.notification.updateMany({
      where: {
        userId: session.userId,
        isRead: false,
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      data: { isRead: true },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
