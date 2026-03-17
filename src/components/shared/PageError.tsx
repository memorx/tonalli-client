import { AlertTriangle } from 'lucide-react'

export function PageError() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">
          Une erreur est survenue
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Veuillez réessayer.
        </p>
      </div>
    </div>
  )
}
