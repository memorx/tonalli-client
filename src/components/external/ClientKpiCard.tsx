import { cn } from '@/utils/cn'
import type { LucideIcon } from 'lucide-react'

interface ClientKpiCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  colorClass?: string
  description?: string
}

export function ClientKpiCard({ title, value, icon: Icon, colorClass, description }: ClientKpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className={cn('mt-2 text-2xl font-bold', colorClass)}>{value}</p>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="rounded-lg bg-secondary p-2.5">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
