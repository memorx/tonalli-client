import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClientSession } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'
import { ApprovalActions } from '@/components/external/ApprovalActions'
import { CLIENT_LABELS, APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS } from '@/utils/external-constants'
import { cn } from '@/utils/cn'
import { ArrowLeft, Download, Image, Film, FileText, File } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

dayjs.locale('fr')

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.startsWith('video/')) return Film
  if (mimeType.includes('pdf')) return FileText
  return File
}

export default async function ClientApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getClientSession()
  const { id } = await params

  try {
    const approval = await prisma.approval.findFirst({
      where: { id, project: { clientId: session.clientId } },
      include: {
        file: {
          select: {
            filename: true,
            mimeType: true,
            size: true,
            version: true,
            storageUrl: true,
            thumbnailUrl: true,
          },
        },
        project: { select: { id: true, name: true } },
      },
    })

    if (!approval) notFound()

    const FileIcon = approval.file ? getFileIcon(approval.file.mimeType) : File

    return (
      <div className="space-y-6">
        {/* Back */}
        <Link
          href="/client/approvals"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {CLIENT_LABELS.actions.backToApprovals}
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{approval.file?.filename ?? 'Fichier'}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Link href={`/client/projects/${approval.project.id}`} className="hover:text-primary hover:underline">
                {approval.project.name}
              </Link>
              {approval.file && (
                <>
                  <span>v{approval.file.version}</span>
                  <span>{formatSize(approval.file.size)}</span>
                </>
              )}
            </div>
          </div>
          <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium', APPROVAL_STATUS_COLORS[approval.status])}>
            {APPROVAL_STATUS_LABELS[approval.status]}
          </span>
        </div>

        {/* File preview */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {approval.file ? (
            <div className="flex min-h-[400px] items-center justify-center bg-black/20 p-4">
              {approval.file.mimeType.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={approval.file.storageUrl}
                  alt={approval.file.filename}
                  className="max-h-[600px] w-auto object-contain"
                />
              ) : approval.file.mimeType.includes('pdf') ? (
                <iframe
                  src={approval.file.storageUrl}
                  className="h-[600px] w-full"
                  title={approval.file.filename}
                />
              ) : approval.file.mimeType.startsWith('video/') ? (
                <video
                  controls
                  className="max-h-[600px] w-auto"
                  src={approval.file.storageUrl}
                />
              ) : (
                <div className="text-center">
                  <FileIcon className="mx-auto h-16 w-16 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">{approval.file.filename}</p>
                  <a
                    href={approval.file.storageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    {CLIENT_LABELS.actions.download}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[400px] items-center justify-center">
              <p className="text-sm text-muted-foreground">Aucun fichier associé</p>
            </div>
          )}
        </div>

        {/* Approved info */}
        {approval.status === 'APPROVED' && approval.reviewedAt && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-sm font-medium text-emerald-300">
              Approuvé le {dayjs(approval.reviewedAt).format('D MMMM YYYY à HH:mm')}
            </p>
          </div>
        )}

        {/* Le mot de Bureau Tonalli qui accompagne la livraison.
            Rapporté par Raúl (PDF du 30 juil.) : jusqu'ici il n'y avait aucun
            endroit où écrire au client. Distinct de `feedback`, qui est la
            réponse DU client — les deux blocs peuvent coexister sur une
            révision, et les confondre écraserait l'un par l'autre.
            whitespace-pre-line : les modèles sont écrits en plusieurs
            paragraphes et sans cela ils arriveraient sur une seule ligne. */}
        {approval.message && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Message de Bureau Tonalli
            </p>
            <p className="whitespace-pre-line text-sm">{approval.message}</p>
          </div>
        )}

        {/* Feedback */}
        {approval.feedback && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-300 mb-1">
              Commentaire
            </p>
            <p className="text-sm text-orange-200">{approval.feedback}</p>
          </div>
        )}

        {/* Actions */}
        <ApprovalActions approvalId={approval.id} status={approval.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED'} />
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
