import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

export type ActivityAction =
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
