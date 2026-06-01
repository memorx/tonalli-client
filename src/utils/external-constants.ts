import {
  LayoutDashboard,
  FolderOpen,
  CheckCircle,
  Palette,
  type LucideIcon,
} from 'lucide-react'

// ══════════════════════════════════════════════
// NAVIGATION (label is a key in messages.navigation)
// ══════════════════════════════════════════════

export interface ClientNavItem {
  labelKey: string
  href: string
  icon: LucideIcon
}

export const CLIENT_NAV_ITEMS: ClientNavItem[] = [
  { labelKey: 'dashboard', href: '/client/dashboard', icon: LayoutDashboard },
  { labelKey: 'projects', href: '/client/projects', icon: FolderOpen },
  { labelKey: 'approvals', href: '/client/approvals', icon: CheckCircle },
  { labelKey: 'brand', href: '/client/brand', icon: Palette },
]

// ══════════════════════════════════════════════
// APPROVAL STATUS COLORS (non-translatable Tailwind classes)
// ══════════════════════════════════════════════

export const APPROVAL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 border-red-500/30',
  REVISION_REQUESTED: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
}

// ══════════════════════════════════════════════
// PRIORITY COLORS (non-translatable Tailwind classes)
// ══════════════════════════════════════════════

export const CLIENT_PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-red-500/20 text-red-300 border-red-500/30',
  2: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  3: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

// Mapping numeric priority → translation key (used with messages.priority)
export const PRIORITY_KEY: Record<number, string> = {
  1: 'URGENT',
  2: 'NORMAL',
  3: 'LOW',
}

// ══════════════════════════════════════════════
// ACTIVITY (whitelist of actions shown to clients)
// ══════════════════════════════════════════════

export const CLIENT_VISIBLE_ACTIONS = [
  'PROJECT_CREATED',
  'STATUS_CHANGED',
  'FILE_UPLOADED',
  'APPROVAL_CREATED',
  'APPROVAL_APPROVED',
  'APPROVAL_REJECTED',
] as const
