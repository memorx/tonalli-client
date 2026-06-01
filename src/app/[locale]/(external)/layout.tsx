import { getClientSession } from '@/lib/external-auth'
import { ExternalShell } from '@/components/external/ExternalShell'

export default async function ExternalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getClientSession()

  return (
    <ExternalShell
      userName={session.userName}
      userEmail={session.userEmail}
      userImage={session.userImage}
      clientName={session.clientName}
      clientLogo={session.clientLogo}
    >
      {children}
    </ExternalShell>
  )
}
