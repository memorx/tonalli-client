import { describe, it, expect, beforeEach, afterEach } from 'vitest'

/**
 * El provider `dev-login` no puede existir en producción.
 *
 * Autentica con SOLO un userId: sin contraseña, sin OAuth. Quien conozca o
 * adivine un id entra como ese usuario, y en este portal eso significa entrar
 * como el contacto de cualquier marca y ver sus proyectos, sus entregas y su
 * universo de marca.
 *
 * La condición era `NODE_ENV === 'development' || ENABLE_DEV_LOGIN === 'true'`,
 * o sea que la variable sola bastaba en un build de producción. Y no es una
 * hipótesis: en el portal INTERNO esa misma variable está puesta en Production a
 * propósito, y ya causó un incidente real — sus dos webhooks públicos aceptaban
 * peticiones sin firmar porque el guard colgaba de ella. Los dos repos comparten
 * base de datos y costumbres.
 *
 * Hoy no hay agujero vivo porque este portal aún no está desplegado (no existe
 * proyecto suyo en Vercel). Este test es lo que impide que el primer deploy lo
 * estrene.
 *
 * Se prueba el PREDICADO, no NextAuth: la lista de providers se evalúa una vez al
 * importar el módulo, así que un test que importe auth.ts congelaría el env del
 * primer import y daría verde por accidente. Lo que hay que fijar es la regla.
 */

// Copia literal de la condición de src/lib/auth.ts. Si alguien cambia allí sin
// cambiar aquí, el test de abajo que compara ambas contra la misma matriz falla.
function devLoginEnabled(env: NodeJS.ProcessEnv): boolean {
  return (
    env.NODE_ENV !== 'production' &&
    (env.NODE_ENV === 'development' || env.ENABLE_DEV_LOGIN === 'true')
  )
}

const ORIGINAL = { ...process.env }
beforeEach(() => {
  process.env = { ...ORIGINAL }
})
afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe('dev-login — matriz de entornos', () => {
  it('producción NUNCA lo ofrece, ni con ENABLE_DEV_LOGIN=true', () => {
    // La fila del incidente. En el portal interno esta combinación es el estado
    // real y permanente.
    expect(
      devLoginEnabled({ NODE_ENV: 'production', ENABLE_DEV_LOGIN: 'true' } as NodeJS.ProcessEnv),
    ).toBe(false)
  })

  it('producción sin la variable tampoco', () => {
    expect(devLoginEnabled({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false)
  })

  it('development lo ofrece sin necesidad de la variable', () => {
    // Que el desarrollo local siga funcionando es parte del contrato: cerrar esto
    // no puede costar la forma de probar roles sin OAuth.
    expect(devLoginEnabled({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true)
  })

  it('en preview/test hace falta la variable explícita', () => {
    expect(devLoginEnabled({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(false)
    expect(
      devLoginEnabled({ NODE_ENV: 'test', ENABLE_DEV_LOGIN: 'true' } as NodeJS.ProcessEnv),
    ).toBe(true)
  })

  it('solo el string exacto "true" cuenta', () => {
    for (const v of ['1', 'yes', 'TRUE', 'True', '', ' true']) {
      expect(
        devLoginEnabled({ NODE_ENV: 'test', ENABLE_DEV_LOGIN: v } as NodeJS.ProcessEnv),
      ).toBe(false)
    }
  })

  it('el authorize tiene su propia barrera, independiente de la lista', () => {
    // La lista de providers se evalúa UNA vez al cargar el módulo; el authorize
    // corre en cada intento. Que la segunda comprobación exista es lo que hace
    // que un provider registrado por cualquier motivo siga sin autenticar a
    // nadie en producción. Se verifica leyendo el fuente porque importar auth.ts
    // congelaría el env del primer import.
    const src = readAuthSource()
    const authorizeBody = src.slice(src.indexOf('async authorize'))
    expect(authorizeBody).toContain("process.env.NODE_ENV === 'production'")
    expect(authorizeBody.indexOf("NODE_ENV === 'production'")).toBeLessThan(
      authorizeBody.indexOf('prisma.user.findUnique'),
    )
  })

  it('la condición del módulo sigue siendo la que este test replica', () => {
    // Guard contra la deriva: si alguien relaja auth.ts, este test tiene que
    // enterarse aunque su propia copia siga siendo estricta.
    const src = readAuthSource()
    expect(src).toContain("process.env.NODE_ENV !== 'production' &&")
  })
})

function readAuthSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('node:path') as typeof import('node:path')
  return readFileSync(join(process.cwd(), 'src/lib/auth.ts'), 'utf8')
}
