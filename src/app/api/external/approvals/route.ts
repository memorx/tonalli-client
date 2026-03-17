import { NextResponse } from 'next/server'
import { getClientSessionForApi } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getClientSessionForApi()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const approvals = await prisma.approval.findMany({
      where: { project: { clientId: session.clientId } },
      include: {
        file: { select: { filename: true, thumbnailUrl: true, mimeType: true, version: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(approvals)
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
