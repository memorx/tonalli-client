import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getClientSessionForApi } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'
import { createNotifications } from '@/lib/notifications'

const patchSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  feedback: z.string().optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getClientSessionForApi()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    const approval = await prisma.approval.findFirst({
      where: { id, project: { clientId: session.clientId } },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            version: true,
            storageUrl: true,
            thumbnailUrl: true,
            createdAt: true,
          },
        },
        project: { select: { id: true, name: true } },
      },
    })

    if (!approval) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    }

    return NextResponse.json(approval)
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getClientSessionForApi()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const { action, feedback } = parsed.data

    if (action === 'REJECT' && (!feedback || !feedback.trim())) {
      return NextResponse.json({ error: 'Le commentaire est requis pour demander des modifications' }, { status: 400 })
    }

    const approval = await prisma.approval.findFirst({
      where: { id, project: { clientId: session.clientId } },
      include: {
        project: { select: { id: true, name: true, opsOwnerId: true } },
        file: { select: { uploaderId: true, filename: true } },
      },
    })

    if (!approval) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    }

    if (approval.status !== 'PENDING') {
      return NextResponse.json({ error: 'Cette validation a déjà été traitée' }, { status: 400 })
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REVISION_REQUESTED'

    const updated = await prisma.approval.update({
      where: { id },
      data: {
        status: newStatus,
        feedback: action === 'REJECT' ? feedback : null,
        reviewedAt: new Date(),
      },
    })

    // Log activity
    await logActivity({
      userId: session.userId,
      action: action === 'APPROVE' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
      projectId: approval.project.id,
      details: {
        approvalId: id,
        filename: approval.file?.filename,
        status: newStatus,
      },
    })

    // Notify coordinator and file uploader
    const notifyUserIds = new Set<string>()
    notifyUserIds.add(approval.project.opsOwnerId)
    if (approval.file?.uploaderId) {
      notifyUserIds.add(approval.file.uploaderId)
    }

    const notificationType = action === 'APPROVE' ? 'APPROVAL_APPROVED' as const : 'APPROVAL_REJECTED' as const
    const notificationTitle = action === 'APPROVE'
      ? `Validation approuvée — ${approval.project.name}`
      : `Modifications demandées — ${approval.project.name}`
    const notificationMessage = action === 'APPROVE'
      ? `${session.userName} a approuvé un fichier du projet ${approval.project.name}`
      : `${session.userName} a demandé des modifications: ${feedback}`

    await createNotifications(
      Array.from(notifyUserIds).map((userId) => ({
        userId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        projectId: approval.project.id,
      })),
    )

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
