import { getClientSession } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'
import { ExternalShell } from '@/components/external/ExternalShell'
import { RealtimeProvider } from '@/components/external/RealtimeProvider'

export default async function ExternalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getClientSession()

  // Light query: only IDs needed for in-memory Realtime filtering
  const projects = await prisma.project.findMany({
    where: { clientId: session.clientId },
    select: { id: true },
  })
  const projectIds = projects.map((p) => p.id)

  return (
    <RealtimeProvider clientId={session.clientId} projectIds={projectIds}>
      <ExternalShell
        userName={session.userName}
        userEmail={session.userEmail}
        userImage={session.userImage}
        clientName={session.clientName}
        clientLogo={session.clientLogo}
      >
        {children}
      </ExternalShell>
    </RealtimeProvider>
  )
}
