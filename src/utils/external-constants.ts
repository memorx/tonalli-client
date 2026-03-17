import {
  LayoutDashboard,
  FolderOpen,
  CheckCircle,
  Palette,
  type LucideIcon,
} from 'lucide-react'

// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════

export interface ClientNavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const CLIENT_NAV_ITEMS: ClientNavItem[] = [
  { label: 'Tableau de bord', href: '/client/dashboard', icon: LayoutDashboard },
  { label: 'Projets', href: '/client/projects', icon: FolderOpen },
  { label: 'Validations', href: '/client/approvals', icon: CheckCircle },
  { label: 'Univers marque', href: '/client/brand', icon: Palette },
]

// ══════════════════════════════════════════════
// LABELS (French)
// ══════════════════════════════════════════════

export const CLIENT_LABELS = {
  welcome: 'Bienvenue',
  kpi: {
    activeProjects: 'Projets actifs',
    pendingApprovals: 'Validations en attente',
    filesToReview: 'Fichiers à examiner',
    completedThisMonth: 'Terminés ce mois',
  },
  sections: {
    currentProjects: 'Projets en cours',
    recentActivity: 'Activité récente',
    pendingApprovals: 'En attente de votre avis',
    allProjects: 'Projets',
    activeProjects: 'En cours',
    completedProjects: 'Terminés',
    approvals: 'Validations',
    brandUniverse: 'Univers marque',
    logos: 'Logos',
    colors: 'Palette de couleurs',
    typography: 'Typographies',
    guidelines: 'Guides',
  },
  empty: {
    projects: 'Aucun projet en cours',
    approvals: 'Aucune validation en attente',
    activity: 'Aucune activité récente',
    files: 'Aucun fichier disponible',
    brandAssets: 'Aucun actif de marque disponible',
  },
  actions: {
    viewAll: 'Voir tout',
    approve: 'Approuver',
    requestChanges: 'Demander des modifications',
    download: 'Télécharger',
    backToProjects: '← Retour aux projets',
    backToApprovals: '← Retour aux validations',
    retry: 'Réessayer',
  },
  errors: {
    generic: 'Une erreur est survenue',
    notFound: 'Page introuvable',
    unauthorized: 'Accès non autorisé',
  },
} as const

// ══════════════════════════════════════════════
// APPROVAL STATUS
// ══════════════════════════════════════════════

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvé',
  REJECTED: 'Rejeté',
  REVISION_REQUESTED: 'Modifications demandées',
}

export const APPROVAL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 border-red-500/30',
  REVISION_REQUESTED: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
}

// ══════════════════════════════════════════════
// PRIORITY
// ══════════════════════════════════════════════

export const CLIENT_PRIORITY_LABELS: Record<number, string> = {
  1: 'Urgent',
  2: 'Normal',
  3: 'Bas',
}

export const CLIENT_PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-500/20 text-red-300 border-red-500/30',
  2: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  3: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

// ══════════════════════════════════════════════
// ACTIVITY
// ══════════════════════════════════════════════

export const CLIENT_VISIBLE_ACTIONS = [
  'PROJECT_CREATED',
  'STATUS_CHANGED',
  'FILE_UPLOADED',
  'APPROVAL_CREATED',
  'APPROVAL_APPROVED',
  'APPROVAL_REJECTED',
] as const

export const CLIENT_ACTIVITY_LABELS: Record<string, string> = {
  PROJECT_CREATED: 'Projet créé',
  STATUS_CHANGED: 'Statut mis à jour',
  FILE_UPLOADED: 'Nouveau fichier disponible',
  APPROVAL_CREATED: 'Validation demandée',
  APPROVAL_APPROVED: 'Validation approuvée',
  APPROVAL_REJECTED: 'Modifications demandées',
}
