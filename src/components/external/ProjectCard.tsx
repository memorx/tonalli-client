import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { ClientPhaseBadge } from '@/components/external/ClientPhaseBadge'
import { ClientPriorityBadge } from '@/components/external/ClientPriorityBadge'
import { ProjectProgressBar } from '@/components/external/ProjectProgressBar'
import { getClientPhase } from '@/utils/client-status'
import type { ProjectStatus } from '@/generated/prisma/client'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

dayjs.locale('fr')

interface ProjectCardProps {
  id: string
  name: string
  status: ProjectStatus
  priority: number
  deadline: string | null
}

export function ProjectCard({ id, name, status, priority, deadline }: ProjectCardProps) {
  const phase = getClientPhase(status)

  return (
    <Link
      href={`/client/projects/${id}`}
      className="block rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-card-foreground truncate">{name}</h3>
        <ClientPriorityBadge priority={priority} />
      </div>

      {/* Progress */}
      <div className="mt-4">
        <ProjectProgressBar currentPhase={phase} />
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <ClientPhaseBadge phase={phase} />
        {deadline && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {dayjs(deadline).format('D MMM YYYY')}
          </span>
        )}
      </div>
    </Link>
  )
}
