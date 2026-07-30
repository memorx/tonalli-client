import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { createRequire } from 'node:module'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import middleware, { config } from '@/middleware'

// El middleware no importa nada de `@/lib/*`: sólo lee `req.nextUrl.pathname` y las cookies. Por eso
// aquí no hay un solo `vi.mock` — no hay nada que interceptar, y montar mocks de prisma/auth sería
// ruido que sugiere una dependencia que no existe. Esa ausencia de dependencias es en sí el hecho
// más importante de este archivo: el middleware NO sabe quién eres, sólo si traes una cookie con
// cierto nombre. La identidad, el rol y —sobre todo— el `clientId` se resuelven aguas abajo en
// `getClientSession` / `getClientSessionForApi`. Los tests de tenancy de esta capa (ver el bloque
// "frontera de tenancy") existen precisamente para dejar fijado por escrito que aquí NO hay
// frontera entre marcas, para que nadie asuma que el middleware ya filtra Givenchy vs Cartier.

const ORIGIN = 'https://portal.tonalli.fr'

// Los dos nombres de cookie que reconoce `hasSessionCookie`. El segundo es el que Auth.js emite en
// producción sobre HTTPS; si alguien lo borra del middleware el portal desplegado deja de dejar
// pasar a nadie, y en local nadie se entera porque en local se usa el primero.
const DEV_COOKIE = 'authjs.session-token'
const PROD_COOKIE = '__Secure-authjs.session-token'

// Valor opaco: el middleware jamás lo verifica (lo dice su propio comentario de cabecera), así que
// el contenido es irrelevante. Se usan strings distinguibles para poder afirmar en el test
// cross-tenant que la decisión no cambia según de quién sea el token.
const TOKEN_GIVENCHY = 'jwt-opaco-del-contacto-givenchy'
const TOKEN_CARTIER = 'jwt-opaco-del-contacto-cartier'

// `pathToRegexp` compilado que trae Next: es exactamente el que Next usa para convertir
// `config.matcher` en el regex que decide si el middleware llega a ejecutarse. Reimplementar esa
// conversión a mano sería adivinar; importar la que usa el framework hace que el test del matcher
// mida el matcher de verdad y no mi interpretación de él. Si Next mueve esta ruta interna, el
// archivo revienta al importar — un fallo ruidoso, que es lo que se quiere aquí.
type PathToRegexpModule = { pathToRegexp: (pattern: string) => RegExp }
const requireFromTest = createRequire(import.meta.url)
const { pathToRegexp }: PathToRegexpModule = requireFromTest('next/dist/compiled/path-to-regexp')

const matcherRegexes = config.matcher.map((pattern) => pathToRegexp(pattern))

function isMatchedByMiddleware(pathname: string): boolean {
  return matcherRegexes.some((re) => re.test(pathname))
}

// Se construye la URL por concatenación y no con `new URL(pathname, ORIGIN)` a propósito: la forma
// de dos argumentos interpreta `//client/dashboard` como URL protocol-relative y lo convierte en
// `https://client/dashboard`, con lo que el test de la doble barra mediría otra cosa.
function requestFor(
  pathname: string,
  cookies: ReadonlyArray<readonly [string, string]> = [],
): NextRequest {
  const headers = new Headers()
  if (cookies.length > 0) {
    headers.set('cookie', cookies.map(([name, value]) => `${name}=${value}`).join('; '))
  }
  return new NextRequest(new URL(`${ORIGIN}${pathname}`), { headers })
}

const withSession = [[DEV_COOKIE, TOKEN_GIVENCHY]] as const

// `NextResponse.next()` no se distingue por status (es 200, igual que muchas respuestas): lo que lo
// identifica es la cabecera interna `x-middleware-next`, que es la señal que Next lee para seguir
// hacia la ruta. Comprobar sólo `status === 200` daría un test que pasa aunque el middleware
// devolviese un 200 con cuerpo vacío en vez de dejar continuar la petición.
function isPassThrough(res: Response): boolean {
  return res.headers.get('x-middleware-next') === '1'
}

// Firma legible de la decisión, para poder comparar dos peticiones distintas con un `toBe` y que el
// mensaje de fallo diga qué pasó en vez de "expected true to be false".
function decisionOf(res: Response): string {
  if (isPassThrough(res)) return 'PASS'
  const location = res.headers.get('location')
  if (location !== null) return `REDIRECT ${location} (${res.status})`
  return `BLOCK ${res.status}`
}

// ---------------------------------------------------------------------------------------------
// Enumeración de rutas reales desde el sistema de archivos.
//
// Listar las rutas a mano dejaría los tests congelados en el mapa de julio de 2026: la página
// `/client/invoices` ya está en el roadmap del CLAUDE.md, y una página nueva que nadie añada a una
// lista de tests es exactamente el hueco que esta tarea pide detectar. Recorriendo `src/app` cada
// página y cada route handler que exista el día que se corra la suite entra automáticamente en las
// aserciones de protección.
// ---------------------------------------------------------------------------------------------

const APP_DIR = fileURLToPath(new URL('../src/app/', import.meta.url))

const SAMPLE_ID = 'sample-id'
const SAMPLE_CATCHALL = 'sample-catchall'

function routeSegmentFor(dirName: string): string | null {
  // Grupos de rutas `(auth)` / `(external)`: organizan carpetas pero no aparecen en la URL, así que
  // ignorarlos no es un atajo, es la única lectura correcta del App Router.
  if (dirName.startsWith('(') && dirName.endsWith(')')) return null
  if (dirName.startsWith('_') || dirName.startsWith('@')) return null
  if (dirName.startsWith('[[...') || dirName.startsWith('[...')) return SAMPLE_CATCHALL
  if (dirName.startsWith('[') && dirName.endsWith(']')) return SAMPLE_ID
  return dirName
}

interface AppRoute {
  route: string
  kind: 'page' | 'handler'
}

function collectRoutes(dir: string, segments: readonly string[], acc: AppRoute[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const segment = routeSegmentFor(entry.name)
      const next = segment === null ? segments : [...segments, segment]
      collectRoutes(path.join(dir, entry.name), next, acc)
      continue
    }
    const route = segments.length === 0 ? '/' : `/${segments.join('/')}`
    if (entry.name === 'page.tsx' || entry.name === 'page.ts') acc.push({ route, kind: 'page' })
    if (entry.name === 'route.ts' || entry.name === 'route.tsx') acc.push({ route, kind: 'handler' })
  }
}

const allRoutes: AppRoute[] = []
collectRoutes(APP_DIR, [], allRoutes)
allRoutes.sort((a, b) => a.route.localeCompare(b.route))

const pageRoutes = allRoutes.filter((r) => r.kind === 'page').map((r) => r.route)
const handlerRoutes = allRoutes.filter((r) => r.kind === 'handler').map((r) => r.route)

// Las dos únicas páginas que pueden vivir sin sesión: la raíz (que sólo hace `redirect` a
// `/client/dashboard`, ya protegido) y el propio login. Cualquier página futura fuera de esta lista
// tiene que quedar protegida o el test de abajo se pone rojo.
const PUBLIC_PAGES = new Set(['/', '/login'])

const clientPages = pageRoutes.filter((r) => r.startsWith('/client'))
const externalApiRoutes = handlerRoutes.filter((r) => r.startsWith('/api/external'))

describe('middleware — páginas protegidas de /client', () => {
  it('encuentra las rutas reales de la app (si esto falla, el resto de tests serían vacíos)', () => {
    // Guardia contra el peor modo de fallo de una suite generada desde el filesystem: que el
    // recorrido devuelva una lista vacía y todos los `for...of` de abajo pasen sin comprobar nada.
    expect(clientPages.length).toBeGreaterThanOrEqual(6)
    expect(externalApiRoutes.length).toBeGreaterThanOrEqual(3)
  })

  it('redirige a /login toda página de /client cuando no hay cookie de sesión', () => {
    for (const route of clientPages) {
      const res = middleware(requestFor(route))
      expect(decisionOf(res), route).toBe(`REDIRECT ${ORIGIN}/login (307)`)
    }
  })

  it('el inventario de páginas es el esperado: una página nueva obliga a clasificarla', () => {
    // Canario deliberado. No comprueba comportamiento sino cobertura: si mañana aparece
    // `/client/invoices` (está en el roadmap) o —peor— una página de cliente fuera del prefijo
    // `/client`, esta igualdad exacta se rompe y obliga a decidir explícitamente si es pública o
    // protegida antes de que el cambio pase. Un test que se limitara a iterar la lista actual
    // aceptaría en silencio una página nueva colocada en un prefijo sin proteger.
    expect(pageRoutes).toEqual([
      '/',
      '/client/approvals',
      `/client/approvals/${SAMPLE_ID}`,
      '/client/brand',
      '/client/dashboard',
      '/client/projects',
      `/client/projects/${SAMPLE_ID}`,
      '/login',
    ])
    for (const route of pageRoutes) {
      const isProtected = !PUBLIC_PAGES.has(route)
      const res = middleware(requestFor(route))
      expect(isPassThrough(res), route).toBe(!isProtected)
    }
  })

  it('protege por prefijo, así que cubre rutas de /client que todavía no existen', () => {
    // `/client/invoices` es el siguiente punto del roadmap y `/client` a secas es la raíz del área.
    // Que el guard sea por prefijo y no por lista blanca de páginas es lo que hace que una página
    // nueva nazca protegida; este test fija esa propiedad para que nadie la cambie por una lista.
    for (const route of ['/client', '/client/invoices', '/client/factures/2026-07', '/client/x/y/z']) {
      const res = middleware(requestFor(route))
      expect(decisionOf(res), route).toBe(`REDIRECT ${ORIGIN}/login (307)`)
    }
  })

  it('deja pasar las páginas de /client cuando llega la cookie de sesión de desarrollo', () => {
    for (const route of clientPages) {
      const res = middleware(requestFor(route, withSession))
      expect(isPassThrough(res), route).toBe(true)
    }
  })

  it('deja pasar con la cookie __Secure- que Auth.js emite en producción sobre HTTPS', () => {
    // Este es el caso que sólo se rompe en Vercel: en local la cookie no lleva el prefijo `__Secure-`
    // y una regresión aquí pasaría todos los tests de desarrollo mientras deja el portal desplegado
    // devolviendo a `/login` a clientes perfectamente autenticados.
    const res = middleware(requestFor('/client/dashboard', [[PROD_COOKIE, TOKEN_GIVENCHY]]))
    expect(isPassThrough(res)).toBe(true)
  })

  it('redirige a /login del mismo origen, sin arrastrar la query de la petición', () => {
    // Doble propósito. Uno: el destino se construye con `new URL('/login', req.url)`, de modo que un
    // `?callbackUrl=` externo no debe poder convertir el redirect de auth en un open redirect hacia
    // otro dominio. Dos: deja constancia de que la query se pierde, es decir que el deep link a la
    // validación que el cliente venía a ver no se conserva tras iniciar sesión.
    const res = middleware(
      requestFor('/client/approvals/apr_123?callbackUrl=https://evil.tld/x&next=//evil.tld'),
    )
    const location = res.headers.get('location')
    expect(location).not.toBeNull()
    const target = new URL(location ?? '')
    expect(target.origin).toBe(ORIGIN)
    expect(target.pathname).toBe('/login')
    expect(target.search).toBe('')
    expect(res.status).toBe(307)
  })
})

describe('middleware — API del cliente (/api/external)', () => {
  it('responde 401 en français a cada route handler de /api/external sin cookie', async () => {
    for (const route of externalApiRoutes) {
      const res = middleware(requestFor(route))
      const body: unknown = await res.json()
      expect(res.status, route).toBe(401)
      expect(body, route).toEqual({ error: 'Non autorisé' })
    }
  })

  it('bloquea la API con un 401 y no con el redirect de las páginas', () => {
    // La distinción importa de verdad: un `fetch` desde el portal sigue los redirects, así que un
    // 307 a `/login` le llegaría al cliente como un 200 con HTML de login y el código de la página
    // intentaría hacer `.json()` sobre él. El 401 es lo que permite reaccionar correctamente.
    const res = middleware(requestFor('/api/external/projects'))
    expect(res.status).toBe(401)
    expect(res.headers.get('location')).toBeNull()
    expect(isPassThrough(res)).toBe(false)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('cubre por prefijo endpoints de /api/external que aún no existen', async () => {
    for (const route of ['/api/external', '/api/external/invoices', '/api/external/projects/prj_1/files']) {
      const res = middleware(requestFor(route))
      const body: unknown = await res.json()
      expect(res.status, route).toBe(401)
      expect(body, route).toEqual({ error: 'Non autorisé' })
    }
  })

  it('deja pasar /api/external cuando hay cookie, con cualquiera de los dos nombres', () => {
    for (const cookieName of [DEV_COOKIE, PROD_COOKIE]) {
      for (const route of externalApiRoutes) {
        const res = middleware(requestFor(route, [[cookieName, TOKEN_GIVENCHY]]))
        expect(isPassThrough(res), `${cookieName} ${route}`).toBe(true)
      }
    }
  })
})

describe('middleware — rutas públicas que NO pueden quedar bloqueadas', () => {
  it('no bloquea la raíz ni la página de login sin sesión', () => {
    for (const route of ['/', '/login']) {
      const res = middleware(requestFor(route))
      expect(isPassThrough(res), route).toBe(true)
    }
  })

  it('no bloquea ningún endpoint de NextAuth: bloquearlos haría imposible iniciar sesión', () => {
    // Sin estas rutas abiertas no hay forma de obtener la cookie que el propio middleware exige, con
    // lo que el portal entero quedaría inaccesible en un bucle: `/client/*` manda a `/login`, el
    // login necesita `/api/auth/*`, y `/api/auth/*` bloqueado no devuelve nunca una sesión. Se listan
    // los endpoints reales del flujo de Google OAuth, no un `/api/auth` genérico.
    const authEndpoints = [
      '/api/auth/session',
      '/api/auth/csrf',
      '/api/auth/providers',
      '/api/auth/signin',
      '/api/auth/signin/google',
      '/api/auth/callback/google',
      '/api/auth/callback/dev-login',
      '/api/auth/signout',
      '/api/auth/error',
    ]
    for (const route of authEndpoints) {
      const res = middleware(requestFor(route))
      expect(isPassThrough(res), route).toBe(true)
    }
  })

  it('no bloquea los assets internos del framework ni el favicon', () => {
    for (const route of [
      '/_next/static/chunks/main.js',
      '/_next/image?url=%2Flogo.png&w=64&q=75',
      '/favicon.ico',
      '/logo-tonalli.svg',
    ]) {
      const res = middleware(requestFor(route))
      expect(isPassThrough(res), route).toBe(true)
    }
  })

  it('la forma /_next/data de una página de cliente sí queda protegida', () => {
    // Matiz que sólo se ve mirando `NextURL`: para `/_next/data/<buildId>/client/dashboard.json`,
    // Next reescribe `nextUrl.pathname` de vuelta a `/client/dashboard` antes de que el middleware
    // lo lea. Es decir, la exención de `/_next` del bloque de rutas públicas NO abre una vía para
    // pedir el payload de una página protegida disfrazándolo de asset. Se fija porque el `startsWith
    // ('/_next')` del código invita a creer lo contrario, y porque si algún día Next dejara de
    // normalizar esa forma esto se convertiría en un bypass silencioso de todo `/client`.
    const res = middleware(requestFor('/_next/data/bId1/client/dashboard.json'))
    expect(decisionOf(res)).toBe(`REDIRECT ${ORIGIN}/login (307)`)
  })

  it('las rutas públicas siguen pasando cuando ya hay sesión, sin doble redirección', () => {
    // Con sesión activa `/login` y `/` hacen su propio `redirect` a `/client/dashboard` desde el
    // Server Component. Si el middleware metiera aquí un redirect adicional se montaría el bucle
    // clásico de portal de auth, así que se fija que no toca estas rutas en ningún caso.
    for (const route of ['/', '/login', '/api/auth/session']) {
      const res = middleware(requestFor(route, withSession))
      expect(isPassThrough(res), route).toBe(true)
    }
  })
})

describe('middleware — matcher', () => {
  it('el matcher declarado es el que estos tests asumen', () => {
    // El matcher decide si el middleware llega a correr siquiera. Cualquier cambio en él puede
    // desproteger rutas enteras sin que falle ningún test de comportamiento (el middleware seguiría
    // haciendo lo correcto... para peticiones que ya no le llegan). Por eso se congela literal.
    expect(config.matcher).toEqual(['/((?!_next/static|_next/image|favicon.ico).*)'])
  })

  it('toda página de /client y toda ruta de /api/external cae dentro del matcher', () => {
    // Este es el test que la tarea pide: una ruta de `/client` excluida del matcher sería un área
    // del portal en la que el middleware ni se ejecuta, es decir accesible sin cookie hasta que el
    // Server Component decida redirigir. Se comprueba contra el regex que compila el propio Next.
    for (const route of [...clientPages, ...externalApiRoutes, '/client', '/client/invoices']) {
      expect(isMatchedByMiddleware(route), route).toBe(true)
    }
  })

  it('sólo quedan fuera del matcher los estáticos declarados', () => {
    for (const excluded of ['/_next/static/chunks/main.js', '/_next/image', '/favicon.ico']) {
      expect(isMatchedByMiddleware(excluded), excluded).toBe(false)
    }
    for (const included of ['/', '/login', '/api/auth/session', '/_next/data/build/x.json']) {
      expect(isMatchedByMiddleware(included), included).toBe(true)
    }
  })

  it('la exclusión de estáticos sólo aplica al principio del path, no en medio', () => {
    // Si el lookahead no estuviera anclado tras la primera barra, una URL como
    // `/client/_next/static/...` se saltaría el middleware entero y serviría de vía de escape para
    // cualquier ruta protegida. Se comprueba que sí entra al matcher y que además acaba redirigida.
    expect(isMatchedByMiddleware('/client/_next/static/x.js')).toBe(true)
    expect(isMatchedByMiddleware('/client/favicon.ico')).toBe(true)
    const res = middleware(requestFor('/client/_next/static/x.js'))
    expect(decisionOf(res)).toBe(`REDIRECT ${ORIGIN}/login (307)`)
  })
})

describe('middleware — frontera de tenancy', () => {
  it('no distingue marcas: la cookie de un contacto de Cartier pasa hacia una URL de Givenchy', () => {
    // El caso cross-tenant en esta capa. El middleware no lee el JWT, no consulta la base y no sabe
    // qué `clientId` hay detrás de la cookie, así que un contacto de Cartier pidiendo el proyecto de
    // Givenchy atraviesa el middleware exactamente igual que su dueño. Esto NO es un fallo del
    // middleware —su comentario de cabecera lo declara así— pero sí es la razón por la que el filtro
    // por `session.clientId` de `getClientSession` / `getClientSessionForApi` es obligatorio y no
    // opcional: es la ÚNICA frontera entre marcas del producto. Si alguien algún día quita ese
    // filtro creyendo que "el middleware ya protege", este test es la prueba escrita de que no.
    const givenchyProject = '/client/projects/prj_givenchy_couture'
    const cartierRes = middleware(requestFor(givenchyProject, [[DEV_COOKIE, TOKEN_CARTIER]]))
    const givenchyRes = middleware(requestFor(givenchyProject, [[DEV_COOKIE, TOKEN_GIVENCHY]]))

    expect(isPassThrough(cartierRes)).toBe(true)
    expect(decisionOf(cartierRes)).toBe(decisionOf(givenchyRes))
  })

  it('la decisión depende sólo de la presencia de la cookie, nunca de su valor', () => {
    // Corolario incómodo del test anterior: un valor inventado abre las mismas puertas que un JWT
    // legítimo. Lo que impide el acceso real es que `auth()` no consiga descifrar ese token aguas
    // abajo. Se fija aquí para que el middleware no se venda nunca como control de autenticación.
    const decisions = ['', 'basura', TOKEN_CARTIER, 'null'].map((value) =>
      decisionOf(middleware(requestFor('/client/dashboard', [[DEV_COOKIE, value]]))),
    )
    expect(new Set(decisions).size).toBe(1)
    expect(decisions[0]).toBe('PASS')
  })

  it('ninguna cabecera controlada por el cliente concede paso', () => {
    // Canario: hoy el middleware sólo mira cookies. Si mañana alguien añadiese una excepción basada
    // en una cabecera (un `x-api-key`, un `authorization`, un bypass interno), esto se pondría rojo.
    // `x-middleware-subrequest` va en la lista por ser la cabecera del bypass de middleware de Next
    // (CVE-2025-29927): que el guard no la mire es exactamente lo que se quiere garantizar.
    const spoofed = new Headers({
      authorization: 'Bearer token-que-el-cliente-se-inventa',
      'x-middleware-subrequest': 'middleware',
      'x-forwarded-user': 'contact@givenchy.com',
      'x-client-id': 'clt_givenchy',
    })
    const req = new NextRequest(new URL(`${ORIGIN}/client/dashboard`), { headers: spoofed })
    expect(decisionOf(middleware(req))).toBe(`REDIRECT ${ORIGIN}/login (307)`)
  })
})

describe('middleware — huecos conocidos (canarios de comportamiento actual)', () => {
  // Los tres tests de este bloque NO describen lo que debería pasar, sino lo que pasa hoy. Están
  // escritos como canarios: si alguien corrige el middleware, se ponen rojos y hay que actualizarlos
  // —momento en el que el hueco correspondiente queda cerrado y documentado—. Se dejan fijados
  // porque un hueco silencioso es peor que un hueco con un test que lo nombra.

  it('CANARIO: el prefijo se compara sin normalizar el path (mayúsculas, percent-encoding, //)', () => {
    // `startsWith('/client')` se evalúa sobre `nextUrl.pathname` tal cual llega. `/%63lient/...`,
    // `/CLIENT/...` y `//client/...` no empiezan literalmente por `/client`, así que el middleware
    // los deja pasar. Que sean explotables depende de cómo resuelva Next esas formas a la página
    // (normaliza barras repetidas y hace matching sensible a mayúsculas), pero apoyar un control de
    // acceso en un path sin normalizar es la receta conocida de los bypass de middleware.
    for (const route of ['/CLIENT/dashboard', '/%63lient/dashboard', '//client/dashboard']) {
      const res = middleware(requestFor(route))
      expect(isPassThrough(res), route).toBe(true)
    }
    // El path con `..` sí lo normaliza el propio `URL`, así que ese vector concreto está cubierto.
    expect(decisionOf(middleware(requestFor('/client/../client/dashboard')))).toBe(
      `REDIRECT ${ORIGIN}/login (307)`,
    )
  })

  it('CANARIO: una sesión con la cookie troceada (.0/.1) se trata como no autenticada', () => {
    // Auth.js parte la cookie de sesión en `authjs.session-token.0`, `.1`, ... cuando el JWT supera
    // los 4096 bytes (perfil de Google grande, claims extra). En ese caso NO existe la cookie con el
    // nombre base, `hasSessionCookie` devuelve false y el middleware manda a `/login` a un cliente
    // que sí tiene sesión válida. Y `/login` hace `redirect('/client/dashboard')` cuando `auth()`
    // encuentra sesión —que sí la encuentra, porque Auth.js sabe recomponer los trozos—: bucle de
    // redirecciones hasta ERR_TOO_MANY_REDIRECTS. Va reportado como bug, no se corrige aquí.
    const chunked = [
      ['authjs.session-token.0', 'primera-mitad-del-jwt'],
      ['authjs.session-token.1', 'segunda-mitad-del-jwt'],
    ] as const
    expect(decisionOf(middleware(requestFor('/client/dashboard', chunked)))).toBe(
      `REDIRECT ${ORIGIN}/login (307)`,
    )
    const chunkedProd = [
      ['__Secure-authjs.session-token.0', 'primera-mitad-del-jwt'],
      ['__Secure-authjs.session-token.1', 'segunda-mitad-del-jwt'],
    ] as const
    expect(decisionOf(middleware(requestFor('/api/external/projects', chunkedProd)))).toBe(
      'BLOCK 401',
    )
  })

  it('CANARIO: las exclusiones públicas son por prefijo suelto y no por ruta exacta', () => {
    // `startsWith('/login')` y `startsWith('/api/auth')` abren también `/loginx` o `/api/authz`, y el
    // punto sin escapar de `favicon.ico` en el matcher deja fuera del middleware cualquier
    // `/faviconXico`. Hoy no existe ninguna ruta que caiga ahí, así que no hay impacto: el valor de
    // fijarlo es que el día que exista una página cuyo nombre empiece por `login` o por `api/auth`
    // nadie descubra por accidente que nació pública.
    for (const route of ['/loginzzz', '/api/authz/tokens']) {
      expect(isPassThrough(middleware(requestFor(route))), route).toBe(true)
    }
    expect(isMatchedByMiddleware('/faviconXico')).toBe(false)
  })
})
