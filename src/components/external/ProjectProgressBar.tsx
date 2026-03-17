import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  CLIENT_PHASE_ORDER,
  CLIENT_PHASE_STEP_LABELS,
  getClientPhaseIndex,
  type ClientPhase,
} from '@/utils/client-status'

interface ProjectProgressBarProps {
  currentPhase: ClientPhase
}

export function ProjectProgressBar({ currentPhase }: ProjectProgressBarProps) {
  const currentIndex = getClientPhaseIndex(currentPhase)

  return (
    <div className="flex items-start">
      {CLIENT_PHASE_ORDER.map((phase, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isFuture = index > currentIndex
        const isLast = index === CLIENT_PHASE_ORDER.length - 1

        return (
          <div key={phase} className={cn('flex items-start', !isLast && 'flex-1')}>
            {/* Step */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all',
                  isCompleted && 'border-emerald-500 bg-emerald-500/20 text-emerald-400',
                  isCurrent && 'border-primary bg-primary/20 text-primary scale-110 shadow-lg shadow-primary/20',
                  isFuture && 'border-muted bg-muted/50 text-muted-foreground',
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-[10px] font-medium text-center max-w-[60px]',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {CLIENT_PHASE_STEP_LABELS[phase]}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="mt-4 flex-1 px-1">
                <div
                  className={cn(
                    'h-0.5 w-full rounded-full',
                    isCompleted && 'bg-emerald-500',
                    isCurrent && 'bg-gradient-to-r from-primary to-muted',
                    isFuture && 'bg-muted',
                  )}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
