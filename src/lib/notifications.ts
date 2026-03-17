import { prisma } from '@/lib/prisma'

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'VALIDATION_PENDING'
  | 'VALIDATION_APPROVED'
  | 'VALIDATION_REJECTED'
  | 'PROJECT_GATE_ADVANCED'
  | 'PROJECT_READY_FINAL'
  | 'FILE_READY'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'PROJECT_UPDATE'
  | 'COMMENT_REPLY'
  | 'PROJECT_COMPLETE'

export async function createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  message: string
  projectId?: string
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      channel: 'IN_APP',
      projectId: params.projectId,
    },
  })
}

export async function createNotifications(
  entries: {
    userId: string
    type: NotificationType
    title: string
    message: string
    projectId?: string
  }[],
) {
  if (entries.length === 0) return
  return prisma.notification.createMany({
    data: entries.map((e) => ({
      userId: e.userId,
      type: e.type,
      title: e.title,
      message: e.message,
      channel: 'IN_APP',
      projectId: e.projectId,
    })),
  })
}
