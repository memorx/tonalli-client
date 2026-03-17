import { getClientSession } from '@/lib/external-auth'
import { prisma } from '@/lib/prisma'
import { BrandColorCopy } from '@/components/external/BrandColorCopy'
import { CLIENT_LABELS } from '@/utils/external-constants'
import { Palette, Image, Type, BookOpen } from 'lucide-react'

export default async function ClientBrandPage() {
  const session = await getClientSession()

  try {
    const assets = await prisma.brandAsset.findMany({
      where: { clientId: session.clientId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })

    const logos = assets.filter((a) => a.type === 'LOGO')
    const colors = assets.filter((a) => a.type === 'COLOR')
    const typography = assets.filter((a) => a.type === 'TYPOGRAPHY')
    const guidelines = assets.filter((a) => a.type === 'GUIDELINE')

    const hasAssets = assets.length > 0

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">{CLIENT_LABELS.sections.brandUniverse}</h1>
          <p className="text-sm text-muted-foreground">{session.clientName}</p>
        </div>

        {!hasAssets && (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Palette className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{CLIENT_LABELS.empty.brandAssets}</p>
          </div>
        )}

        {/* Logos */}
        {logos.length > 0 && (
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Image className="h-4 w-4" />
              {CLIENT_LABELS.sections.logos}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {logos.map((logo) => (
                <div
                  key={logo.id}
                  className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-3"
                >
                  {logo.value.startsWith('http') || logo.value.startsWith('/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo.fileUrl ?? logo.value}
                      alt={logo.name}
                      className="h-20 w-auto object-contain"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-secondary">
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-sm font-medium text-center">{logo.name}</p>
                  {logo.description && (
                    <p className="text-xs text-muted-foreground text-center">{logo.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Colors */}
        {colors.length > 0 && (
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Palette className="h-4 w-4" />
              {CLIENT_LABELS.sections.colors}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {colors.map((color) => (
                <BrandColorCopy key={color.id} name={color.name} value={color.value} />
              ))}
            </div>
          </section>
        )}

        {/* Typography */}
        {typography.length > 0 && (
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Type className="h-4 w-4" />
              {CLIENT_LABELS.sections.typography}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {typography.map((font) => (
                <div
                  key={font.id}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <p
                    className="text-3xl font-light text-card-foreground"
                    style={{ fontFamily: font.value }}
                  >
                    Aa Bb Cc 123
                  </p>
                  <p className="mt-3 text-sm font-medium">{font.name}</p>
                  <p className="text-xs text-muted-foreground">{font.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Guidelines */}
        {guidelines.length > 0 && (
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              {CLIENT_LABELS.sections.guidelines}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guidelines.map((guide) => (
                <div
                  key={guide.id}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{guide.name}</p>
                      {guide.description && (
                        <p className="text-xs text-muted-foreground truncate">{guide.description}</p>
                      )}
                    </div>
                  </div>
                  {(guide.fileUrl || guide.value.startsWith('http')) && (
                    <a
                      href={guide.fileUrl ?? guide.value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm text-primary hover:underline"
                    >
                      Télécharger
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  } catch {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">{CLIENT_LABELS.errors.generic}</p>
          <p className="mt-1 text-sm text-muted-foreground">Veuillez réessayer.</p>
        </div>
      </div>
    )
  }
}
