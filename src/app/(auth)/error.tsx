'use client'

import { AlertTriangle } from 'lucide-react'

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="w-full max-w-md text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-neutral-500" />
      <h2 className="mt-4 text-lg font-semibold text-white">
        Une erreur est survenue
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        Veuillez réessayer.
      </p>
      <button
        onClick={() => reset()}
        className="mt-4 rounded-md border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700 transition-colors"
      >
        Réessayer
      </button>
    </div>
  )
}
