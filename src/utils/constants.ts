import type { UserRole } from '@/generated/prisma/client'

export const ROLE_LABELS: Record<UserRole, string> = {
  ARTISTIC_CREATOR: 'Directeur Artistique',
  COORDINATOR: 'Coordinatrice',
  LEAD_AESTHETIC: 'Lead Esthétique',
  LEAD_TECHNICAL: 'Lead Technique',
  DESIGNER: 'Designer',
  SUPPORT: 'Support & Communication',
  ADMINISTRATIVE: 'Administration',
  CLIENT_CONTACT: 'Contact Client',
}
