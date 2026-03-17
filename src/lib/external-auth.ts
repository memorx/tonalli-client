import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface ClientSession {
  userId: string
  userName: string
  userEmail: string
  userImage: string | null
  clientId: string
  clientName: string
  clientLogo: string | null
}

export async function getClientSession(): Promise<ClientSession> {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'CLIENT_CONTACT') redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      avatar: true,
      clientId: true,
      client: { select: { id: true, name: true, logo: true } },
    },
  })

  if (!user?.clientId || !user.client) redirect('/login')

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userImage: user.avatar ?? user.image,
    clientId: user.client.id,
    clientName: user.client.name,
    clientLogo: user.client.logo,
  }
}

export async function getClientSessionForApi(): Promise<ClientSession | null> {
  const session = await auth()
  if (!session?.user) return null
  if (session.user.role !== 'CLIENT_CONTACT') return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      avatar: true,
      clientId: true,
      client: { select: { id: true, name: true, logo: true } },
    },
  })

  if (!user?.clientId || !user.client) return null

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userImage: user.avatar ?? user.image,
    clientId: user.client.id,
    clientName: user.client.name,
    clientLogo: user.client.logo,
  }
}
