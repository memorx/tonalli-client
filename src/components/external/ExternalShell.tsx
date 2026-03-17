'use client'

import { useState } from 'react'
import { ClientSidebar } from '@/components/external/ClientSidebar'
import { ClientHeader } from '@/components/external/ClientHeader'
import { Sheet, SheetContent } from '@/components/ui/Sheet'

interface ExternalShellProps {
  children: React.ReactNode
  userName: string
  userEmail: string
  userImage: string | null
  clientName: string
  clientLogo: string | null
}

export function ExternalShell({
  children,
  userName,
  userEmail,
  userImage,
  clientName,
  clientLogo,
}: ExternalShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="dark">
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-60 shrink-0 border-r border-sidebar-border bg-sidebar">
          <ClientSidebar clientName={clientName} clientLogo={clientLogo} />
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-60 p-0 bg-sidebar border-sidebar-border">
            <ClientSidebar
              clientName={clientName}
              clientLogo={clientLogo}
              onItemClick={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ClientHeader
            userName={userName}
            userEmail={userEmail}
            userImage={userImage}
            clientName={clientName}
            onMenuClick={() => setMobileOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
