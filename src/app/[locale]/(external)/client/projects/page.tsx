import { getTranslations } from 'next-intl/server'
import { getClientSession } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'
import { ProjectCard } from '@/components/external/ProjectCard'
import { FolderOpen, CheckCircle } from 'lucide-react'

export default async function ClientProjectsPage() {
  const session = await getClientSession()
  const tp = await getTranslations('projects')
  const te = await getTranslations('errors')
  const tc = await getTranslations('common')

  try {
    const projects = await prisma.project.findMany({
      where: { clientId: session.clientId },
      orderBy: [{ status: 'asc' }, { priority: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        deadline: true,
      },
    })

    const active = projects.filter((p) => p.status !== 'ARCHIVED')
    const completed = projects.filter((p) => p.status === 'ARCHIVED')

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">{tp('title')}</h1>
          <p className="text-sm text-muted-foreground">{tp('count', { count: projects.length })}</p>
        </div>

        {active.length > 0 && (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
              {tp('tabs.active')} ({active.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  name={project.name}
                  status={project.status}
                  priority={project.priority}
                  deadline={project.deadline?.toISOString() ?? null}
                />
              ))}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              {tp('tabs.completed')} ({completed.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  name={project.name}
                  status={project.status}
                  priority={project.priority}
                  deadline={project.deadline?.toISOString() ?? null}
                />
              ))}
            </div>
          </div>
        )}

        {projects.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{tp('empty')}</p>
          </div>
        )}
      </div>
    )
  } catch {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">{te('generic')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tc('tryAgain')}</p>
        </div>
      </div>
    )
  }
}
