import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientSession } from '@/lib/external-auth'

// Los mocks viven en vi.hoisted porque vi.mock se eleva por encima de cualquier
// const del módulo: si declaráramos los vi.fn como consts normales, las factories
// de abajo se ejecutarían antes de su inicialización y reventarían con
// ReferenceError. El rest param explícito (..._args: unknown[]) no es adorno:
// sin él TS infiere aridad 0 y cualquier mockImplementation con argumentos
// explota con TS2556 en el typecheck.
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(async (..._args: unknown[]): Promise<unknown> => []),
  getClientSessionForApi: vi.fn(async (..._args: unknown[]): Promise<ClientSession | null> => null),
}))

vi.mock('@/lib/prisma', () => ({ prisma: { approval: { findMany: mocks.findMany } } }))
vi.mock('@/lib/external-auth', () => ({ getClientSessionForApi: mocks.getClientSessionForApi }))

const { GET } = await import('@/app/api/external/approvals/route')

// ── Fixtures que imitan el esquema real ─────────────────────────────────────
// Se declaran como `type` y no `interface` a propósito: TS solo concede índice
// implícito de string a los alias de tipo, y el proyector `pick` necesita tratar
// las filas como Record<string, unknown> sin recurrir a casts sucios ni a any.

type ProjectRow = {
  id: string
  name: string
  clientId: string
  budget: number
  opsOwnerId: string
  dropboxFolderId: string
}

type FileRow = {
  id: string
  filename: string
  mimeType: string
  size: number
  version: number
  // El campo caliente: el esquema lo documenta como "R2 or Dropbox URL", y en
  // producción las filas viejas guardan la ruta absoluta del Dropbox del equipo.
  storageUrl: string
  thumbnailUrl: string | null
  createdAt: Date
  uploaderId: string
}

type ApprovalRow = {
  id: string
  status: string
  feedback: string | null
  reviewedAt: Date | null
  createdAt: Date
  projectId: string
  fileId: string | null
  reviewerId: string
}

const GIVENCHY = 'client-givenchy'
const CARTIER = 'client-cartier'

const PROJECTS: readonly ProjectRow[] = [
  {
    id: 'prj-giv-1',
    name: 'Campagne Printemps 2026',
    clientId: GIVENCHY,
    budget: 145000,
    opsOwnerId: 'usr-team-claire',
    dropboxFolderId: 'dbx-9911',
  },
  {
    id: 'prj-car-1',
    name: 'Panthère Haute Joaillerie',
    clientId: CARTIER,
    budget: 320000,
    opsOwnerId: 'usr-team-marc',
    dropboxFolderId: 'dbx-7742',
  },
]

const FILES: readonly FileRow[] = [
  {
    id: 'file-giv-1',
    filename: 'lookbook-printemps-v3.pdf',
    mimeType: 'application/pdf',
    size: 8_411_233,
    storageUrl: '/Bureau Tonalli/Clients/Givenchy/Campagne/lookbook-printemps-v3.pdf',
    thumbnailUrl: 'https://r2.tonalli.dev/thumbs/file-giv-1.jpg',
    version: 3,
    createdAt: new Date('2026-02-28T09:00:00.000Z'),
    uploaderId: 'usr-team-marc',
  },
  {
    id: 'file-giv-2',
    filename: 'moodboard-atelier.jpg',
    mimeType: 'image/jpeg',
    size: 2_004_112,
    storageUrl: '/Bureau Tonalli/Clients/Givenchy/Campagne/moodboard-atelier.jpg',
    thumbnailUrl: null,
    version: 1,
    createdAt: new Date('2026-02-05T09:00:00.000Z'),
    uploaderId: 'usr-team-claire',
  },
  {
    id: 'file-car-1',
    filename: 'panthere-hero-retouche.psd',
    mimeType: 'image/vnd.adobe.photoshop',
    size: 91_233_887,
    storageUrl: '/Bureau Tonalli/Clients/Cartier/Panthere/panthere-hero-retouche.psd',
    thumbnailUrl: 'https://r2.tonalli.dev/thumbs/file-car-1.jpg',
    version: 7,
    createdAt: new Date('2026-03-04T09:00:00.000Z'),
    uploaderId: 'usr-team-marc',
  },
]

const APPROVALS: readonly ApprovalRow[] = [
  {
    id: 'app-giv-pending',
    status: 'PENDING',
    feedback: null,
    reviewedAt: null,
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    projectId: 'prj-giv-1',
    fileId: 'file-giv-1',
    reviewerId: 'usr-sophie-givenchy',
  },
  {
    id: 'app-giv-approved',
    status: 'APPROVED',
    feedback: 'Parfait, on valide.',
    reviewedAt: new Date('2026-02-11T14:00:00.000Z'),
    createdAt: new Date('2026-02-10T10:00:00.000Z'),
    projectId: 'prj-giv-1',
    fileId: 'file-giv-2',
    reviewerId: 'usr-sophie-givenchy',
  },
  // La de Cartier es deliberadamente la MÁS RECIENTE: si alguien borra el filtro
  // de tenancy, el orderBy createdAt desc la empuja al primer puesto del payload
  // de Givenchy, así que el fallo es imposible de no ver.
  {
    id: 'app-car-pending',
    status: 'PENDING',
    feedback: null,
    reviewedAt: null,
    createdAt: new Date('2026-03-05T10:00:00.000Z'),
    projectId: 'prj-car-1',
    fileId: 'file-car-1',
    reviewerId: 'usr-pierre-cartier',
  },
]

// ── Fake de Prisma con comportamiento, no un mock tonto ─────────────────────
// Un mock que devuelve siempre las mismas filas no puede demostrar aislamiento
// de tenants: pasaría igual con la cláusula where borrada. Este fake se comporta
// como la base — filtra por lo que le mandan y respeta los select — de modo que
// si la ruta deja de filtrar por clientId, el fake le entrega datos de Cartier y
// el test se cae solo.

type SelectMap = Record<string, boolean>
type RelationArg = boolean | { select?: SelectMap }

type FindManyArgs = {
  where?: { status?: string; project?: { clientId?: string } }
  select?: SelectMap
  include?: { file?: RelationArg; project?: RelationArg }
  orderBy?: { createdAt?: 'asc' | 'desc' }
}

function pick(source: Record<string, unknown>, select: SelectMap | undefined): Record<string, unknown> {
  // Sin select explícito Prisma devuelve TODAS las columnas escalares. Replicarlo
  // es justo lo que convierte en detectable cualquier `file: true` descuidado.
  if (!select) return { ...source }
  const out: Record<string, unknown> = {}
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled && key in source) out[key] = source[key]
  }
  return out
}

function relation(source: Record<string, unknown> | null, arg: RelationArg | undefined): Record<string, unknown> | null {
  if (!arg || !source) return null
  return pick(source, arg === true ? undefined : arg.select)
}

async function fakeFindMany(...args: unknown[]): Promise<unknown> {
  const { where, select, include, orderBy } = (args[0] ?? {}) as FindManyArgs

  const projectOf = (row: ApprovalRow): ProjectRow => {
    const project = PROJECTS.find((p) => p.id === row.projectId)
    if (!project) throw new Error(`fixture incoherente: proyecto ${row.projectId}`)
    return project
  }

  let rows = APPROVALS.filter((row) => {
    // Si la ruta no manda clientId no filtramos: emular a la base es la única
    // forma de que el borrado del guard se vea como fuga y no como test verde.
    const tenantId = where?.project?.clientId
    if (tenantId !== undefined && projectOf(row).clientId !== tenantId) return false
    if (where?.status !== undefined && row.status !== where.status) return false
    return true
  })

  if (orderBy?.createdAt === 'desc') {
    rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  return rows.map((row) => {
    const file = FILES.find((f) => f.id === row.fileId) ?? null
    const shaped = pick(row, select)
    if (include?.file !== undefined) shaped['file'] = relation(file, include.file)
    if (include?.project !== undefined) shaped['project'] = relation(projectOf(row), include.project)
    return shaped
  })
}

function sessionFor(clientId: string, clientName: string): ClientSession {
  return {
    userId: `usr-contact-${clientId}`,
    userName: 'Sophie Laurent',
    userEmail: 'sophie@givenchy.com',
    userImage: null,
    clientId,
    clientName,
    clientLogo: null,
  }
}

function argsOfLastQuery(): FindManyArgs {
  const call = mocks.findMany.mock.calls.at(-1)
  if (!call) throw new Error('prisma.approval.findMany no fue invocado')
  return (call[0] ?? {}) as FindManyArgs
}

function rowsOf(body: unknown): Record<string, unknown>[] {
  if (!Array.isArray(body)) throw new Error(`la respuesta no es una lista: ${JSON.stringify(body)}`)
  return body as Record<string, unknown>[]
}

describe('GET /api/external/approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findMany.mockImplementation(fakeFindMany)
    mocks.getClientSessionForApi.mockResolvedValue(sessionFor(GIVENCHY, 'Givenchy'))
  })

  it('responde 401 en français y no consulta la base cuando no hay sesión de cliente', async () => {
    mocks.getClientSessionForApi.mockResolvedValue(null)

    const res = await GET()
    const body: unknown = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: 'Non autorisé' })
    // El orden importa tanto como el código: cortar ANTES de tocar Postgres es lo
    // que evita que un anónimo pueda usar el endpoint como oráculo de latencia.
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('consulta con la cláusula de tenancy exacta y nada más, una sola vez', async () => {
    await GET()

    expect(mocks.findMany).toHaveBeenCalledTimes(1)
    // toEqual profundo y no toMatchObject: si mañana aparece un where extra o la
    // anidación cambia a `projectId` suelto, queremos enterarnos aquí y no en un
    // incidente. Nótese que NO hay filtro por reviewerId — decisión de producto:
    // cualquier contacto del cliente ve todas las validaciones de su casa.
    expect(argsOfLastQuery().where).toEqual({ project: { clientId: GIVENCHY } })
  })

  it('un contacto de Givenchy no recibe ni una fila de Cartier', async () => {
    const res = await GET()
    const rows = rowsOf(await res.json())

    expect(res.status).toBe(200)
    expect(rows.map((row) => row['id'])).toEqual(['app-giv-pending', 'app-giv-approved'])
    // El barrido textual cubre lo que un assert por id no ve: nombres de proyecto,
    // ficheros o rutas de otra maison filtrándose por cualquier campo embebido.
    const payload = JSON.stringify(rows)
    expect(payload).not.toContain('Cartier')
    expect(payload).not.toContain('panthere')
    expect(payload).not.toContain('usr-pierre-cartier')
  })

  it('el mismo endpoint devuelve solo Cartier para un contacto de Cartier', async () => {
    mocks.getClientSessionForApi.mockResolvedValue(sessionFor(CARTIER, 'Cartier'))

    const res = await GET()
    const rows = rowsOf(await res.json())

    // El recíproco descarta el falso positivo del test anterior: prueba que el
    // filtro lo dicta la sesión y no un valor cableado ni un fixture afortunado.
    expect(rows.map((row) => row['id'])).toEqual(['app-car-pending'])
    expect(JSON.stringify(rows)).not.toContain('Givenchy')
    expect(argsOfLastQuery().where).toEqual({ project: { clientId: CARTIER } })
  })

  it('no acepta ningún filtro por querystring: la firma no recibe Request y la consulta no lleva status', async () => {
    // La página RSC /client/approvals sí filtra por ?status=…, pero lo hace con su
    // propio findMany. Este endpoint declara GET() sin parámetros, así que no puede
    // ni leer la URL: devuelve el listado completo y el filtrado es del consumidor.
    expect(GET.length).toBe(0)

    const res = await GET()
    const rows = rowsOf(await res.json())

    expect(argsOfLastQuery().where).not.toHaveProperty('status')
    expect(rows.map((row) => row['status'])).toEqual(['PENDING', 'APPROVED'])
  })

  it('no filtra tampoco por paginación: devuelve el histórico completo del cliente', async () => {
    await GET()
    const args = argsOfLastQuery()

    // Sin take ni skip el payload crece sin techo con los años del cliente. Se deja
    // asertado como característica conocida (reportado como hueco) para que quien
    // añada paginación tenga que pasar por aquí y decidirlo a conciencia.
    expect(args).not.toHaveProperty('take')
    expect(args).not.toHaveProperty('skip')
  })

  it('nunca expone storageUrl, ni siquiera con rutas absolutas de Dropbox en la fila', async () => {
    const res = await GET()
    const rows = rowsOf(await res.json())

    for (const row of rows) {
      const file = row['file']
      if (file !== null) expect(file).not.toHaveProperty('storageUrl')
    }
    // La ruta interna del Dropbox del equipo revela la estructura de carpetas de
    // TODOS los clientes; el fixture la lleva cargada para que la fuga sea real si
    // alguien amplía el select del fichero.
    const payload = JSON.stringify(rows)
    expect(payload).not.toContain('Bureau Tonalli/Clients')
    expect(payload).not.toContain('.psd')
  })

  it('del fichero solo salen los cuatro campos de presentación', async () => {
    const res = await GET()
    const rows = rowsOf(await res.json())

    const first = rows[0]?.['file']
    expect(first).not.toBeNull()
    expect(Object.keys(first as Record<string, unknown>).sort()).toEqual([
      'filename',
      'mimeType',
      'thumbnailUrl',
      'version',
    ])
    // uploaderId es el id del miembro del equipo que subió el archivo: nombrar a
    // quién hizo qué dentro del bureau no es información del cliente.
    expect(JSON.stringify(rows)).not.toContain('usr-team-')
  })

  it('del proyecto solo salen id y name, sin presupuesto ni responsables internos', async () => {
    const res = await GET()
    const rows = rowsOf(await res.json())

    for (const row of rows) {
      expect(Object.keys(row['project'] as Record<string, unknown>).sort()).toEqual(['id', 'name'])
    }
    // budget y opsOwnerId son los dos que más duelen: márgenes y organigrama.
    const payload = JSON.stringify(rows)
    expect(payload).not.toContain('budget')
    expect(payload).not.toContain('opsOwnerId')
    expect(payload).not.toContain('dropboxFolderId')
  })

  it('caracteriza el include sin select: el cliente recibe todas las columnas escalares de Approval', async () => {
    const res = await GET()
    const rows = rowsOf(await res.json())

    const args = argsOfLastQuery()
    expect(args.select).toBeUndefined()
    expect(args.include).toBeDefined()
    // Este test fija la superficie actual, no la bendice: la ruta usa `include` sin
    // `select` de primer nivel, así que cada columna que alguien añada al modelo
    // Approval en el esquema compartido con el portal interno viaja al cliente sin
    // que nadie lo decida. Hoy eso vuelca reviewerId; el día que entre un campo de
    // notas internas entrará igual. La lista blanca esperada se enumera aquí para
    // que ese cambio rompa este assert y obligue a revisarlo.
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      'createdAt',
      'feedback',
      'file',
      'fileId',
      'id',
      'project',
      'projectId',
      'reviewedAt',
      'reviewerId',
      'status',
    ])
  })

  it('ordena por createdAt descendente para que lo pendiente reciente vaya primero', async () => {
    const res = await GET()
    const rows = rowsOf(await res.json())

    expect(argsOfLastQuery().orderBy).toEqual({ createdAt: 'desc' })
    const dates = rows.map((row) => String(row['createdAt']))
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('traduce un fallo de la base en un 500 opaco sin filtrar el error interno', async () => {
    mocks.findMany.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED 10.0.0.4:5432 — db.supabase.co pooler'),
    )

    const res = await GET()
    const body: unknown = await res.json()

    expect(res.status).toBe(500)
    // El catch anónimo es aquí una virtud: el DSN y la IP del pooler jamás deben
    // llegar a un navegador de cliente.
    expect(body).toEqual({ error: 'Erreur interne' })
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED')
    expect(JSON.stringify(body)).not.toContain('supabase')
  })
})
