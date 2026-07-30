import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Esta ruta es la superficie de mayor riesgo del portal: es la única mutación que
 * un usuario externo puede disparar. Un contacto de Givenchy que consiga aprobar
 * o rechazar la entrega de Cartier no es un bug de UI, es una fuga de datos entre
 * marcas competidoras y una firma falsificada sobre un entregable. Por eso cada
 * bloque de aquí abajo incluye el caso cross-tenant, y por eso el doble de Prisma
 * no es un stub tonto: filtra de verdad por `project.clientId`, igual que la base.
 * Si alguien borra el scoping del `where`, el doble empieza a devolver filas de
 * otro cliente y estos tests se ponen rojos solos, sin depender de que además
 * alguien mantenga las aserciones sobre argumentos.
 */

interface ApprovalRow {
  id: string
  status: string
  feedback: string | null
  reviewedAt: Date | null
  projectId: string
  fileId: string | null
  project: { id: string; name: string; clientId: string; opsOwnerId: string }
  file: { id: string; filename: string; uploaderId: string } | null
}

interface FindFirstArgs {
  where?: { id?: string; project?: { clientId?: string } }
}

interface UpdateArgs {
  where?: { id?: string; status?: string; project?: { clientId?: string } }
  data?: { status?: string; feedback?: string | null; reviewedAt?: Date }
}

interface ActivityLogArgs {
  userId?: string
  action?: string
  projectId?: string
  details?: { approvalId?: string; filename?: string; status?: string }
}

interface NotificationEntry {
  userId?: string
  type?: string
  title?: string
  message?: string
  projectId?: string
}

const GIVENCHY = 'client-givenchy'
const CARTIER = 'client-cartier'

const OPS_OWNER = 'user-ops-camille'
const UPLOADER = 'user-retouch-hugo'

/**
 * El estado vive en `vi.hoisted` porque las factories de `vi.mock` se elevan por
 * encima de cualquier `const` normal del módulo y explotarían con TDZ si tocaran
 * bindings declarados más abajo.
 */
const store = vi.hoisted(() => ({
  rows: [] as unknown[],
  session: null as unknown,
}))

const prismaMock = vi.hoisted(() => ({
  approval: {
    /**
     * Emula el filtrado del motor SQL en lugar de devolver una fila fija. Esta es
     * la parte con dientes: la fila de Cartier existe en la "tabla", así que la
     * única razón por la que la petición de Givenchy recibe 404 es que la ruta
     * mandó `project: { clientId }` en el where. Quítalo y el doble entrega la
     * fila ajena, tal como haría Postgres.
     */
    findFirst: vi.fn(async (..._a: unknown[]) => {
      const where = (_a[0] as { where?: { id?: string; project?: { clientId?: string } } } | undefined)?.where
      const rows = store.rows as {
        id: string
        project: { clientId: string }
      }[]
      const row = rows.find((r) => r.id === where?.id)
      if (!row) return null
      const scopedTo = where?.project?.clientId
      if (scopedTo !== undefined && row.project.clientId !== scopedTo) return null
      return row
    }),
    update: vi.fn(async (..._a: unknown[]) => {
      const args = _a[0] as { where?: { id?: string }; data?: Record<string, unknown> } | undefined
      return { id: args?.where?.id, ...(args?.data ?? {}) }
    }),
  },
}))

/**
 * `logActivity` y `createNotifications` se doblan en su propia frontera en lugar
 * de dejarlos correr contra el Prisma falso. Lo que esta ruta tiene que garantizar
 * es QUÉ le pide a esos colaboradores —qué acción, a quién avisa, con qué texto—;
 * la forma de la fila que acaba en Postgres (el `channel: 'IN_APP'`, por ejemplo)
 * es responsabilidad de src/lib/notifications.ts y se prueba ahí. Atravesarlos
 * ataba además este archivo a cualquier retoque en esos módulos.
 */
const activityMock = vi.hoisted(() => ({
  logActivity: vi.fn(async (..._a: unknown[]) => undefined),
}))

const notificationsMock = vi.hoisted(() => ({
  createNotifications: vi.fn(async (..._a: unknown[]) => undefined),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/activity-log', () => activityMock)
vi.mock('@/lib/notifications', () => notificationsMock)

/**
 * `getClientSessionForApi` se dobla completo en vez de simular NextAuth: lo que
 * esta ruta tiene que respetar es la frontera `session.clientId`, y montar el
 * pipeline real de OAuth para llegar ahí sólo añadiría ruido.
 */
vi.mock('@/lib/external-auth', () => ({
  getClientSessionForApi: vi.fn(async () => store.session),
}))

const { GET, PATCH } = await import('@/app/api/external/approvals/[id]/route')

function session(clientId: string) {
  return {
    userId: 'user-contact-givenchy',
    userName: 'Camille Dubois',
    userEmail: 'camille@givenchy.example',
    userImage: null,
    clientId,
    clientName: clientId === GIVENCHY ? 'Givenchy' : 'Cartier',
    clientLogo: null,
  }
}

function approvalRow(overrides: Partial<ApprovalRow> = {}): ApprovalRow {
  const base: ApprovalRow = {
    id: 'appr-givenchy-1',
    status: 'PENDING',
    feedback: null,
    reviewedAt: null,
    projectId: 'proj-givenchy-fw26',
    fileId: 'file-1',
    project: {
      id: 'proj-givenchy-fw26',
      name: 'Campagne FW26',
      clientId: GIVENCHY,
      opsOwnerId: OPS_OWNER,
    },
    file: { id: 'file-1', filename: 'lookbook-v3.pdf', uploaderId: UPLOADER },
  }
  return { ...base, ...overrides }
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

function patchReq(body: unknown, rawBody?: string) {
  return new Request('http://localhost:3001/api/external/approvals/appr-givenchy-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: rawBody ?? JSON.stringify(body),
  })
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

function findFirstArgs(index = 0): FindFirstArgs {
  const call = prismaMock.approval.findFirst.mock.calls[index]
  if (!call) throw new Error('findFirst no fue llamado')
  return call[0] as FindFirstArgs
}

function updateArgs(): UpdateArgs {
  const call = prismaMock.approval.update.mock.calls[0]
  if (!call) throw new Error('update no fue llamado')
  return call[0] as UpdateArgs
}

function activityArgs(): ActivityLogArgs {
  const call = activityMock.logActivity.mock.calls[0]
  if (!call) throw new Error('logActivity no fue llamado')
  return call[0] as ActivityLogArgs
}

function notificationEntries(): NotificationEntry[] {
  const call = notificationsMock.createNotifications.mock.calls[0]
  if (!call) throw new Error('createNotifications no fue llamado')
  return call[0] as NotificationEntry[]
}

beforeEach(() => {
  vi.clearAllMocks()
  store.session = session(GIVENCHY)
  // La tabla arranca con una fila de cada marca: sin la fila ajena presente, el
  // test de IDOR no probaría nada — un 404 por "no existe" se confunde con un
  // 404 por "no es tuyo".
  store.rows = [
    approvalRow(),
    approvalRow({
      id: 'appr-cartier-1',
      projectId: 'proj-cartier-hiver',
      project: {
        id: 'proj-cartier-hiver',
        name: 'Panthère Hiver',
        clientId: CARTIER,
        opsOwnerId: 'user-ops-cartier',
      },
      file: { id: 'file-c1', filename: 'panthere-key-visual.tif', uploaderId: 'user-cartier-uploader' },
    }),
  ]
})

describe('GET /api/external/approvals/[id]', () => {
  it('responde 401 sin sesión y no llega a consultar la base', async () => {
    store.session = null

    const res = await GET(new Request('http://localhost:3001/x'), ctx('appr-givenchy-1'))

    expect(res.status).toBe(401)
    expect(await readJson<{ error: string }>(res)).toEqual({ error: 'Non autorisé' })
    // Que no se toque Prisma importa por sí solo: una query lanzada antes del
    // guard es una query sin tenant, y basta un error de Postgres para filtrar
    // información por el mensaje.
    expect(prismaMock.approval.findFirst).not.toHaveBeenCalled()
  })

  it('devuelve 404 —no 200 ni 403— cuando el id pertenece a otro cliente', async () => {
    const res = await GET(new Request('http://localhost:3001/x'), ctx('appr-cartier-1'))

    expect(res.status).toBe(404)
    expect(await readJson<{ error: string }>(res)).toEqual({ error: 'Introuvable' })
  })

  it('mete clientId de la sesión en el where, que es lo que hace imposible el IDOR', async () => {
    await GET(new Request('http://localhost:3001/x'), ctx('appr-cartier-1'))

    // Aserción sobre el where completo, no `objectContaining` parcial: si mañana
    // alguien mueve el filtro de tenancy a otra clave, esto se cae.
    expect(findFirstArgs().where).toEqual({
      id: 'appr-cartier-1',
      project: { clientId: GIVENCHY },
    })
  })

  it('devuelve 404 cuando el id simplemente no existe', async () => {
    const res = await GET(new Request('http://localhost:3001/x'), ctx('appr-inexistente'))

    expect(res.status).toBe(404)
  })

  it('caso feliz: 200 con la validación, su proyecto y su fichero', async () => {
    const res = await GET(new Request('http://localhost:3001/x'), ctx('appr-givenchy-1'))

    expect(res.status).toBe(200)
    const body = await readJson<{
      id: string
      status: string
      project: { id: string; name: string }
      file: { filename: string } | null
    }>(res)
    expect(body.id).toBe('appr-givenchy-1')
    expect(body.status).toBe('PENDING')
    expect(body.project.name).toBe('Campagne FW26')
    expect(body.file?.filename).toBe('lookbook-v3.pdf')
  })
})

describe('PATCH /api/external/approvals/[id] — guards', () => {
  it('responde 401 sin sesión y no muta nada', async () => {
    store.session = null

    const res = await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-givenchy-1'))

    expect(res.status).toBe(401)
    expect(prismaMock.approval.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.approval.update).not.toHaveBeenCalled()
    expect(activityMock.logActivity).not.toHaveBeenCalled()
    expect(notificationsMock.createNotifications).not.toHaveBeenCalled()
  })

  it('un cliente NO puede aprobar la entrega de otra marca: 404 y cero escrituras', async () => {
    const res = await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-cartier-1'))

    expect(res.status).toBe(404)
    expect(await readJson<{ error: string }>(res)).toEqual({ error: 'Introuvable' })
    // El 404 solo no basta como garantía: lo que no puede haber pasado es una
    // firma de Givenchy estampada sobre el entregable de Cartier.
    expect(prismaMock.approval.update).not.toHaveBeenCalled()
    expect(activityMock.logActivity).not.toHaveBeenCalled()
    expect(notificationsMock.createNotifications).not.toHaveBeenCalled()
  })

  it('tampoco puede RECHAZAR la entrega de otra marca', async () => {
    const res = await PATCH(
      patchReq({ action: 'REJECT', feedback: 'Sabotage de la concurrence' }),
      ctx('appr-cartier-1'),
    )

    expect(res.status).toBe(404)
    expect(prismaMock.approval.update).not.toHaveBeenCalled()
  })

  it('la búsqueda del PATCH va scopeada al clientId de la sesión', async () => {
    await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-cartier-1'))

    expect(findFirstArgs().where).toEqual({
      id: 'appr-cartier-1',
      project: { clientId: GIVENCHY },
    })
  })

  it('rechaza el cuerpo que no es JSON con 400 y sin tocar la base', async () => {
    const res = await PATCH(patchReq(null, 'ceci nest pas du json'), ctx('appr-givenchy-1'))

    expect(res.status).toBe(400)
    expect(prismaMock.approval.findFirst).not.toHaveBeenCalled()
  })

  it('rechaza una acción fuera del enum con 400 y código de validación', async () => {
    const res = await PATCH(patchReq({ action: 'DELETE_EVERYTHING' }), ctx('appr-givenchy-1'))

    expect(res.status).toBe(400)
    expect(await readJson<{ code?: string }>(res)).toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(prismaMock.approval.update).not.toHaveBeenCalled()
  })

  it('REJECT sin feedback es 400: un rechazo mudo deja al equipo sin nada que corregir', async () => {
    const res = await PATCH(patchReq({ action: 'REJECT' }), ctx('appr-givenchy-1'))

    expect(res.status).toBe(400)
    expect(await readJson<{ error: string }>(res)).toEqual({
      error: 'Le commentaire est requis pour demander des modifications',
    })
    expect(prismaMock.approval.update).not.toHaveBeenCalled()
  })

  it('REJECT con feedback en blanco también es 400 (whitespace no es un comentario)', async () => {
    const res = await PATCH(patchReq({ action: 'REJECT', feedback: '   \n\t  ' }), ctx('appr-givenchy-1'))

    expect(res.status).toBe(400)
    expect(prismaMock.approval.update).not.toHaveBeenCalled()
  })

  it('APPROVE sí puede venir sin feedback', async () => {
    const res = await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-givenchy-1'))

    expect(res.status).toBe(200)
  })

  it('una validación ya APPROVED no se re-procesa: 400 y ni update ni notificaciones', async () => {
    store.rows = [approvalRow({ status: 'APPROVED', reviewedAt: new Date('2026-07-01T10:00:00Z') })]

    const res = await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-givenchy-1'))

    expect(res.status).toBe(400)
    expect(await readJson<{ error: string }>(res)).toEqual({
      error: 'Cette validation a déjà été traitée',
    })
    // Sin este guard, un doble clic reescribe `reviewedAt` y vuelve a notificar
    // al equipo por algo que ya cerraron.
    expect(prismaMock.approval.update).not.toHaveBeenCalled()
    expect(notificationsMock.createNotifications).not.toHaveBeenCalled()
  })

  it('una validación ya en REVISION_REQUESTED tampoco se puede aprobar después', async () => {
    store.rows = [approvalRow({ status: 'REVISION_REQUESTED', feedback: 'Trop saturé' })]

    const res = await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-givenchy-1'))

    expect(res.status).toBe(400)
    expect(prismaMock.approval.update).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/external/approvals/[id] — mutación', () => {
  it('APPROVE escribe exactamente "APPROVED", feedback null y reviewedAt', async () => {
    const antes = Date.now()
    const res = await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-givenchy-1'))
    const despues = Date.now()

    expect(res.status).toBe(200)
    const args = updateArgs()
    // Sólo el id: hoy el `update` no vuelve a filtrar por clientId ni por status,
    // se apoya entero en el `findFirst` anterior. Se comprueba el id y nada más
    // para no cementar esa debilidad — si alguien endurece el where, este test
    // sigue verde (y ese endurecimiento va reportado como hallazgo aparte).
    expect(args.where?.id).toBe('appr-givenchy-1')
    // `Approval.status` es un String pelado en el esquema compartido (el enum vive
    // en un comentario), así que la base no rechaza nada: el único sitio donde ese
    // vocabulario existe de verdad es esta línea y la del portal interno que lo lee.
    expect(args.data?.status).toBe('APPROVED')
    expect(args.data?.feedback).toBeNull()
    expect(args.data?.reviewedAt).toBeInstanceOf(Date)
    const reviewedAt = args.data?.reviewedAt as Date
    expect(reviewedAt.getTime()).toBeGreaterThanOrEqual(antes)
    expect(reviewedAt.getTime()).toBeLessThanOrEqual(despues)
  })

  it('REJECT escribe "REVISION_REQUESTED" —no "REJECTED"— y conserva el feedback literal', async () => {
    const feedback = "Le logo doit être blanc sur l'image 4, pas doré."

    const res = await PATCH(patchReq({ action: 'REJECT', feedback }), ctx('appr-givenchy-1'))

    expect(res.status).toBe(200)
    const args = updateArgs()
    // El comentario del esquema lista también "REJECTED", que resulta el nombre
    // más obvio para un rechazo y por eso es la confusión que hay que blindar:
    // esta ruta escribe REVISION_REQUESTED, y como la columna es texto libre, un
    // cambio a REJECTED no fallaría en ninguna parte — sólo dejaría de coincidir
    // con lo que el portal interno consulta, y las entregas rechazadas
    // desaparecerían de su cola en silencio.
    expect(args.data?.status).toBe('REVISION_REQUESTED')
    expect(args.data?.status).not.toBe('REJECTED')
    expect(args.data?.feedback).toBe(feedback)
    expect(args.data?.reviewedAt).toBeInstanceOf(Date)
  })

  it('devuelve al cliente la fila actualizada, no la vieja', async () => {
    const res = await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-givenchy-1'))

    const body = await readJson<{ id: string; status: string }>(res)
    expect(body.id).toBe('appr-givenchy-1')
    expect(body.status).toBe('APPROVED')
  })
})

describe('PATCH /api/external/approvals/[id] — trazabilidad y avisos', () => {
  it('APPROVE deja rastro en ActivityLog con el usuario, el proyecto y el fichero', async () => {
    await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-givenchy-1'))

    const args = activityArgs()
    // El log es la única prueba de quién firmó la entrega: el `reviewerId` de la
    // fila lo puso el equipo interno al crear la validación y esta ruta no lo
    // reescribe, así que sin este registro no queda constancia del autor real.
    expect(args.userId).toBe('user-contact-givenchy')
    expect(args.action).toBe('APPROVAL_APPROVED')
    expect(args.projectId).toBe('proj-givenchy-fw26')
    expect(args.details).toMatchObject({
      approvalId: 'appr-givenchy-1',
      filename: 'lookbook-v3.pdf',
      status: 'APPROVED',
    })
  })

  it('REJECT deja rastro con acción APPROVAL_REJECTED y el status nuevo', async () => {
    await PATCH(patchReq({ action: 'REJECT', feedback: 'Recadrage à revoir' }), ctx('appr-givenchy-1'))

    const args = activityArgs()
    expect(args.action).toBe('APPROVAL_REJECTED')
    expect(args.details).toMatchObject({ status: 'REVISION_REQUESTED' })
  })

  it('notifica al opsOwner del proyecto Y al uploader del fichero', async () => {
    await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-givenchy-1'))

    const rows = notificationEntries()
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.userId).sort()).toEqual([OPS_OWNER, UPLOADER].sort())
    for (const row of rows) {
      expect(row.type).toBe('APPROVAL_APPROVED')
      expect(row.projectId).toBe('proj-givenchy-fw26')
      expect(row.title).toBe('Validation approuvée — Campagne FW26')
      expect(row.message).toContain('Camille Dubois')
    }
  })

  it('no duplica el aviso cuando el opsOwner es también quien subió el fichero', async () => {
    store.rows = [
      approvalRow({
        file: { id: 'file-1', filename: 'lookbook-v3.pdf', uploaderId: OPS_OWNER },
      }),
    ]

    await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-givenchy-1'))

    const rows = notificationEntries()
    // El Set de la ruta es lo que evita que una sola persona reciba dos veces el
    // mismo aviso; en un equipo pequeño coordinar y subir suele ser la misma mano.
    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(OPS_OWNER)
  })

  it('con una validación sin fichero adjunto avisa sólo al opsOwner', async () => {
    store.rows = [approvalRow({ fileId: null, file: null })]

    await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-givenchy-1'))

    const rows = notificationEntries()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(OPS_OWNER)
  })

  it('el aviso de REJECT lleva el feedback del cliente para que el equipo sepa qué corregir', async () => {
    await PATCH(
      patchReq({ action: 'REJECT', feedback: 'Le grain est trop marqué sur la 2' }),
      ctx('appr-givenchy-1'),
    )

    const rows = notificationEntries()
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.type).toBe('APPROVAL_REJECTED')
      expect(row.title).toBe('Modifications demandées — Campagne FW26')
      expect(row.message).toContain('Le grain est trop marqué sur la 2')
    }
  })

  it('nunca notifica a gente de la otra marca cuando el 404 corta la petición', async () => {
    await PATCH(patchReq({ action: 'APPROVE' }), ctx('appr-cartier-1'))

    expect(notificationsMock.createNotifications).not.toHaveBeenCalled()
  })
})
