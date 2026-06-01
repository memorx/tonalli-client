'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/utils/cn'
import { CLIENT_PRIORITY_COLORS, PRIORITY_KEY } from '@/utils/external-constants'

export function ClientPriorityBadge({ priority }: { priority: number }) {
  const t = useTranslations('priority')
  const key = PRIORITY_KEY[priority]
  const label = key ? t(key) : `P${priority}`
  const colors = CLIENT_PRIORITY_COLORS[priority] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        colors,
      )}
    >
      {label}
    </span>
  )
}
