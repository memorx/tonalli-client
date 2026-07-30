import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * LAS 6 PANTALLAS DEL PORTAL, Y EL FILTRO POR MARCA DE CADA UNA DE SUS CONSULTAS.
 *
 * Por qué esto era el hueco más serio que quedaba: los tests de `/api/external/*`
 * cubren rutas que el cliente NO USA PARA LEER. El único fetch del navegador es el
 * PATCH de ApprovalActions. Todo lo que un contacto ve —dashboard, proyectos,
 * detalle, validaciones, marca— sale de consultas que viven DENTRO de estas
 * páginas, y ninguna tenía test.
 *
 * Hoy todas filtran bien. El riesgo no es el código de hoy, es el cambio de
 * mañana: alguien "simplifica" un `findFirst({ where: { id, clientId } })` a
 * `findUnique({ where: { id } })` —el cambio más natural del mundo, porque `id` es
 * @id y findUnique es más rápido— y un contacto de Cartier que pide la URL de un
 * proyecto de Givenchy lo recibe entero. Sin estos tests, la suite seguiría verde.
 *
 * QUÉ SE AFIRMA. No el HTML: los argumentos con los que cada página llama a
 * Prisma. Es la frontera real. Una aserción sobre lo pintado pasaría igual si la
 * consulta trajera de más y el componente casualmente no lo mostrara.
 *
 * Entorno node, sin jsdom: estas páginas son server components async, se invocan
 * como funciones. Montar React no aporta nada aquí y habría costado dependencias
 * nuevas en el repo.
 */

const mockGetClientSession = vi.fn()
vi.mock('@/lib/external-auth', () => ({
  getClientSession: () => mockGetClientSession(),
}))

const NEXT_NOT_FOUND = new Error('NEXT_NOT_FOUND')
const mockNotFound = vi.fn(() => {
  throw NEXT_NOT_FOUND
})
vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  redirect: (url: string) => {
    throw new Error('NEXT_REDIRECT:' + url)
  },
}))

/**
 * Cada método devuelve [] o null y registra sus argumentos. Deliberadamente NO
 * es un fake con comportamiento como el de los tests de API: aquí lo que se
 * inspecciona es la CONSULTA, no lo que vuelve, y un fake con datos invitaría a
 * afirmar sobre el render en vez de sobre el filtro.
 */
const calls: Array<{ model: string; method: string; args: Record<string, unknown> }> = []

/**
 * Qué devuelve el findFirst de proyecto. Es una variable y no un vi.spyOn porque
 * spyOn sobrevive a vi.clearAllMocks() —que limpia llamadas, no implementaciones—
 * y el test siguiente heredaba el null, con lo que su consulta nunca corría y el
 * fallo se leía como "no encontré la llamada" en vez de "el mock se filtró".
 */
let projectFindFirstResult: unknown = null
function recorder(model: string, method: string, ret: unknown) {
  return (args: Record<string, unknown> = {}) => {
    calls.push({ model, method, args })
    return Promise.resolve(ret)
  }
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findMany: (a: Record<string, unknown>) => recorder('project', 'findMany', [])(a),
      findFirst: (a: Record<string, unknown>) => recorder('project', 'findFirst', projectFindFirstResult)(a),
      count: (a: Record<string, unknown>) => recorder('project', 'count', 0)(a),
    },
    approval: {
      findMany: (a: Record<string, unknown>) => recorder('approval', 'findMany', [])(a),
      findFirst: (a: Record<string, unknown>) => recorder('approval', 'findFirst', APPROVAL_ROW)(a),
      count: (a: Record<string, unknown>) => recorder('approval', 'count', 0)(a),
    },
    activityLog: {
      findMany: (a: Record<string, unknown>) => recorder('activityLog', 'findMany', [])(a),
    },
    brandAsset: {
      findMany: (a: Record<string, unknown>) => recorder('brandAsset', 'findMany', [])(a),
    },
  },
}))

const GIVENCHY = 'clt_givenchy'
const CARTIER = 'clt_cartier'

const PROJECT_ROW = {
  id: 'prj_1',
  name: 'SS26',
  description: null,
  status: 'IN_PRODUCTION',
  currentPhase: 'PRODUCTION',
  priority: 2,
  startDate: null,
  deadline: null,
  completionPercent: 40,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  tasks: [],
  files: [],
  approvals: [],
  client: { name: 'Givenchy' },
}

const APPROVAL_ROW = {
  id: 'app_1',
  status: 'PENDING',
  feedback: null,
  createdAt: new Date('2026-01-01'),
  reviewedAt: null,
  file: { id: 'f1', filename: 'a.png', mimeType: 'image/png', size: 1, version: 1, storageUrl: '/x', thumbnailUrl: null, createdAt: new Date('2026-01-01') },
  project: { id: 'prj_1', name: 'SS26' },
}

function session(clientId = GIVENCHY) {
  return {
    userId: 'usr_1',
    userName: 'Sophie',
    userEmail: 's@givenchy.com',
    userImage: null,
    clientId,
    clientName: 'Givenchy',
    clientLogo: null,
  }
}

/**
 * ¿Este `where` acota a la marca de la sesión?
 *
 * Tres formas válidas, y la tercera es la sutil:
 *
 *  1. `clientId` directo — Project, BrandAsset.
 *  2. `clientId` anidado bajo `project` — Approval, ActivityLog en el dashboard.
 *  3. `projectId` de una fila YA VERIFICADA — el historial del detalle de
 *     proyecto. Ese where no menciona la marca, y aun así es seguro: la página
 *     resolvió antes el proyecto con `findFirst({ id, clientId })` y llamó a
 *     notFound() si no era suyo, así que `project.id` ya está acotado.
 *
 * La tercera se acepta aquí pero NO se deja sin vigilar: el describe
 * "acotamiento transitivo" de abajo prueba que la consulta no corre cuando el
 * proyecto no es del cliente. Sin ese par —helper permisivo + test específico—
 * o el helper da un falso positivo, o el test general da un falso negativo.
 */
function scopedTo(where: unknown, clientId: string): boolean {
  if (!where || typeof where !== 'object') return false
  const w = where as Record<string, unknown>
  if (w.clientId === clientId) return true
  const p = w.project as Record<string, unknown> | undefined
  if (p && p.clientId === clientId) return true
  // Forma 3: acotado por el id de una fila que la propia página ya validó.
  return w.projectId === PROJECT_ROW.id || w.approvalId === APPROVAL_ROW.id
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  projectFindFirstResult = PROJECT_ROW
  mockGetClientSession.mockResolvedValue(session())
})

// ── Las 6 páginas, y TODAS sus consultas ────────────────────────────────────

describe('cada consulta de cada página está acotada a la marca de la sesión', () => {
  const pages: Array<{
    nombre: string
    run: () => Promise<unknown>
    /** Cuántas consultas hace, para que añadir una sin filtro no pase inadvertida. */
    minConsultas: number
  }> = [
    {
      nombre: 'dashboard',
      minConsultas: 4,
      run: async () => {
        const { default: Page } = await import('@/app/(external)/client/dashboard/page')
        return Page()
      },
    },
    {
      nombre: 'lista de proyectos',
      minConsultas: 1,
      run: async () => {
        const { default: Page } = await import('@/app/(external)/client/projects/page')
        return Page()
      },
    },
    {
      nombre: 'detalle de proyecto',
      minConsultas: 1,
      run: async () => {
        const { default: Page } = await import('@/app/(external)/client/projects/[id]/page')
        return Page({ params: Promise.resolve({ id: 'prj_1' }) })
      },
    },
    {
      nombre: 'lista de validaciones',
      minConsultas: 1,
      run: async () => {
        const { default: Page } = await import('@/app/(external)/client/approvals/page')
        return Page({ searchParams: Promise.resolve({}) })
      },
    },
    {
      nombre: 'detalle de validación',
      minConsultas: 1,
      run: async () => {
        const { default: Page } = await import('@/app/(external)/client/approvals/[id]/page')
        return Page({ params: Promise.resolve({ id: 'app_1' }) })
      },
    },
    {
      nombre: 'universo de marca',
      minConsultas: 1,
      run: async () => {
        const { default: Page } = await import('@/app/(external)/client/brand/page')
        return Page()
      },
    },
  ]

  for (const p of pages) {
    it(`${p.nombre}: ninguna consulta escapa del clientId`, async () => {
      await p.run().catch(() => {})

      expect(calls.length).toBeGreaterThanOrEqual(p.minConsultas)

      const sinFiltro = calls.filter((c) => !scopedTo(c.args.where, GIVENCHY))
      expect(
        sinFiltro,
        `consultas sin filtro de marca: ${JSON.stringify(sinFiltro.map((c) => `${c.model}.${c.method} ${JSON.stringify(c.args.where)}`))}`,
      ).toEqual([])
    })

    it(`${p.nombre}: con sesión de Cartier ninguna consulta menciona Givenchy`, async () => {
      // El recíproco. Un filtro que estuviera clavado a una marca en vez de leer
      // la sesión pasaría el test de arriba y fallaría éste.
      mockGetClientSession.mockResolvedValue(session(CARTIER))
      await p.run().catch(() => {})

      expect(calls.length).toBeGreaterThanOrEqual(p.minConsultas)
      for (const c of calls) {
        expect(scopedTo(c.args.where, CARTIER), `${c.model}.${c.method}`).toBe(true)
        expect(JSON.stringify(c.args.where)).not.toContain(GIVENCHY)
      }
    })
  }
})

// ── Los dos detalles: el caso IDOR ──────────────────────────────────────────

describe('detalle por id — el id de la URL nunca basta', () => {
  it('proyecto: el where lleva id Y clientId, no solo id', async () => {
    // Este es el test que se pondría rojo si alguien cambia findFirst por
    // findUnique({ where: { id } }).
    const { default: Page } = await import('@/app/(external)/client/projects/[id]/page')
    await Page({ params: Promise.resolve({ id: 'prj_ajeno' }) }).catch(() => {})

    const q = calls.find((c) => c.model === 'project' && c.method === 'findFirst')
    expect(q, 'la página debe seguir usando findFirst con where compuesto').toBeDefined()
    const where = q!.args.where as Record<string, unknown>
    expect(where.id).toBe('prj_ajeno')
    expect(where.clientId).toBe(GIVENCHY)
  })

  it('validación: el where lleva id Y el clientId anidado', async () => {
    const { default: Page } = await import('@/app/(external)/client/approvals/[id]/page')
    await Page({ params: Promise.resolve({ id: 'app_ajena' }) }).catch(() => {})

    const q = calls.find((c) => c.model === 'approval' && c.method === 'findFirst')
    expect(q).toBeDefined()
    const where = q!.args.where as Record<string, unknown>
    expect(where.id).toBe('app_ajena')
    expect((where.project as Record<string, unknown>).clientId).toBe(GIVENCHY)
  })
})

// ── El filtro de la lista de validaciones ───────────────────────────────────

describe('lista de validaciones — el filtro de estado no puede pisar el de marca', () => {
  it('con ?status=PENDING el where conserva el clientId', async () => {
    // El `where` de esa página se construye como objeto mutable y se le añaden
    // claves. Es el patrón donde es fácil que un día alguien REEMPLACE el objeto
    // en vez de extenderlo y se lleve por delante la frontera.
    const { default: Page } = await import('@/app/(external)/client/approvals/page')
    await Page({ searchParams: Promise.resolve({ status: 'PENDING' }) }).catch(() => {})

    const q = calls.find((c) => c.model === 'approval' && c.method === 'findMany')
    const where = q!.args.where as Record<string, unknown>
    expect(where.status).toBe('PENDING')
    expect((where.project as Record<string, unknown>).clientId).toBe(GIVENCHY)
  })

  it('un status arbitrario de la URL tampoco lo pisa', async () => {
    const { default: Page } = await import('@/app/(external)/client/approvals/page')
    await Page({
      searchParams: Promise.resolve({ status: "'; DROP TABLE --" }),
    }).catch(() => {})

    const q = calls.find((c) => c.model === 'approval' && c.method === 'findMany')
    const where = q!.args.where as Record<string, unknown>
    expect((where.project as Record<string, unknown>).clientId).toBe(GIVENCHY)
  })
})

// ── Acotamiento transitivo ──────────────────────────────────────────────────

describe('el historial del detalle de proyecto — acotado por la fila ya verificada', () => {
  it('NO se consulta cuando el proyecto no es del cliente', async () => {
    // LA PROPIEDAD QUE DE VERDAD PROTEGE ESE HISTORIAL.
    //
    // Su where es `{ projectId, action: { in: … } }` y no menciona la marca por
    // ningún lado. Es seguro sólo porque corre DESPUÉS de que la página resolvió
    // el proyecto con `findFirst({ id, clientId })` y llamó a notFound(). Mover
    // esa consulta arriba del guard, o pasarle el id crudo de la URL en vez de
    // `project.id`, filtraría el historial de otra marca sin tocar ni una línea
    // que mencione clientId — o sea, sin que ningún test de "el where lleva
    // clientId" se entere.
    projectFindFirstResult = null

    const { default: Page } = await import('@/app/(external)/client/projects/[id]/page')
    await Page({ params: Promise.resolve({ id: 'prj_de_otra_marca' }) }).catch(() => {})

    expect(mockNotFound).toHaveBeenCalled()
    expect(
      calls.filter((c) => c.model === 'activityLog'),
      'el historial no debe consultarse si el proyecto no es del cliente',
    ).toEqual([])
  })

  it('usa el id de la fila verificada, no el de la URL', async () => {
    // `projectId: project.id` y no `projectId: id`. Con un findFirst correcto los
    // dos coinciden, así que la diferencia sólo se ve cuando divergen — de ahí
    // que el fixture devuelva un id distinto al que se pide.
    const { default: Page } = await import('@/app/(external)/client/projects/[id]/page')
    await Page({ params: Promise.resolve({ id: 'id-de-la-url-distinto' }) }).catch(() => {})

    const log = calls.find((c) => c.model === 'activityLog')
    expect(log).toBeDefined()
    expect((log!.args.where as Record<string, unknown>).projectId).toBe(PROJECT_ROW.id)
  })
})

// ── La sesión es la única fuente del clientId ───────────────────────────────

describe('todas las páginas piden la sesión antes de consultar', () => {
  const runners: Array<[string, () => Promise<unknown>]> = [
    ['dashboard', async () => (await import('@/app/(external)/client/dashboard/page')).default()],
    ['proyectos', async () => (await import('@/app/(external)/client/projects/page')).default()],
    ['marca', async () => (await import('@/app/(external)/client/brand/page')).default()],
  ]

  for (const [nombre, run] of runners) {
    it(`${nombre}: si getClientSession rechaza, no se consulta nada`, async () => {
      // getClientSession hace redirect('/login') cuando el visitante no es un
      // CLIENT_CONTACT con marca. Que ninguna consulta salga antes de eso es lo
      // que impide que un fallo del guard filtre datos igualmente.
      mockGetClientSession.mockRejectedValue(new Error('NEXT_REDIRECT:/login'))
      await run().catch(() => {})
      expect(calls).toEqual([])
    })
  }
})
