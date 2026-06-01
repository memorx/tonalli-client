'use client'

import { AlertTriangle } from 'lucide-react'

export default function ExternalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="dark">
      <div className="flex min-h-[40vh] items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">
            Une erreur est survenue
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Veuillez réessayer.
          </p>
          <button
            onClick={() => reset()}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  )
}
