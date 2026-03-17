import Link from 'next/link'
import { getClientSession } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'
import { CLIENT_LABELS, APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS } from '@/utils/external-constants'
import { cn } from '@/utils/cn'
import { CheckCircle, FileText } from 'lucide-react'

const TABS = [
  { label: 'Toutes', value: '' },
  { label: 'En attente', value: 'PENDING' },
  { label: 'Approuvées', value: 'APPROVED' },
  { label: 'Modifiées', value: 'REVISION_REQUESTED' },
] as const

export default async function ClientApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await getClientSession()
  const params = await searchParams
  const filterStatus = params.status || ''

  try {
    const where: Record<string, unknown> = {
      project: { clientId: session.clientId },
    }
    if (filterStatus) where.status = filterStatus

    const approvals = await prisma.approval.findMany({
      where,
      include: {
        file: { select: { filename: true, thumbnailUrl: true, mimeType: true, version: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{CLIENT_LABELS.sections.approvals}</h1>
          <p className="text-sm text-muted-foreground">
            {approvals.length} validation{approvals.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const isActive = filterStatus === tab.value
            return (
              <Link
                key={tab.value}
                href={tab.value ? `/client/approvals?status=${tab.value}` : '/client/approvals'}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        {/* Grid */}
        {approvals.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {approvals.map((approval) => (
              <Link
                key={approval.id}
                href={`/client/approvals/${approval.id}`}
                className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  {approval.file?.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={approval.file.thumbnailUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-secondary">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {approval.file?.filename ?? 'Fichier'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {approval.project.name}
                    </p>
                    {approval.file && (
                      <p className="text-xs text-muted-foreground">v{approval.file.version}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', APPROVAL_STATUS_COLORS[approval.status])}>
                    {APPROVAL_STATUS_LABELS[approval.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{CLIENT_LABELS.empty.approvals}</p>
          </div>
        )}
      </div>
    )
  } catch {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">{CLIENT_LABELS.errors.generic}</p>
          <p className="mt-1 text-sm text-muted-foreground">Veuillez réessayer.</p>
        </div>
      </div>
    )
  }
}
