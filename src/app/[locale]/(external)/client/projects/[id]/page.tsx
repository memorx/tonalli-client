import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getClientSession } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'
import { ClientPhaseBadge } from '@/components/external/ClientPhaseBadge'
import { ClientPriorityBadge } from '@/components/external/ClientPriorityBadge'
import { ProjectProgressBar } from '@/components/external/ProjectProgressBar'
import { getClientPhase, isVisibleStatusChange, CLIENT_PHASE_LABELS } from '@/utils/client-status'
import { CLIENT_VISIBLE_ACTIONS, APPROVAL_STATUS_COLORS } from '@/utils/external-constants'
import { cn } from '@/utils/cn'
import { ArrowLeft, Calendar, Clock, Image, Film, FileText, File } from 'lucide-react'
import type { ProjectStatus } from '@/generated/prisma/client'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

dayjs.locale('fr')

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.startsWith('video/')) return Film
  if (mimeType.includes('pdf')) return FileText
  return File
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export default async function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getClientSession()
  const { id } = await params

  const tp = await getTranslations('projects')
  const ta = await getTranslations('actions')
  const tact = await getTranslations('activity')
  const tap = await getTranslations('approvals')
  const tf = await getTranslations('files')
  const td = await getTranslations('dashboard')
  const te = await getTranslations('errors')
  const tc = await getTranslations('common')

  try {
    const project = await prisma.project.findFirst({
      where: { id, clientId: session.clientId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        priority: true,
        startDate: true,
        deadline: true,
        files: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            version: true,
            thumbnailUrl: true,
            createdAt: true,
            approvals: {
              where: { reviewerId: session.userId },
              select: { id: true, status: true },
            },
          },
        },
      },
    })

    if (!project) notFound()

    const activityLogs = await prisma.activityLog.findMany({
      where: {
        projectId: project.id,
        action: { in: [...CLIENT_VISIBLE_ACTIONS] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

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

    const phase = getClientPhase(project.status)

    return (
      <div className="space-y-6">
        <Link href="/client/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {ta('backToProjects')}
        </Link>

        <div>
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <ClientPhaseBadge phase={phase} />
            <ClientPriorityBadge priority={project.priority} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {project.startDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {tp('detail.start')}: {dayjs(project.startDate).format('D MMM YYYY')}
              </span>
            )}
            {project.deadline && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {tp('detail.deadline')}: {dayjs(project.deadline).format('D MMM YYYY')}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <ProjectProgressBar currentPhase={phase} />
        </div>

        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Files */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {tp('detail.filesTitle')} ({project.files.length})
            </h2>

            {project.files.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {project.files.map((file) => {
                  const FileIcon = getFileIcon(file.mimeType)
                  const approval = file.approvals[0]

                  return (
                    <div key={file.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        {file.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={file.thumbnailUrl} alt="" className="h-12 w-12 rounded object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded bg-secondary">
                            <FileIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{file.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            v{file.version} — {formatSize(file.size)}
                          </p>
                        </div>
                      </div>
                      {approval && (
                        <div className="mt-2">
                          <Link href={`/client/approvals/${approval.id}`}>
                            <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium hover:opacity-80', APPROVAL_STATUS_COLORS[approval.status])}>
                              {tap(`status.${approval.status}`)}
                            </span>
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">{tf('empty')}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {tp('detail.historyTitle')}
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
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dayjs(log.createdAt).format('D MMM YYYY')}
                      </p>
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
