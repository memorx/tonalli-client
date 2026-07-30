import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ClientSession } from '@/lib/external-auth'

// La ruta importa `prisma` y `getClientSessionForApi` como bindings de módulo, así que la única
// forma de observar la consulta real es interceptar esos dos módulos. Se mockea `@/lib/prisma`
// además por una razón de entorno: el cliente generado abre un pool de `pg` al importarse y
// exigiría DATABASE_URL, con lo que el simple `import` de la ruta reventaría en CI sin base.
// `vi.hoisted` es obligatorio aquí: las factories de `vi.mock` se evalúan cuando la ruta pide el
// módulo, es decir antes de que se inicialicen los const del cuerpo del archivo, y referenciar
// un const normal daría un TDZ en tiempo de import.
const mocks = vi.hoisted(() => ({
  getClientSessionForApi: vi.fn(async (..._a: unknown[]) => null as ClientSession | null),
  findMany: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
}))

vi.mock('@/lib/external-auth', () => ({
  getClientSessionForApi: mocks.getClientSessionForApi,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { project: { findMany: mocks.findMany } },
}))

const { GET } = await import('@/app/api/external/projects/route')

const CLIENT_A = 'clt_givenchy'
const CLIENT_B = 'clt_cartier'

// El fixture se teclea contra el `ClientSession` real (no contra una forma inventada) para que,
// si mañana la sesión gana un campo que la ruta pudiera usar como filtro, el typecheck lo cante
// en vez de dejar estos tests validando una sesión que ya no existe.
function sessionFor(clientId: string, clientName: string): ClientSession {
  return {
    userId: `usr_${clientId}`,
    userName: 'Contact Client',
    userEmail: `contact@${clientName.toLowerCase()}.com`,
    userImage: null,
    clientId,
    clientName,
    clientLogo: null,
  }
}

interface ProjectRow {
  id: string
  name: string
  status: string
  priority: number
  deadline: Date | null
  startDate: Date | null
  clientId: string
}

// Tabla compartida por las dos marcas: es el escenario que de verdad importa, porque un `where`
// sin `clientId` sólo se nota cuando en la tabla hay filas de otro cliente que puedan colarse.
const PROJECTS: ProjectRow[] = [
  {
    id: 'prj_a1',
    name: 'Campagne Printemps Givenchy',
    status: 'IN_PRODUCTION',
    priority: 1,
    deadline: new Date('2026-09-01T00:00:00.000Z'),
    startDate: new Date('2026-06-01T00:00:00.000Z'),
    clientId: CLIENT_A,
  },
  {
    id: 'prj_a2',
    name: 'Lookbook Couture Givenchy',
    status: 'SENT_TO_CLIENT',
    priority: 2,
    deadline: null,
    startDate: null,
    clientId: CLIENT_A,
  },
  {
    id: 'prj_b1',
    name: 'Panthère Joaillerie Cartier',
    status: 'IN_PRODUCTION',
    priority: 1,
    deadline: new Date('2026-10-15T00:00:00.000Z'),
    startDate: new Date('2026-05-02T00:00:00.000Z'),
    clientId: CLIENT_B,
  },
]

// Lee el `clientId` del `where` sin apoyarse en `any`: si la ruta dejara de mandar filtro, esto
// devuelve undefined y el fake de abajo se comporta como se comportaría Postgres — devolviendo
// todo. Ese es el mecanismo que le da dientes a los tests cross-tenant.
function whereClientIdOf(args: unknown): string | undefined {
  if (typeof args !== 'object' || args === null) return undefined
  const { where } = args as { where?: unknown }
  if (typeof where !== 'object' || where === null) return undefined
  const { clientId } = where as { clientId?: unknown }
  return typeof clientId === 'string' ? clientId : undefined
}

function selectOf(args: unknown): Record<string, unknown> | undefined {
  if (typeof args !== 'object' || args === null) return undefined
  const { select } = args as { select?: unknown }
  if (typeof select !== 'object' || select === null) return undefined
  return select as Record<string, unknown>
}

// Fake de Prisma que respeta el filtro tal cual llega. No es un stub que devuelve una lista fija:
// devolver siempre lo mismo haría que estos tests pasaran incluso con la línea del `clientId`
// borrada, que es exactamente el fallo que hay que impedir.
function fakeFindMany(...args: unknown[]): Promise<unknown[]> {
  const clientId = whereClientIdOf(args[0])
  const rows = clientId === undefined ? PROJECTS : PROJECTS.filter((p) => p.clientId === clientId)
  // Se proyecta según el `select` de la ruta para que el test note si algún día se cuela un campo
  // sensible (budget, spentBudget) en la respuesta al cliente.
  const select = selectOf(args[0])
  return Promise.resolve(
    rows.map((row) => {
      if (!select) return { ...row }
      const projected: Record<string, unknown> = {}
      for (const key of Object.keys(select)) {
        if (select[key] === true && key in row) projected[key] = row[key as keyof ProjectRow]
      }
      return projected
    })
  )
}

function idsOf(body: unknown): string[] {
  if (!Array.isArray(body)) return []
  return body
    .map((row) => (typeof row === 'object' && row !== null ? (row as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === 'string')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findMany.mockImplementation(fakeFindMany)
})

describe('GET /api/external/projects', () => {
  it('responde 401 en français y no toca la base cuando no hay sesión', async () => {
    mocks.getClientSessionForApi.mockResolvedValue(null)

    const res = await GET()
    const body: unknown = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: 'Non autorisé' })
    // Que no se llame a findMany no es cosmético: sin sesión no hay `clientId` con el que acotar,
    // así que cualquier consulta lanzada en esta rama sería por definición una consulta sin dueño.
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('consulta con el where, el select y el orderBy exactos que la ruta promete', async () => {
    mocks.getClientSessionForApi.mockResolvedValue(sessionFor(CLIENT_A, 'Givenchy'))

    await GET()

    // Igualdad exacta y no `objectContaining`: el `select` es una lista blanca y su valor está en
    // lo que NO trae. Un `budget: true` añadido de más expondría el presupuesto interno del
    // proyecto al cliente, y sólo una aserción cerrada como ésta lo detecta.
    expect(mocks.findMany).toHaveBeenCalledTimes(1)
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT_A },
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        deadline: true,
        startDate: true,
      },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
    })
  })

  it('deriva el clientId del where de la sesión y de ningún otro sitio', async () => {
    for (const [clientId, clientName] of [
      [CLIENT_A, 'Givenchy'],
      [CLIENT_B, 'Cartier'],
    ] as const) {
      mocks.findMany.mockClear()
      mocks.getClientSessionForApi.mockResolvedValue(sessionFor(clientId, clientName))

      await GET()

      // La misma ruta, dos sesiones: el filtro tiene que moverse con la sesión. Si estuviera
      // hardcodeado o cacheado entre peticiones, una de las dos iteraciones fallaría.
      expect(whereClientIdOf(mocks.findMany.mock.calls[0]?.[0])).toBe(clientId)
    }
  })

  it('con sesión de Givenchy no devuelve ni un proyecto de Cartier', async () => {
    mocks.getClientSessionForApi.mockResolvedValue(sessionFor(CLIENT_A, 'Givenchy'))

    const res = await GET()
    const body: unknown = await res.json()
    const ids = idsOf(body)

    expect(res.status).toBe(200)
    expect(ids).toEqual(['prj_a1', 'prj_a2'])
    // El peor fallo posible del producto, fijado por id y por nombre: la fuga se vería igual de
    // fea en pantalla aunque el id no se renderice nunca.
    expect(ids).not.toContain('prj_b1')
    expect(JSON.stringify(body)).not.toContain('Cartier')
  })

  it('el where de una sesión de Givenchy no puede nombrar a Cartier ni quedarse sin filtro', async () => {
    mocks.getClientSessionForApi.mockResolvedValue(sessionFor(CLIENT_A, 'Givenchy'))

    await GET()

    const args = mocks.findMany.mock.calls[0]?.[0]
    const where = (args as { where?: unknown } | undefined)?.where

    // Tres maneras distintas de perder la frontera de tenancy, negadas una por una: el filtro
    // ausente (`where` undefined), el filtro vacío (`{}`, que en Prisma trae la tabla entera) y
    // el filtro apuntando a otra marca.
    expect(where).toBeDefined()
    expect(Object.keys(where as Record<string, unknown>)).toContain('clientId')
    expect(whereClientIdOf(args)).toBe(CLIENT_A)
    expect(whereClientIdOf(args)).not.toBe(CLIENT_B)
    expect(JSON.stringify(where)).not.toContain(CLIENT_B)
  })

  it('un clientId sin proyectos devuelve 200 con lista vacía, no la de otro cliente', async () => {
    mocks.getClientSessionForApi.mockResolvedValue(sessionFor('clt_vacio', 'Balenciaga'))

    const res = await GET()
    const body: unknown = await res.json()

    // El caso vacío es donde más tienta el atajo de "si no hay nada, muestra algo": la respuesta
    // correcta es un array vacío con 200, sin 404 y sin caerse al conjunto completo.
    expect(res.status).toBe(200)
    expect(body).toEqual([])
    expect(whereClientIdOf(mocks.findMany.mock.calls[0]?.[0])).toBe('clt_vacio')
  })

  it('no acepta ningún parámetro de petición del que pudiera salir el clientId', () => {
    // Canario de firma. Hoy el handler no recibe `Request`, así que el cliente no tiene ninguna
    // superficie (query string, body, header) para influir en el filtro. Si alguien añade un
    // parámetro para leer, digamos, `?clientId=`, este test se pone rojo y obliga a revisar la
    // frontera de tenancy antes de que el cambio pase.
    expect(GET.length).toBe(0)
  })

  it('devuelve 500 genérico y no filtra el detalle del error de base de datos', async () => {
    mocks.getClientSessionForApi.mockResolvedValue(sessionFor(CLIENT_A, 'Givenchy'))
    const leak = new Error(
      'PrismaClientInitializationError: no se pudo conectar a postgres://tonalli:s3cr3t@db.supabase.co:5432/postgres — tabla "Project"'
    )
    mocks.findMany.mockRejectedValueOnce(leak)

    const res = await GET()
    const body: unknown = await res.json()
    const serialized = JSON.stringify(body)

    expect(res.status).toBe(500)
    expect(body).toEqual({ error: 'Erreur interne' })
    // Un `catch` que reenvía `error.message` es la vía habitual por la que un portal externo
    // publica su cadena de conexión y su esquema. Se niega explícitamente cada pieza.
    expect(serialized).not.toContain('postgres://')
    expect(serialized).not.toContain('s3cr3t')
    expect(serialized).not.toContain('supabase')
    expect(serialized).not.toContain('Prisma')
    expect(serialized).not.toContain('Project')
    expect(serialized).not.toContain('stack')
  })

  it('devuelve 500 sin detalles cuando es la resolución de sesión la que revienta', async () => {
    mocks.getClientSessionForApi.mockRejectedValueOnce(
      new Error('JWT_SESSION_ERROR: decryption operation failed for token de contact@givenchy.com')
    )

    const res = await GET()
    const body: unknown = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ error: 'Erreur interne' })
    expect(JSON.stringify(body)).not.toContain('givenchy.com')
    // Si la sesión no se pudo resolver, no hay `clientId`; la consulta no debe salir "por si
    // acaso". Un fallo de auth que aun así consulta es un fallo de auth que consulta sin filtro.
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('no filtra el mensaje ni cuando lo que se lanza no es un Error', async () => {
    mocks.getClientSessionForApi.mockResolvedValue(sessionFor(CLIENT_A, 'Givenchy'))
    // `catch {}` sin binding captura cualquier valor lanzado, no sólo Error. Se comprueba con un
    // string crudo porque es lo que sueltan algunas capas de driver y lo que más fácil acaba
    // interpolado en una respuesta.
    mocks.findMany.mockImplementationOnce(() =>
      Promise.reject('ECONNREFUSED 10.0.0.5:5432 role "tonalli_app"')
    )

    const res = await GET()
    const body: unknown = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ error: 'Erreur interne' })
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED')
    expect(JSON.stringify(body)).not.toContain('10.0.0.5')
  })
})
