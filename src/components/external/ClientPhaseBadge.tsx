import { cn } from '@/utils/cn'
import { CLIENT_PHASE_LABELS, CLIENT_PHASE_COLORS, type ClientPhase } from '@/utils/client-status'

export function ClientPhaseBadge({ phase }: { phase: ClientPhase }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        CLIENT_PHASE_COLORS[phase],
      )}
    >
      {CLIENT_PHASE_LABELS[phase]}
    </span>
  )
}
