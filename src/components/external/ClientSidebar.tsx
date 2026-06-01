'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { CLIENT_NAV_ITEMS } from '@/utils/external-constants'
import { cn } from '@/utils/cn'

interface ClientSidebarProps {
  clientName: string
  clientLogo: string | null
  onItemClick?: () => void
}

export function ClientSidebar({ clientName, clientLogo, onItemClick }: ClientSidebarProps) {
  const t = useTranslations('navigation')
  const tc = useTranslations('common')
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
        {clientLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clientLogo} alt={clientName} className="h-7 w-7 rounded object-contain" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/20 text-xs font-bold text-primary">
            BT
          </div>
        )}
        <span className="text-sm font-semibold text-sidebar-foreground">{tc('appName')}</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {CLIENT_NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(item.labelKey)}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs text-muted-foreground truncate">{clientName}</p>
      </div>
    </div>
  )
}
