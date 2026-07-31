import type { ProjectStatus } from '@/generated/prisma/client'

export type ClientPhase = 'PREPARATION' | 'PRODUCTION' | 'REVIEW' | 'YOUR_TURN' | 'COMPLETE'

/**
 * Los 8 estados internos, traducidos a las 5 fases que ve el cliente.
 *
 * Este mapa estaba desactualizado y era un bug vivo, no cosmético. Cubría los
 * estados de antes del refactor (INCOMING, ORGANIZING, las dos
 * WAITING_*_VALIDATION y READY_FINAL_VALIDATION) y NO tenía entrada para
 * CREATED, GATE_1 ni GATE_2 — que son los reales desde hace meses. Un proyecto
 * en cualquiera de las dos puertas devolvía `undefined` aquí, así que el
 * cliente veía la fase en blanco justo en el momento que más le importa: el
 * tramo de validación previo a su entrega.
 *
 * Estaba oculto porque el schema.prisma de este repo se había quedado clavado
 * en el enum viejo, así que TypeScript comparaba contra estados que la base ya
 * no tiene y no podía avisar. Al sincronizar el esquema con el portal interno,
 * el compilador lo destapó.
 *
 * `Record<ProjectStatus, ...>` es deliberado: si mañana se añade un estado al
 * enum, esto deja de compilar en vez de devolver undefined en silencio.
 */
export const CLIENT_PHASE_MAP: Record<ProjectStatus, ClientPhase> = {
  SETUP: 'PREPARATION',
  CREATED: 'PREPARATION',
  ON_HOLD_BLOCKED: 'PREPARATION',
  IN_PRODUCTION: 'PRODUCTION',
  // Las dos puertas son validación INTERNA: Gate 1 la coordinadora, Gate 2 el
  // director artístico. Desde fuera son el mismo momento —"lo estamos
  // revisando"— y el cliente no debe ver nuestra mecánica interna.
  GATE_1: 'REVIEW',
  GATE_2: 'REVIEW',
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
