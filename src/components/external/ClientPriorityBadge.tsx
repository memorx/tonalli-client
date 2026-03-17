import { cn } from '@/utils/cn'
import { CLIENT_PRIORITY_LABELS, CLIENT_PRIORITY_COLORS } from '@/utils/external-constants'

export function ClientPriorityBadge({ priority }: { priority: number }) {
  const label = CLIENT_PRIORITY_LABELS[priority] ?? `P${priority}`
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
