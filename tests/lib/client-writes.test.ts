import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientSession } from '@/lib/external-auth'
import type { ActivityAction } from '@/lib/activity-log'
import type { NotificationType } from '@/lib/notifications'

/**
 * activity-log y notifications son los ÚNICOS puntos donde el portal del
 * cliente escribe en tablas que el portal interno lee. No hay API entre los dos
 * productos: el contrato es la fila. Por eso lo que se asevera aquí no son
 * valores de retorno sino el objeto exacto que se le entrega a Prisma — si una
 * columna cambia de nombre, si aparece una que el esquema del cliente no
 * declara, o si un `action` se renombra a algo que el interno no sabe pintar,
 * el fallo no se ve en este repo: se ve en el bell de Mar y en el historial de
 * Alonso, en producción y sin traza.
 */

interface ApprovalRow {
  id: string
  status: string
  project: { id: string; name: string; opsOwnerId: string }
  file: { uploaderId: string; filename: string } | null
}

/**
 * Copia congelada del catálogo del repo interno
 * (bureau-tonalli/src/lib/activity-log.ts y notifications.ts, jul 2026).
 * Está inlineada a propósito: no se puede importar entre repos, y un import
 * relativo a ../../bureau-tonalli haría que la suite dependiera de que el repo
 * hermano esté clonado al lado, cosa que en CI no se cumple. El precio es
 * mantenerla a mano; el beneficio es que ampliar el union de este repo sin
 * ampliar el del otro pone la suite roja en vez de escribir en la tabla
 * compartida un string que el interno recibe pero no sabe interpretar.
 */
const INTERNAL_ACTIVITY_ACTIONS = [
  'PROJECT_CREATED',
  'STATUS_CHANGED',
  'TASK_CREATED',
  'TASK_STATUS_CHANGED',
  'VALIDATION_APPROVED',
  'VALIDATION_REJECTED',
  'PROJECT_UPDATED',
  'FILE_UPLOADED',
  'TASK_FILE_UPLOADED',
  'PROJECT_ASSET_UPLOADED',
  'APPROVAL_CREATED',
  'APPROVAL_APPROVED',
  'APPROVAL_REJECTED',
  'PROJECT_FILE_FINALIZED',
  'PROJECT_FILE_FINALIZE_FAILED',
  'USER_ROLE_CHANGED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'USER_UPDATED',
  'USER_DELETED',
  'DROPBOX_BASE_FOLDER_FAILED',
  'DROPBOX_CLIENT_FOLDER_FAILED',
  'DROPBOX_FOLDER_FAILED',
  'DROPBOX_FOLDER_RETRIED',
  'DROPBOX_SHOT_CREATED',
  'TASK_PRODUCTION_FOLDERS_CREATED',
  'CLIENT_CREATED',
  'CLIENT_CONTACT_INVITED',
  'TASK_FILE_VERSION_RACE_FAILED',
] as const

const INTERNAL_NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'VALIDATION_PENDING',
  'VALIDATION_APPROVED',
  'VALIDATION_REJECTED',
  'PROJECT_GATE_ADVANCED',
  'PROJECT_READY_FINAL',
  'FILE_READY',
  'APPROVAL_REQUESTED',
  'APPROVAL_APPROVED',
  'APPROVAL_REJECTED',
  'PROJECT_UPDATE',
  'COMMENT_REPLY',
  'PROJECT_COMPLETE',
  'INVOICE_SENT',
  'WHATSAPP_MESSAGE',
  'DEADLINE_WARNING',
  'DM_RECEIVED',
  'TASK_UNBLOCKED',
] as const

/**
 * Enumeración a mano del union de ESTE repo. Los tipos se borran en runtime,
 * así que sin esta lista no hay forma de comprobar el union completo — sólo los
 * dos valores que la ruta usa hoy, que es justamente lo que no protege contra
 * el valor nuevo que alguien añada mañana.
 *
 * Van `as const` a propósito y SIN anotar `readonly ActivityAction[]`: esa
 * anotación ensancha el tipo del array al union entero y deja el `Exclude` de
 * abajo en `never` pase lo que pase, o sea una comprobación que siempre pasa.
 * La sincronía se fuerza con los dos alias de tipo del final, que son la mitad
 * que compila del contrato.
 */
const CLIENT_ACTIVITY_ACTIONS = [
  'PROJECT_CREATED',
  'STATUS_CHANGED',
  'TASK_CREATED',
  'TASK_STATUS_CHANGED',
  'VALIDATION_APPROVED',
  'VALIDATION_REJECTED',
  'PROJECT_UPDATED',
  'FILE_UPLOADED',
  'APPROVAL_CREATED',
  'APPROVAL_APPROVED',
  'APPROVAL_REJECTED',
] as const

const CLIENT_NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'VALIDATION_PENDING',
  'VALIDATION_APPROVED',
  'VALIDATION_REJECTED',
  'PROJECT_GATE_ADVANCED',
  'PROJECT_READY_FINAL',
  'FILE_READY',
  'APPROVAL_REQUESTED',
  'APPROVAL_APPROVED',
  'APPROVAL_REJECTED',
  'PROJECT_UPDATE',
  'COMMENT_REPLY',
  'PROJECT_COMPLETE',
] as const

/**
 * Los cuatro alias siguientes no generan código: son el test que corre en
 * `tsc --noEmit`, no en vitest. `AssertNever` falla a compilar si el union de
 * producción crece y la lista de aquí no (el `Exclude` deja de ser `never`), y
 * `AssertAssignable` falla si la lista crece y el union no. Sin este par, el
 * bucle de runtime de más abajo comprobaría una lista congelada en el pasado y
 * un valor nuevo en activity-log.ts se escaparía al portal interno sin que
 * nada se pusiera rojo — que es exactamente el fallo que estas pruebas existen
 * para atrapar.
 */
type AssertNever<T extends never> = T
type AssertAssignable<T extends U, U> = T

type _ClientActivityActionsAreReal = AssertAssignable<
  (typeof CLIENT_ACTIVITY_ACTIONS)[number],
  ActivityAction
>
type _ActivityUnionFullyListed = AssertNever<
  Exclude<ActivityAction, (typeof CLIENT_ACTIVITY_ACTIONS)[number]>
>
type _ClientNotificationTypesAreReal = AssertAssignable<
  (typeof CLIENT_NOTIFICATION_TYPES)[number],
  NotificationType
>
type _NotificationUnionFullyListed = AssertNever<
  Exclude<NotificationType, (typeof CLIENT_NOTIFICATION_TYPES)[number]>
>

/**
 * Las columnas que EXISTEN en las dos copias del esquema. El interno además
 * tiene taskId, readAt y metadata en Notification; el esquema de este repo no
 * los declara (prisma/schema.prisma:394), así que escribirlos desde aquí
 * revienta contra el cliente Prisma generado en local. Congelar el juego de
 * llaves es lo que convierte ese desfase en una prueba y no en un incidente.
 */
const SHARED_NOTIFICATION_COLUMNS = ['userId', 'type', 'title', 'message', 'channel', 'projectId']
const SHARED_ACTIVITY_COLUMNS = ['userId', 'action', 'projectId', 'details']

const GIVENCHY = 'client-givenchy'
const CARTIER = 'client-cartier'

const ROWS: (ApprovalRow & { ownerClientId: string })[] = [
  {
    id: 'appr-givenchy-1',
    ownerClientId: GIVENCHY,
    status: 'PENDING',
    project: { id: 'proj-givenchy', name: 'Givenchy — Irrésistible', opsOwnerId: 'user-mar' },
    file: { uploaderId: 'user-paul', filename: 'irresistible_v3.mp4' },
  },
  {
    id: 'appr-cartier-1',
    ownerClientId: CARTIER,
    status: 'PENDING',
    project: { id: 'proj-cartier', name: 'Cartier — Panthère', opsOwnerId: 'user-mar' },
    file: { uploaderId: 'user-remy', filename: 'panthere_v7.mp4' },
  },
]

const h = vi.hoisted(() => ({
  activityLogCreate: vi.fn(async (..._a: unknown[]) => ({ id: 'log-1' })),
  notificationCreate: vi.fn(async (..._a: unknown[]) => ({ id: 'notif-1' })),
  notificationCreateMany: vi.fn(async (..._a: unknown[]) => ({ count: 0 })),
  approvalFindFirst: vi.fn(async (..._a: unknown[]) => null as ApprovalRow | null),
  approvalUpdate: vi.fn(async (..._a: unknown[]) => ({ id: 'appr-givenchy-1', status: 'APPROVED' })),
  getClientSessionForApi: vi.fn(async (..._a: unknown[]) => null as ClientSession | null),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    activityLog: { create: h.activityLogCreate },
    notification: { create: h.notificationCreate, createMany: h.notificationCreateMany },
    approval: { findFirst: h.approvalFindFirst, update: h.approvalUpdate },
  },
}))

vi.mock('@/lib/external-auth', () => ({
  getClientSessionForApi: h.getClientSessionForApi,
}))

const { logActivity } = await import('@/lib/activity-log')
const { createNotification, createNotifications } = await import('@/lib/notifications')
const { PATCH } = await import('@/app/api/external/approvals/[id]/route')

interface CreateArg {
  data: Record<string, unknown>
}
interface CreateManyArg {
  data: Record<string, unknown>[]
}
interface FindFirstArg {
  where?: { id?: string; project?: { clientId?: string } }
}

function lastCreateArg(fn: typeof h.activityLogCreate | typeof h.notificationCreate): CreateArg {
  const calls = fn.mock.calls
  return calls[calls.length - 1]?.[0] as CreateArg
}

function lastCreateManyArg(): CreateManyArg {
  const calls = h.notificationCreateMany.mock.calls
  return calls[calls.length - 1]?.[0] as CreateManyArg
}

function session(clientId: string, userId: string, userName: string): ClientSession {
  return {
    userId,
    userName,
    userEmail: `${userId}@maison.example`,
    userImage: null,
    clientId,
    clientName: clientId,
    clientLogo: null,
  }
}

function patchRequest(body: unknown): Request {
  return new Request('http://localhost:3001/api/external/approvals/x', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()

  h.activityLogCreate.mockImplementation(async (..._a: unknown[]) => ({ id: 'log-1' }))
  h.notificationCreate.mockImplementation(async (..._a: unknown[]) => ({ id: 'notif-1' }))
  h.notificationCreateMany.mockImplementation(async (..._a: unknown[]) => ({ count: 0 }))
  h.approvalUpdate.mockImplementation(async (..._a: unknown[]) => ({
    id: 'appr-givenchy-1',
    status: 'APPROVED',
  }))

  /**
   * El doble de findFirst EMULA el scoping de Postgres en vez de asumirlo: la
   * fila sólo sale si el where trae el clientId de su dueño real. Si alguien
   * borra `project: { clientId: session.clientId }` de la ruta, el where llega
   * sin filtro, el doble entrega la fila de Cartier y la prueba cross-tenant se
   * pone roja — que es el único diseño en el que esa prueba demuestra algo. Un
   * mock que devolviera siempre null pasaría igual con la ruta rota.
   */
  h.approvalFindFirst.mockImplementation(async (...args: unknown[]) => {
    const where = (args[0] as FindFirstArg | undefined)?.where
    const row = ROWS.find((r) => r.id === where?.id)
    if (!row) return null
    const scoped = where?.project?.clientId
    if (scoped !== undefined && scoped !== row.ownerClientId) return null
    return row
  })
})

describe('logActivity — la fila que el historial del portal interno lee', () => {
  it('escribe userId, action, projectId y details con esos nombres exactos', async () => {
    await logActivity({
      userId: 'user-contact-givenchy',
      action: 'APPROVAL_APPROVED',
      projectId: 'proj-givenchy',
      details: { approvalId: 'appr-givenchy-1', filename: 'irresistible_v3.mp4' },
    })

    expect(h.activityLogCreate).toHaveBeenCalledTimes(1)
    expect(lastCreateArg(h.activityLogCreate).data).toEqual({
      userId: 'user-contact-givenchy',
      action: 'APPROVAL_APPROVED',
      projectId: 'proj-givenchy',
      details: { approvalId: 'appr-givenchy-1', filename: 'irresistible_v3.mp4' },
    })
  })

  it('no manda al payload ninguna columna fuera de las cuatro compartidas', async () => {
    await logActivity({ userId: 'user-contact-givenchy', action: 'APPROVAL_REJECTED' })

    // El interno indexa por projectId/userId/createdAt y no tiene más columnas
    // en ActivityLog; una llave extra aquí sería un P2022 al primer rechazo de
    // un cliente, en la ruta que menos se puede permitir fallar.
    expect(Object.keys(lastCreateArg(h.activityLogCreate).data).sort()).toEqual(
      [...SHARED_ACTIVITY_COLUMNS].sort(),
    )
  })

  it('deja details en undefined, nunca en null, cuando el caller no manda nada', async () => {
    await logActivity({ userId: 'user-contact-givenchy', action: 'APPROVAL_REJECTED' })

    // details es Json? y Prisma 7 distingue undefined (omitir la columna) de
    // null (que exige DbNull/JsonNull explícito y si no lanza). El `?? undefined`
    // del módulo es lo único que sostiene esa distinción.
    const { data } = lastCreateArg(h.activityLogCreate)
    expect(data['details']).toBeUndefined()
    expect(data['details']).not.toBeNull()
  })

  it('devuelve la fila creada en vez de disparar y olvidar', async () => {
    // Un `void prisma.activityLog.create(...)` sin await pasaría los asserts de
    // forma pero dejaría al caller sin manera de saber que la auditoría no se
    // escribió. El valor de retorno es lo que obliga a que el helper siga
    // siendo esperable.
    await expect(
      logActivity({ userId: 'user-contact-givenchy', action: 'APPROVAL_APPROVED' }),
    ).resolves.toEqual({ id: 'log-1' })
  })

  it('todo el union ActivityAction de este repo existe en el catálogo del interno', async () => {
    // `action` es String en la tabla, no enum: Postgres acepta cualquier cosa.
    // El único filtro es que los dos repos usen el mismo vocabulario, y como
    // ActivityFilters del interno lista sus acciones a mano, un valor que sólo
    // exista de este lado se guarda bien y desaparece de la UI del equipo.
    for (const action of CLIENT_ACTIVITY_ACTIONS) {
      expect(INTERNAL_ACTIVITY_ACTIONS as readonly string[]).toContain(action)
    }
  })

  it('las dos acciones que este portal escribe de verdad llegan tal cual al payload', async () => {
    // Único escritor real: el PATCH de aprobaciones. Si alguien las renombra a
    // algo "más claro" (CLIENT_APPROVED, p.ej.) el insert seguiría funcionando
    // y el historial del interno se quedaría mudo.
    for (const action of ['APPROVAL_APPROVED', 'APPROVAL_REJECTED'] as const) {
      await logActivity({ userId: 'user-contact-givenchy', action, projectId: 'proj-givenchy' })
      expect(lastCreateArg(h.activityLogCreate).data['action']).toBe(action)
    }
  })
})

describe('createNotifications — el lote vacío', () => {
  it('con una lista vacía no toca la base en absoluto', async () => {
    const result = await createNotifications([])

    // createMany con data: [] es una ida a Postgres para no escribir nada, y en
    // la ruta de aprobaciones el lote se arma desde un Set que queda vacío si
    // el proyecto no tiene opsOwner ni uploader. El guard evita pagar ese
    // round-trip en cada aprobación.
    expect(h.notificationCreateMany).not.toHaveBeenCalled()
    expect(h.notificationCreate).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('con un solo destinatario sí llama createMany una única vez', async () => {
    // Control positivo del guard: sin este caso, un `return` incondicional al
    // principio de la función dejaría verde la prueba de arriba.
    await createNotifications([
      {
        userId: 'user-mar',
        type: 'APPROVAL_APPROVED',
        title: 'Validation approuvée',
        message: 'ok',
        projectId: 'proj-givenchy',
      },
    ])

    expect(h.notificationCreateMany).toHaveBeenCalledTimes(1)
    expect(lastCreateManyArg().data).toHaveLength(1)
  })
})

describe('createNotifications — la forma del lote que alimenta el bell del interno', () => {
  it('escribe una fila por destinatario, con channel IN_APP y sólo columnas compartidas', async () => {
    await createNotifications([
      {
        userId: 'user-mar',
        type: 'APPROVAL_APPROVED',
        title: 'Validation approuvée — Givenchy',
        message: 'Le contact a approuvé un fichier',
        projectId: 'proj-givenchy',
      },
      {
        userId: 'user-paul',
        type: 'APPROVAL_APPROVED',
        title: 'Validation approuvée — Givenchy',
        message: 'Le contact a approuvé un fichier',
        projectId: 'proj-givenchy',
      },
    ])

    const { data } = lastCreateManyArg()
    expect(data).toHaveLength(2)
    expect(data.map((row) => row['userId'])).toEqual(['user-mar', 'user-paul'])
    for (const row of data) {
      // channel es String libre en la tabla: 'in_app' o 'InApp' pasarían el
      // insert y luego desaparecerían del filtro del interno, que consulta por
      // el literal IN_APP.
      expect(row['channel']).toBe('IN_APP')
      expect(Object.keys(row).sort()).toEqual([...SHARED_NOTIFICATION_COLUMNS].sort())
    }
  })

  it('deja projectId en undefined cuando el caller no lo manda, sin inventar null', async () => {
    await createNotifications([
      { userId: 'user-mar', type: 'APPROVAL_APPROVED', title: 't', message: 'm' },
    ])

    // projectId es la única columna opcional del lote y el bell del interno la
    // usa para construir el deep-link; un null explícito y un undefined acaban
    // igual en la fila, pero el mapeo tiene que seguir emitiendo la llave para
    // que el juego de columnas de arriba siga siendo comprobable.
    const row = lastCreateManyArg().data[0]
    expect(row?.['projectId']).toBeUndefined()
    expect(Object.keys(row ?? {}).sort()).toEqual([...SHARED_NOTIFICATION_COLUMNS].sort())
  })

  it('no deduplica ni reordena: eso es responsabilidad del caller', async () => {
    // La ruta deduplica con un Set antes de llamar (opsOwner y uploader suelen
    // ser la misma persona en proyectos chicos). Si el helper empezara a
    // deduplicar por su cuenta, un caller futuro que sí quiera dos filas para
    // el mismo usuario perdería una sin enterarse.
    await createNotifications([
      { userId: 'user-mar', type: 'APPROVAL_APPROVED', title: 'a', message: 'm' },
      { userId: 'user-mar', type: 'APPROVAL_REJECTED', title: 'b', message: 'm' },
    ])

    const { data } = lastCreateManyArg()
    expect(data).toHaveLength(2)
    expect(data.map((row) => row['type'])).toEqual(['APPROVAL_APPROVED', 'APPROVAL_REJECTED'])
  })

  it('todo el union NotificationType de este repo existe en el catálogo del interno', async () => {
    // Mismo razonamiento que con ActivityAction: `type` es String en la tabla y
    // el interno enruta por ese literal en NOTIFICATION_ROUTING y lo traduce
    // por clave en messages/fr.json. Un tipo que sólo exista aquí se guarda y
    // se pinta sin etiqueta.
    for (const type of CLIENT_NOTIFICATION_TYPES) {
      expect(INTERNAL_NOTIFICATION_TYPES as readonly string[]).toContain(type)
    }
  })

  it('createNotification suelto usa el mismo channel y las mismas columnas', async () => {
    await createNotification({
      userId: 'user-mar',
      type: 'APPROVAL_REJECTED',
      title: 'Modifications demandées',
      message: 'feedback',
      projectId: 'proj-givenchy',
    })

    const { data } = lastCreateArg(h.notificationCreate)
    expect(data['channel']).toBe('IN_APP')
    expect(Object.keys(data).sort()).toEqual([...SHARED_NOTIFICATION_COLUMNS].sort())
  })
})

describe('notificaciones — el fallo se propaga, no se traga', () => {
  it('createNotifications rechaza cuando createMany rechaza', async () => {
    h.notificationCreateMany.mockImplementation(async (..._a: unknown[]) => {
      throw new Error('P1001: no se pudo llegar a la base')
    })

    // El módulo no tiene try/catch a propósito: quien decide si un fallo de
    // notificación es fatal es el caller, no el helper. Si alguien mete aquí un
    // catch —o suelta el `return` y lo deja fire-and-forget— el interno dejaría
    // de recibir avisos de aprobación sin que nada se queje en ninguna parte.
    await expect(
      createNotifications([{ userId: 'user-mar', type: 'APPROVAL_APPROVED', title: 't', message: 'm' }]),
    ).rejects.toThrow('P1001')
  })

  it('createNotification rechaza cuando create rechaza', async () => {
    h.notificationCreate.mockImplementation(async (..._a: unknown[]) => {
      throw new Error('P2003: userId inexistente')
    })

    await expect(
      createNotification({ userId: 'fantasma', type: 'APPROVAL_APPROVED', title: 't', message: 'm' }),
    ).rejects.toThrow('P2003')
  })

  it('logActivity rechaza cuando activityLog.create rechaza', async () => {
    h.activityLogCreate.mockImplementation(async (..._a: unknown[]) => {
      throw new Error('P2003: projectId inexistente')
    })

    await expect(
      logActivity({ userId: 'user-contact-givenchy', action: 'APPROVAL_APPROVED', projectId: 'nope' }),
    ).rejects.toThrow('P2003')
  })
})

describe('PATCH /api/external/approvals/[id] — la frontera de tenancy sobre las tablas compartidas', () => {
  it('un contacto de Givenchy que aprueba una validación de Cartier recibe 404 y no escribe NADA', async () => {
    h.getClientSessionForApi.mockImplementation(async (..._a: unknown[]) =>
      session(GIVENCHY, 'user-contact-givenchy', 'Contact Givenchy'),
    )

    const res = await PATCH(patchRequest({ action: 'APPROVE' }), {
      params: Promise.resolve({ id: 'appr-cartier-1' }),
    })

    expect(res.status).toBe(404)
    // Lo grave no es el status: es que un intento cross-tenant no deje rastro
    // en tablas que el equipo interno mira. Una fila de activityLog con el
    // userId de Givenchy colgada del proyecto de Cartier ya filtra que ese
    // proyecto existe, y una notificación al opsOwner sería la filtración
    // completa, con el nombre del proyecto ajeno en el título.
    expect(h.activityLogCreate).not.toHaveBeenCalled()
    expect(h.notificationCreateMany).not.toHaveBeenCalled()
    expect(h.notificationCreate).not.toHaveBeenCalled()
    expect(h.approvalUpdate).not.toHaveBeenCalled()

    // Y el filtro tiene que ir en el WHERE, no en un if posterior al read:
    // leer la fila ajena y descartarla en memoria ya es acceso concedido.
    const where = (h.approvalFindFirst.mock.calls[0]?.[0] as FindFirstArg | undefined)?.where
    expect(where?.project?.clientId).toBe(GIVENCHY)
  })

  it('sobre su propia validación sí escribe, con el userId de la sesión y no el del proyecto', async () => {
    h.getClientSessionForApi.mockImplementation(async (..._a: unknown[]) =>
      session(GIVENCHY, 'user-contact-givenchy', 'Camille Rousseau'),
    )

    const res = await PATCH(patchRequest({ action: 'APPROVE' }), {
      params: Promise.resolve({ id: 'appr-givenchy-1' }),
    })

    // Control positivo del doble: sin este caso, el 404 de arriba podría venir
    // de un mock que nunca devuelve nada y la prueba cross-tenant sería humo.
    expect(res.status).toBe(200)

    const logged = lastCreateArg(h.activityLogCreate).data
    expect(logged['userId']).toBe('user-contact-givenchy')
    expect(logged['action']).toBe('APPROVAL_APPROVED')
    expect(logged['projectId']).toBe('proj-givenchy')

    // Destinatarios: coordinador del proyecto y quien subió el archivo, sin
    // duplicados. Deduplicar importa porque en proyectos donde Mar sube el
    // archivo ella es las dos cosas y el bell mostraría el aviso dos veces.
    const { data } = lastCreateManyArg()
    expect(data.map((row) => row['userId'])).toEqual(['user-mar', 'user-paul'])
    expect(data.every((row) => row['type'] === 'APPROVAL_APPROVED')).toBe(true)
    expect(data.every((row) => row['projectId'] === 'proj-givenchy')).toBe(true)
  })

  it('un rechazo escribe APPROVAL_REJECTED en las dos tablas', async () => {
    h.getClientSessionForApi.mockImplementation(async (..._a: unknown[]) =>
      session(GIVENCHY, 'user-contact-givenchy', 'Camille Rousseau'),
    )

    const res = await PATCH(patchRequest({ action: 'REJECT', feedback: 'Le fond est trop sombre' }), {
      params: Promise.resolve({ id: 'appr-givenchy-1' }),
    })

    expect(res.status).toBe(200)
    expect(lastCreateArg(h.activityLogCreate).data['action']).toBe('APPROVAL_REJECTED')
    expect(lastCreateManyArg().data.every((row) => row['type'] === 'APPROVAL_REJECTED')).toBe(true)
  })

  it('sin sesión de cliente no se escribe ni una fila en las tablas compartidas', async () => {
    h.getClientSessionForApi.mockImplementation(async (..._a: unknown[]) => null)

    const res = await PATCH(patchRequest({ action: 'APPROVE' }), {
      params: Promise.resolve({ id: 'appr-givenchy-1' }),
    })

    expect(res.status).toBe(401)
    expect(h.approvalFindFirst).not.toHaveBeenCalled()
    expect(h.activityLogCreate).not.toHaveBeenCalled()
    expect(h.notificationCreateMany).not.toHaveBeenCalled()
  })

  it('si notificar falla, la aprobación ya está escrita y la ruta contesta 500 sin decir qué pasó', async () => {
    h.getClientSessionForApi.mockImplementation(async (..._a: unknown[]) =>
      session(GIVENCHY, 'user-contact-givenchy', 'Camille Rousseau'),
    )
    h.notificationCreateMany.mockImplementation(async (..._a: unknown[]) => {
      throw new Error('P1001: no se pudo llegar a la base')
    })

    const res = await PATCH(patchRequest({ action: 'APPROVE' }), {
      params: Promise.resolve({ id: 'appr-givenchy-1' }),
    })

    // Caracterización de un hueco real, no de un comportamiento deseado (va en
    // bugsFound): el approval quedó APPROVED en la base, el equipo interno no
    // recibió el aviso, el catch de la ruta no registra nada, y el cliente ve
    // un error genérico que lo invita a reintentar — y el reintento choca con
    // "déjà traitée". El módulo hizo lo correcto, que es propagar; quien se lo
    // traga es la ruta. Si algún día esto se arregla con una transacción, este
    // test se pondrá rojo y hay que reescribirlo, no borrarlo.
    expect(h.approvalUpdate).toHaveBeenCalledTimes(1)
    expect(h.activityLogCreate).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Erreur interne' })
  })
})
