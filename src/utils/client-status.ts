import type { ProjectStatus } from '@/generated/prisma/client'

export type ClientPhase = 'PREPARATION' | 'PRODUCTION' | 'REVIEW' | 'YOUR_TURN' | 'COMPLETE'

export const CLIENT_PHASE_MAP: Record<ProjectStatus, ClientPhase> = {
  SETUP: 'PREPARATION',
  INCOMING: 'PREPARATION',
  ORGANIZING: 'PREPARATION',
  ON_HOLD_BLOCKED: 'PREPARATION',
  IN_PRODUCTION: 'PRODUCTION',
  WAITING_AESTHETIC_VALIDATION: 'REVIEW',
  WAITING_TECHNICAL_VALIDATION: 'REVIEW',
  READY_FINAL_VALIDATION: 'REVIEW',
  SENT_TO_CLIENT: 'YOUR_TURN',
  ARCHIVED: 'COMPLETE',
}

export const CLIENT_PHASE_LABELS: Record<ClientPhase, string> = {
  PREPARATION: 'En préparation',
  PRODUCTION: 'En production',
  REVIEW: 'En révision interne',
  YOUR_TURN: 'En attente de votre validation',
  COMPLETE: 'Terminé',
}

export const CLIENT_PHASE_COLORS: Record<ClientPhase, string> = {
  PREPARATION: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  PRODUCTION: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  REVIEW: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  YOUR_TURN: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  COMPLETE: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
}

export const CLIENT_PHASE_PROGRESS: Record<ClientPhase, number> = {
  PREPARATION: 15,
  PRODUCTION: 40,
  REVIEW: 70,
  YOUR_TURN: 90,
  COMPLETE: 100,
}

export const CLIENT_PHASE_ORDER: ClientPhase[] = [
  'PREPARATION',
  'PRODUCTION',
  'REVIEW',
  'YOUR_TURN',
  'COMPLETE',
]

export const CLIENT_PHASE_STEP_LABELS: Record<ClientPhase, string> = {
  PREPARATION: 'Préparation',
  PRODUCTION: 'Production',
  REVIEW: 'Révision',
  YOUR_TURN: 'Validation',
  COMPLETE: 'Terminé',
}

export function getClientPhase(status: ProjectStatus): ClientPhase {
  return CLIENT_PHASE_MAP[status]
}

export function getClientPhaseIndex(phase: ClientPhase): number {
  return CLIENT_PHASE_ORDER.indexOf(phase)
}

export function isVisibleStatusChange(oldStatus: ProjectStatus, newStatus: ProjectStatus): boolean {
  return CLIENT_PHASE_MAP[oldStatus] !== CLIENT_PHASE_MAP[newStatus]
}
