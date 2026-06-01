import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getClientSession } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'
import { ClientKpiCard } from '@/components/external/ClientKpiCard'
import { ProjectCard } from '@/components/external/ProjectCard'
import { CLIENT_VISIBLE_ACTIONS, APPROVAL_STATUS_COLORS } from '@/utils/external-constants'
import { getClientPhase, CLIENT_PHASE_LABELS, isVisibleStatusChange } from '@/utils/client-status'
import { cn } from '@/utils/cn'
import { FolderOpen, Clock, FileCheck, CheckCircle2, ArrowRight, FileText } from 'lucide-react'
import type { ProjectStatus } from '@/generated/prisma/client'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

dayjs.locale('fr')

export default async function ClientDashboardPage() {
  const session = await getClientSession()
  const firstName = session.userName.split(' ')[0]
  const td = await getTranslations('dashboard')
  const ta = await getTranslations('actions')
  const tact = await getTranslations('activity')
  const tap = await getTranslations('approvals')
  const tf = await getTranslations('files')
  const te = await getTranslations('errors')
  const tc = await getTranslations('common')

  try {
    const monthStart = dayjs().startOf('month').toDate()

    const [activeProjects, pendingApprovals, completedThisMonth, activityLogs] = await Promise.all([
      prisma.project.findMany({
        where: { clientId: session.clientId, status: { not: 'ARCHIVED' } },
        orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
        take: 6,
        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          deadline: true,
        },
      }),
      prisma.approval.findMany({
        where: {
          project: { clientId: session.clientId },
          status: 'PENDING',
        },
        include: {
          file: { select: { filename: true, thumbnailUrl: true } },
          project: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({
        where: {
          clientId: session.clientId,
          status: 'ARCHIVED',
          updatedAt: { gte: monthStart },
        },
      }),
      prisma.activityLog.findMany({
        where: {
          project: { clientId: session.clientId },
          action: { in: [...CLIENT_VISIBLE_ACTIONS] },
        },
        include: {
          project: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    const visibleActivity = activityLogs.filter((log) => {
      if (log.action === 'STATUS_CHANGED') {
        const details = log.details as Record<string, string> | null
        if (details?.oldStatus && details?.newStatus) {
          return isVisibleStatusChange(
            details.oldStatus as ProjectStatus,
            details.newStatus as ProjectStatus,
          )
        }
      }
      return true
    })

    const filesToReview = pendingApprovals.length

    return (
      <div className="space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold">{td('welcomeUser', { name: firstName })}</h1>
          <p className="text-sm text-muted-foreground">{session.clientName}</p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ClientKpiCard title={td('kpi.activeProjects')} value={activeProjects.length} icon={FolderOpen} />
          <ClientKpiCard
            title={td('kpi.pendingApprovals')}
            value={pendingApprovals.length}
            icon={Clock}
            colorClass={pendingApprovals.length > 0 ? 'text-amber-400' : undefined}
          />
          <ClientKpiCard title={td('kpi.filesToReview')} value={filesToReview} icon={FileCheck} />
          <ClientKpiCard
            title={td('kpi.completedThisMonth')}
            value={completedThisMonth}
            icon={CheckCircle2}
            colorClass="text-emerald-400"
          />
        </div>

        {/* Projects + Activity grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Projects */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {td('sections.currentProjects')}
              </h2>
              <Link href="/client/projects" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                {ta('viewAll')} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {activeProjects.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {activeProjects.map((project) => (
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
            ) : (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">{td('empty.projects')}</p>
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {td('sections.recentActivity')}
            </h2>

            {visibleActivity.length > 0 ? (
              <div className="space-y-2">
                {visibleActivity.map((log) => {
                  const details = log.details as Record<string, string> | null

                  return (
                    <div key={log.id} className="rounded-lg border border-border bg-card p-3">
                      <p className="text-sm font-medium">{tact(log.action)}</p>
                      {log.action === 'STATUS_CHANGED' && details?.newStatus && (
                        <p className="text-xs text-primary">
                          {CLIENT_PHASE_LABELS[getClientPhase(details.newStatus as ProjectStatus)]}
                        </p>
                      )}
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{log.project?.name}</span>
                        <span>{dayjs(log.createdAt).format('D MMM, HH:mm')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">{td('empty.activity')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending approvals */}
        {pendingApprovals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {td('sections.pendingApprovals')}
              </h2>
              <Link href="/client/approvals" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                {ta('viewAll')} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingApprovals.map((approval) => (
                <Link
                  key={approval.id}
                  href={`/client/approvals/${approval.id}`}
                  className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40"
                >
                  <div className="flex items-center gap-3">
                    {approval.file?.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={approval.file.thumbnailUrl} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-secondary">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{approval.file?.filename ?? tf('fileSingular')}</p>
                      <p className="text-xs text-muted-foreground truncate">{approval.project.name}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', APPROVAL_STATUS_COLORS[approval.status])}>
                      {tap(`status.${approval.status}`)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
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
