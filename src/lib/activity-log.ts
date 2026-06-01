import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

export type ActivityAction =
  // Existing app-level activity actions (project + task + approval flow)
  | 'PROJECT_CREATED'
  | 'STATUS_CHANGED'
  | 'TASK_CREATED'
  | 'TASK_STATUS_CHANGED'
  | 'VALIDATION_APPROVED'
  | 'VALIDATION_REJECTED'
  | 'PROJECT_UPDATED'
  | 'FILE_UPLOADED'
  | 'APPROVAL_CREATED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  // Audit-grade actions (added in F2-050). These exist for traceability:
  // who did/saw what, when. Persisted in the same ActivityLog table with
  // the new metadata fields (IP, user agent) inside `details`.
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'APPROVAL_VIEWED'
  | 'BRAND_VIEWED'
  | 'PROJECT_VIEWED'
  | 'INVOICE_DOWNLOADED'

export interface AuditMetadata {
  ip?: string | null
  userAgent?: string | null
  locale?: string
  /** Caller-specific extras (e.g. approvalId, decision, errorCode) */
  [key: string]: unknown
}

/**
 * Legacy helper. Kept for backwards-compat with callers that don't carry
 * a Request object. New code should prefer `logAuditEvent`.
 */
export async function logActivity(params: {
  userId: string
  action: ActivityAction
  projectId?: string
  details?: Record<string, unknown>
}) {
  return prisma.activityLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      projectId: params.projectId,
      details: (params.details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}

/**
 * Audit-grade log: extracts request metadata (IP, user agent) and is fail-safe.
 * If persistence fails (DB down, schema drift, etc.) we log and return without
 * throwing — audit must NEVER block the user flow.
 */
export async function logAuditEvent(params: {
  userId: string
  action: ActivityAction
  projectId?: string
  request?: Request
  metadata?: AuditMetadata
}): Promise<void> {
  const meta: AuditMetadata = { ...params.metadata }

  if (params.request) {
    const h = params.request.headers
    // x-forwarded-for is comma-separated; first IP is the client
    const xff = h.get('x-forwarded-for')
    meta.ip = xff?.split(',')[0]?.trim() || h.get('x-real-ip') || null
    meta.userAgent = h.get('user-agent') || null
  }

  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        projectId: params.projectId,
        details: meta as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    console.error('[audit-log] persist failed', {
      action: params.action,
      userId: params.userId,
      err,
    })
  }
}
