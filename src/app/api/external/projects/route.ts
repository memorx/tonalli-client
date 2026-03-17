import { NextResponse } from 'next/server'
import { getClientSessionForApi } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getClientSessionForApi()
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: { clientId: session.clientId },
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        deadline: true,
        startDate: true,
      },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
    })

    return NextResponse.json(projects)
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
