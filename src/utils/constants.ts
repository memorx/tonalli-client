import type { UserRole } from '@/generated/prisma/client'

/**
 * Etiquetas de rol para el desplegable de dev-login.
 *
 * `LEAD_AESTHETIC` y `LEAD_TECHNICAL` estaban aquí y ya no existen: se
 * fusionaron en `CHEF_PROJECT` hace meses en el portal interno. Este repo
 * seguía mostrándolos porque su copia del esquema se había quedado atrás, así
 * que el desplegable ofrecía dos roles que la base de datos rechaza.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  ARTISTIC_CREATOR: 'Directeur Artistique',
  COORDINATOR: 'Coordinatrice',
  CHEF_PROJECT: 'Chef de Projet',
  DESIGNER: 'Designer',
  SUPPORT: 'Support & Communication',
  ADMINISTRATIVE: 'Administration',
  CLIENT_CONTACT: 'Contact Client',
}
