import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@/generated/prisma/enums'
import { getClientSession, getClientSessionForApi } from '@/lib/external-auth'

/**
 * external-auth.ts es la frontera de tenancy entera del portal. Todo lo que el cliente
 * ve después de autenticarse se filtra por el `clientId` que sale de aquí, así que un
 * fallo en este archivo no degrada la experiencia: enseña los proyectos de Cartier a un
 * contacto de Givenchy. Por eso esta suite no se limita al camino feliz — recorre la
 * matriz completa de rechazos y, sobre todo, fija de dónde sale el tenant (de la BD,
 * jamás del token).
 *
 * DECISIÓN SOBRE redirect(): el mock LANZA. El `redirect()` real de Next tira un error
 * NEXT_REDIRECT y el código de producción depende de eso para cortar el flujo — fíjate
 * que en `getClientSession` las guardas hacen `if (!session?.user) redirect('/login')`
 * sin `return`. Si mockeáramos redirect como un no-op silencioso, la ejecución seguiría
 * hasta `session.user.role` y el test moriría con un TypeError de `undefined`, que pasa
 * igual de "rojo" pero por el motivo equivocado: enmascararía la guarda en vez de
 * probarla, y un día que alguien borre la guarda el test seguiría fallando con el mismo
 * TypeError y nadie notaría la diferencia. Lanzando un marcador reproducimos la
 * semántica real y podemos afirmar dos cosas independientes: que se cortó el flujo y que
 * el destino fue '/login'.
 */
const { authMock, findUniqueMock, redirectMock, REDIRECT_MARKER } = vi.hoisted(() => {
  const marker = 'TEST_NEXT_REDIRECT'
  return {
    REDIRECT_MARKER: marker,
    redirectMock: vi.fn((..._a: unknown[]): never => {
      throw new Error(marker)
    }),
    authMock: vi.fn(async (..._a: unknown[]): Promise<unknown> => null),
    findUniqueMock: vi.fn(async (..._a: unknown[]): Promise<unknown> => null),
  }
})

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))

// '@/lib/prisma' se mockea también por una razón de infraestructura, no sólo de aislamiento:
// el módulo real abre un pg.Pool en tiempo de import. Sin mock, cargar external-auth
// intentaría construir un pool contra DATABASE_URL y la suite dependería de que haya una
// base de datos viva, que es exactamente lo que no queremos en un test de guardas.
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: findUniqueMock } } }))

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

type Tenant = { id: string; name: string; logo: string | null }

/**
 * Dos tenants reales del portal. Se usan a pares a propósito: casi todos los bugs de
 * tenancy sólo se ven cuando hay más de un cliente en juego, con uno solo cualquier
 * implementación parece correcta.
 */
const GIVENCHY: Tenant = { id: 'clt_givenchy', name: 'Givenchy', logo: '/logos/givenchy.svg' }
const CARTIER: Tenant = { id: 'clt_cartier', name: 'Cartier', logo: '/logos/cartier.svg' }

type SessionUser = {
  id: string
  email: string
  name: string
  image?: string | null
  role: UserRole
  // El JWT sólo lleva id y role (mira el callback jwt de auth.ts), pero el tipo admite
  // claims extra para poder simular un token manipulado en los tests cross-tenant.
  clientId?: string
}

type FakeSession = { user: SessionUser; expires: string }

/**
 * Fila tal y como la devuelve el `select` de external-auth. `isActive` y `role` van
 * opcionales y NO forman parte de ese select: existen aquí sólo para los canarios del
 * final, que documentan que el guard ignora esas dos columnas aunque estén en la tabla.
 */
type SelectedUserRow = {
  id: string
  name: string
  email: string
  image: string | null
  avatar: string | null
  clientId: string | null
  client: Tenant | null
  isActive?: boolean
  role?: UserRole
}

function sessionFor(overrides: Partial<SessionUser> = {}): FakeSession {
  return {
    user: {
      id: 'usr_camille',
      email: 'camille.roux@givenchy.com',
      name: 'Camille Roux',
      image: null,
      role: 'CLIENT_CONTACT',
      ...overrides,
    },
    expires: '2099-01-01T00:00:00.000Z',
  }
}

function rowFor(tenant: Tenant | null, overrides: Partial<SelectedUserRow> = {}): SelectedUserRow {
  return {
    id: 'usr_camille',
    name: 'Camille Roux',
    email: 'camille.roux@givenchy.com',
    image: null,
    avatar: null,
    clientId: tenant?.id ?? null,
    client: tenant,
    ...overrides,
  }
}

/**
 * Las dos funciones son la misma lógica con dos políticas de fallo distintas: la de
 * páginas manda a '/login', la de rutas devuelve null para que el handler responda 401
 * en JSON. Recorrer la matriz de rechazos con `describe.each` en vez de duplicarla a mano
 * es lo que impide que se separen: hoy los cuerpos están copiados literalmente (líneas
 * 20-33 y 51-64 de external-auth.ts) y sin esta simetría en los tests una guarda añadida
 * a una sola de las dos pasaría desapercibida.
 */
const VARIANTS = [
  { label: 'getClientSession (páginas)', invoke: getClientSession, mode: 'redirect' },
  { label: 'getClientSessionForApi (rutas)', invoke: getClientSessionForApi, mode: 'null' },
] as const

type Variant = (typeof VARIANTS)[number]

/**
 * Los siete roles internos se derivan del enum generado por Prisma en vez de escribirse a
 * mano: si mañana el schema añade un rol, entra solo en la matriz de rechazo y nadie tiene
 * que acordarse de venir a actualizar una lista.
 */
const INTERNAL_ROLES: UserRole[] = Object.values(UserRole).filter((role) => role !== 'CLIENT_CONTACT')

async function expectRejected(variant: Variant): Promise<void> {
  if (variant.mode === 'redirect') {
    await expect(variant.invoke()).rejects.toThrow(REDIRECT_MARKER)
    expect(redirectMock).toHaveBeenCalledWith('/login')
  } else {
    await expect(variant.invoke()).resolves.toBeNull()
    // La variante de API no debe redirigir nunca: un redirect dentro de un route handler
    // convierte un 401 limpio en una respuesta HTML que el fetch del cliente parsea como
    // JSON y explota en un sitio que no tiene nada que ver con el fallo de auth.
    expect(redirectMock).not.toHaveBeenCalled()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Defaults hostiles: sin sesión y sin fila. Cada test tiene que conceder explícitamente
  // lo que necesita, así un test al que se le olvide montar el escenario falla en vez de
  // heredar por accidente el estado permisivo del anterior.
  authMock.mockResolvedValue(null)
  findUniqueMock.mockResolvedValue(null)
  redirectMock.mockImplementation((..._a: unknown[]): never => {
    throw new Error(REDIRECT_MARKER)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Matriz de rechazo, idéntica para las dos variantes
// ─────────────────────────────────────────────────────────────────────────────

describe('cobertura del enum de roles', () => {
  it('los seis roles internos del schema están en la matriz', () => {
    // Este assert es el centinela de la lista derivada: si el enum crece y el rol nuevo
    // no aparece, o si alguien lo reescribe a mano y se le olvida uno, salta aquí.
    //
    // Eran siete hasta que este repo sincronizó su schema.prisma con el del portal
    // interno. El número no bajó por un cambio de hoy: LEAD_AESTHETIC y LEAD_TECHNICAL
    // se fusionaron en CHEF_PROJECT hace meses, y este repo seguía declarándolos porque
    // su copia del esquema se había quedado atrás.
    expect(INTERNAL_ROLES).toHaveLength(6)
    expect(INTERNAL_ROLES).toContain('DESIGNER')
    expect(INTERNAL_ROLES).toContain('COORDINATOR')
    expect(INTERNAL_ROLES).toContain('ARTISTIC_CREATOR')
    expect(INTERNAL_ROLES).toContain('CHEF_PROJECT')
    expect(INTERNAL_ROLES).not.toContain('CLIENT_CONTACT')
  })

  it('los roles fusionados no vuelven a aparecer', () => {
    // Vale más que el conteo: el CLAUDE.md del portal interno los marca como
    // "REMOVED — do not reintroduce". Si alguien los reintroduce en el schema,
    // el portal del cliente empezaría a tratar como internos a roles que la base
    // de datos no reconoce.
    const roles = Object.values(UserRole) as string[]
    expect(roles).not.toContain('LEAD_AESTHETIC')
    expect(roles).not.toContain('LEAD_TECHNICAL')
  })
})

describe.each(VARIANTS)('$label — matriz de rechazo', (variant) => {
  it('rechaza cuando no hay sesión y no llega a consultar la BD', async () => {
    authMock.mockResolvedValue(null)

    await expectRejected(variant)
    // Que no se toque Prisma no es cosmético: es la diferencia entre una guarda que corta
    // y una que "corta" después de haber hecho una query con un id undefined.
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('rechaza cuando auth() devuelve una sesión sin user', async () => {
    // NextAuth puede devolver un objeto de sesión con el user vacío si el JWT se
    // deserializa a medias. El código usa `session?.user` precisamente para eso, y este
    // caso lo fija: sin user no hay identidad y por tanto no hay tenant.
    authMock.mockResolvedValue({ expires: '2099-01-01T00:00:00.000Z' })

    await expectRejected(variant)
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it.each(INTERNAL_ROLES)('rechaza al interno con rol %s: el portal del cliente no es para el equipo', async (role) => {
    authMock.mockResolvedValue(sessionFor({ role, email: 'flavien@bureautonalli.com' }))

    await expectRejected(variant)
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('rechaza al interno incluso si su fila en la BD tiene un clientId válido', async () => {
    // Este es el único test que aísla la guarda de rol. En todos los demás casos de
    // interno la fila tendría clientId NULL y la guarda de más abajo lo pararía igual, así
    // que borrar `if (session.user.role !== 'CLIENT_CONTACT')` no rompería nada visible.
    // Aquí el escenario es el de un contacto de cliente promovido a interno al que nadie
    // limpió el FK: la BD le daría tenant de mil amores y lo único que lo frena es el rol.
    authMock.mockResolvedValue(sessionFor({ role: 'DESIGNER' }))
    findUniqueMock.mockResolvedValue(rowFor(CARTIER))

    await expectRejected(variant)
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('rechaza al CLIENT_CONTACT cuyo user.clientId es NULL', async () => {
    // No es un caso hipotético: hay cuatro contactos en producción creados a mano con
    // clientId NULL. Sin esta guarda entrarían al portal con `clientId` undefined y toda
    // query aguas abajo que filtre por `where: { clientId }` dejaría de filtrar — que en
    // Prisma no significa "cero resultados", significa "todos los clientes".
    authMock.mockResolvedValue(sessionFor())
    findUniqueMock.mockResolvedValue(rowFor(null))

    await expectRejected(variant)
    expect(findUniqueMock).toHaveBeenCalledTimes(1)
  })

  it('rechaza al CLIENT_CONTACT con clientId apuntando a un client que no existe', async () => {
    // FK huérfana: el clientId está poblado pero el join no resuelve (cliente borrado, o
    // una fila metida a mano con un id inventado). La guarda mira las dos mitades
    // (`!user.clientId || !user.client`) y esta prueba la segunda, que es la que evita
    // leer `user.client.name` sobre null.
    authMock.mockResolvedValue(sessionFor())
    findUniqueMock.mockResolvedValue(rowFor(null, { clientId: 'clt_borrado' }))

    await expectRejected(variant)
  })

  it('rechaza cuando el usuario del token ya no existe en la BD', async () => {
    // El JWT vive más que la fila. Un contacto dado de baja conserva su cookie válida
    // hasta que expira, y lo único que lo echa es que el findUnique no encuentre nada.
    authMock.mockResolvedValue(sessionFor())
    findUniqueMock.mockResolvedValue(null)

    await expectRejected(variant)
  })

  it('busca al usuario por el id de la sesión, nunca por email ni por un clientId del token', async () => {
    // El where de esta query ES la frontera de tenancy. Si un día se cambia a buscar por
    // email (mutable, y con el email lo pone el proveedor OAuth) o a aceptar un clientId
    // del token, la identidad deja de estar anclada al servidor. Se fija también que el
    // select traiga el join de client, porque de ahí sale el nombre que se pinta en el
    // header del portal.
    authMock.mockResolvedValue(sessionFor({ id: 'usr_camille', clientId: CARTIER.id }))
    findUniqueMock.mockResolvedValue(rowFor(GIVENCHY))

    await variant.invoke()

    expect(findUniqueMock).toHaveBeenCalledTimes(1)
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'usr_camille' },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        avatar: true,
        clientId: true,
        client: { select: { id: true, name: true, logo: true } },
      },
    })
  })

  it('caso feliz: devuelve la sesión de cliente completa y no redirige', async () => {
    authMock.mockResolvedValue(sessionFor())
    findUniqueMock.mockResolvedValue(
      rowFor(GIVENCHY, { avatar: '/avatars/camille.jpg', image: '/google/camille.jpg' }),
    )

    await expect(variant.invoke()).resolves.toEqual({
      userId: 'usr_camille',
      userName: 'Camille Roux',
      userEmail: 'camille.roux@givenchy.com',
      userImage: '/avatars/camille.jpg',
      clientId: GIVENCHY.id,
      clientName: GIVENCHY.name,
      clientLogo: GIVENCHY.logo,
    })
    expect(redirectMock).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cross-tenant: el peor fallo posible de este producto
// ─────────────────────────────────────────────────────────────────────────────

describe.each(VARIANTS)('$label — aislamiento cross-tenant', (variant) => {
  it('ignora un clientId inyectado en la sesión: el tenant sale de la BD', async () => {
    // Un contacto de Givenchy intentando leer Cartier. El vector es el token: si algún día
    // el callback jwt empezara a copiar clientId al token (o alguien firmara uno), lo único
    // que impide el salto de tenant es que external-auth NO lea ese claim y resuelva el
    // cliente contra la fila del usuario. Este test es el que lo garantiza.
    authMock.mockResolvedValue(sessionFor({ clientId: CARTIER.id }))
    findUniqueMock.mockResolvedValue(rowFor(GIVENCHY))

    const result = await variant.invoke()

    expect(result?.clientId).toBe(GIVENCHY.id)
    expect(result?.clientName).toBe(GIVENCHY.name)
    expect(result?.clientId).not.toBe(CARTIER.id)
  })

  it('el tenant sale del join (user.client.id), no del FK crudo', async () => {
    // Divergencia sintética entre el FK y el join — imposible con integridad referencial,
    // pero es la única forma de fijar cuál de los dos campos es la fuente de verdad. Al
    // devolver `user.client.id` el clientId siempre corresponde a un cliente que existe y
    // cuyo nombre y logo son los que se pintan, en vez de a un id suelto sin validar.
    authMock.mockResolvedValue(sessionFor())
    findUniqueMock.mockResolvedValue(rowFor(GIVENCHY, { clientId: CARTIER.id }))

    const result = await variant.invoke()

    expect(result?.clientId).toBe(GIVENCHY.id)
  })

  it('dos contactos de tenants distintos en el mismo proceso no se contaminan', async () => {
    // Next reutiliza el proceso entre peticiones. Si alguien cacheara la sesión de cliente
    // a nivel de módulo (un `let cached` para "ahorrar" la query, la optimización más
    // tentadora de este archivo), el segundo visitante recibiría el tenant del primero.
    // Dos llamadas seguidas con identidades distintas es lo que detecta ese cache.
    authMock.mockResolvedValue(sessionFor({ id: 'usr_camille' }))
    findUniqueMock.mockResolvedValue(rowFor(GIVENCHY))
    const first = await variant.invoke()

    authMock.mockResolvedValue(
      sessionFor({ id: 'usr_pierre', email: 'pierre@cartier.com', name: 'Pierre Blanc' }),
    )
    findUniqueMock.mockResolvedValue(
      rowFor(CARTIER, { id: 'usr_pierre', email: 'pierre@cartier.com', name: 'Pierre Blanc' }),
    )
    const second = await variant.invoke()

    expect(first?.clientId).toBe(GIVENCHY.id)
    expect(second?.clientId).toBe(CARTIER.id)
    expect(second?.userId).toBe('usr_pierre')
    expect(findUniqueMock).toHaveBeenCalledTimes(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// userImage: avatar con fallback a image
// ─────────────────────────────────────────────────────────────────────────────

describe('userImage — precedencia avatar sobre image', () => {
  beforeEach(() => {
    authMock.mockResolvedValue(sessionFor())
  })

  it('el avatar subido en el portal gana sobre la foto de Google', async () => {
    // El orden real es `user.avatar ?? user.image`: manda el avatar que el equipo sube en
    // el portal interno y la foto de Google es sólo el respaldo. Ojo que auth.ts hace lo
    // contrario en el provider de dev-login (`user.image ?? user.avatar`), así que el orden
    // de aquí es el único que vale para lo que ve el cliente en el header.
    findUniqueMock.mockResolvedValue(
      rowFor(GIVENCHY, { avatar: '/avatars/camille.jpg', image: '/google/camille.jpg' }),
    )

    await expect(getClientSessionForApi()).resolves.toMatchObject({
      userImage: '/avatars/camille.jpg',
    })
  })

  it('sin avatar cae a la foto de Google', async () => {
    findUniqueMock.mockResolvedValue(rowFor(GIVENCHY, { avatar: null, image: '/google/camille.jpg' }))

    await expect(getClientSessionForApi()).resolves.toMatchObject({
      userImage: '/google/camille.jpg',
    })
  })

  it('sin ninguna de las dos devuelve null, no undefined', async () => {
    // El contrato de ClientSession dice `string | null` y los componentes de Avatar
    // distinguen null (pintan iniciales) de undefined (pintan un <img> sin src).
    findUniqueMock.mockResolvedValue(rowFor(GIVENCHY, { avatar: null, image: null }))

    const result = await getClientSessionForApi()

    expect(result?.userImage).toBeNull()
  })

  it('un avatar en cadena vacía NO cae a image: `??` sólo atrapa null', async () => {
    // Comportamiento documentado, no deseado. `??` deja pasar la cadena vacía, así que una
    // fila con avatar '' (típico de un insert manual) produce un src vacío en vez de usar
    // la foto de Google que sí existe. Se fija aquí para que quien cambie `??` por `||`
    // sepa que este test tiene que cambiar con él, y viceversa.
    findUniqueMock.mockResolvedValue(rowFor(GIVENCHY, { avatar: '', image: '/google/camille.jpg' }))

    const result = await getClientSessionForApi()

    expect(result?.userImage).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Canarios: huecos conocidos del guard, documentados a propósito
// ─────────────────────────────────────────────────────────────────────────────

describe('canarios de huecos conocidos (documentan el comportamiento actual, no lo bendicen)', () => {
  it('HUECO: un contacto con isActive=false sigue entrando al portal', async () => {
    // User.isActive existe en el schema y ni auth.ts ni external-auth.ts lo miran: el
    // select ni lo pide. Un contacto que ya no trabaja en Givenchy conserva acceso
    // completo mientras su fila siga apuntando al cliente. Si alguien añade la guarda de
    // isActive, este test se pone rojo — y eso es la señal de que hay que invertirlo, no
    // de que se haya roto nada.
    authMock.mockResolvedValue(sessionFor())
    findUniqueMock.mockResolvedValue(rowFor(GIVENCHY, { isActive: false }))

    await expect(getClientSessionForApi()).resolves.toMatchObject({ clientId: GIVENCHY.id })
  })

  it('HUECO: el rol se cree al token y nunca se revalida contra la fila de la BD', async () => {
    // La query ya trae la fila del usuario, pero el select no pide `role`, así que la
    // comprobación de rol se queda con el claim del JWT que se firmó al hacer login. Un
    // contacto convertido en interno (o al revés) mantiene el rol viejo hasta que caduca
    // la cookie. Cerrarlo cuesta una línea en el select y una comparación.
    authMock.mockResolvedValue(sessionFor({ role: 'CLIENT_CONTACT' }))
    findUniqueMock.mockResolvedValue(rowFor(GIVENCHY, { role: 'DESIGNER' }))

    await expect(getClientSessionForApi()).resolves.toMatchObject({ clientId: GIVENCHY.id })
  })
})
