import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LoginForm } from '@/components/auth/LoginForm'
import { ROLE_LABELS } from '@/utils/constants'
import type { UserRole } from '@/generated/prisma/client'

interface DevUser {
  id: string
  name: string
  role: UserRole
  roleLabel: string
}

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) {
    redirect('/client/dashboard')
  }

  try {
    let devUsers: DevUser[] = []
    const enableDevLogin = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_LOGIN === 'true'
    if (enableDevLogin) {
      const users = await prisma.user.findMany({
        where: { isActive: true, role: 'CLIENT_CONTACT' },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      })
      devUsers = users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        roleLabel: ROLE_LABELS[u.role],
      }))
    }

    return (
      <div className="w-full max-w-md">
        {/* Logo + branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900">
            <span className="text-xl font-bold text-white">T</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Bienvenue</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Connectez-vous pour accéder à votre espace client
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-2xl backdrop-blur">
          <LoginForm devUsers={devUsers} isDev={enableDevLogin} />
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-neutral-600">
          Bureau Tonalli — Espace client
        </p>
      </div>
    )
  } catch {
    return (
      <div className="w-full max-w-md text-center">
        <h2 className="text-lg font-semibold text-white">Une erreur est survenue</h2>
        <p className="mt-1 text-sm text-neutral-400">Veuillez réessayer.</p>
      </div>
    )
  }
}
