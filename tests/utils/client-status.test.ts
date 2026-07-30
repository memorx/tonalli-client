import { describe, it, expect } from 'vitest'
import { ProjectStatus } from '@/generated/prisma/enums'
import {
  CLIENT_PHASE_MAP,
  CLIENT_PHASE_LABELS,
  CLIENT_PHASE_COLORS,
  CLIENT_PHASE_PROGRESS,
  CLIENT_PHASE_ORDER,
  CLIENT_PHASE_STEP_LABELS,
  getClientPhase,
  getClientPhaseIndex,
  isVisibleStatusChange,
  type ClientPhase,
} from '@/utils/client-status'
import {
  CLIENT_NAV_ITEMS,
  CLIENT_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_COLORS,
  CLIENT_PRIORITY_LABELS,
  CLIENT_PRIORITY_COLORS,
  CLIENT_VISIBLE_ACTIONS,
  CLIENT_ACTIVITY_LABELS,
} from '@/utils/external-constants'

// Tabla de verdad ESCRITA A MANO, deliberadamente independiente de CLIENT_PHASE_MAP.
// La copiamos de la especificación documentada (CLAUDE.md, sección "Client Phase Mapping"),
// no del módulo bajo prueba: si comparásemos el mapa contra sí mismo el test sería una
// tautología que sigue verde aunque alguien reasigne SENT_TO_CLIENT a 'REVIEW' y esconda
// para siempre la fase en la que el cliente tiene que actuar. Todo lo demás en este archivo
// (matriz de transiciones incluida) se deriva de ESTA constante, no de la de producción.
const EXPECTED_PHASE: Record<string, ClientPhase> = {
  SETUP: 'PREPARATION',
  INCOMING: 'PREPARATION',
  ORGANIZING: 'PREPARATION',
  ON_HOLD_BLOCKED: 'PREPARATION',
  IN_PRODUCTION: 'PRODUCTION',
  WAITING_AESTHETIC_VALIDATION: 'REVIEW',
  WAITING_TECHNICAL_VALIDATION: 'REVIEW',
  READY_FINAL_VALIDATION: 'REVIEW',
  SENT_TO_CLIENT: 'YOUR_TURN',
  ARCHIVED: 'COMPLETE',
}

// El listado de estatus lo sacamos del enum GENERADO por Prisma, no de una lista a mano:
// así, el día que alguien añada un ProjectStatus al schema y olvide mapearlo, la suite se
// pone roja sin que nadie tenga que acordarse de tocar este archivo.
const ALL_STATUSES = Object.values(ProjectStatus)

// Valores que un cliente NUNCA debería ver pero que la base de datos sí puede escupir.
// ActivityLog.details es Json? libre (prisma/schema.prisma:442) y el dashboard castea
// details.newStatus a ProjectStatus sin validar nada, así que cualquier string escrito por
// una versión anterior del portal interno llega hasta estos mappers tal cual.
const LEGACY_STATUSES = [
  'WAITING_VALIDATION',
  'CLIENT_REVIEW',
  'DELIVERED',
  'CANCELLED',
  'DRAFT',
  'in_production',
  '',
]

// Claves que existen en Object.prototype y por tanto responden a un lookup por índice
// aunque nadie las haya declarado en el mapa. No es paranoia teórica: details.newStatus
// viene de un Json arbitrario, y un '__proto__' o un 'constructor' ahí dentro devuelven
// algo que NO es undefined, lo que rompe cualquier defensa basada en `?? fallback`.
const PROTO_KEYS = ['toString', 'constructor', 'hasOwnProperty', 'valueOf', '__proto__']

function asStatus(value: string): ProjectStatus {
  // Cast explícito y localizado: reproducimos exactamente lo que hace producción en
  // dashboard/page.tsx:171 y projects/[id]/page.tsx:214 (`details.newStatus as ProjectStatus`),
  // porque el objetivo del bloque legacy es probar ese agujero, no evitarlo.
  return value as unknown as ProjectStatus
}

describe('CLIENT_PHASE_MAP', () => {
  it('cubre exactamente los ProjectStatus del schema, sin sobrantes ni faltantes', () => {
    expect(Object.keys(CLIENT_PHASE_MAP).sort()).toEqual([...ALL_STATUSES].sort())
  })

  it('mapea cada ProjectStatus a la fase documentada', () => {
    for (const status of ALL_STATUSES) {
      expect(CLIENT_PHASE_MAP[status], `mapeo de ${status}`).toBe(EXPECTED_PHASE[status])
    }
  })

  it('solo produce fases que existen en CLIENT_PHASE_ORDER', () => {
    // Invariante que sostiene la barra de progreso: si un estatus resolviese a una fase
    // fuera del orden, getClientPhaseIndex daría -1 y ProjectProgressBar pintaría los cinco
    // pasos como "futuros", sin paso actual — el cliente vería una barra completamente vacía.
    for (const status of ALL_STATUSES) {
      expect(CLIENT_PHASE_ORDER).toContain(CLIENT_PHASE_MAP[status])
    }
  })

  it('usa las cinco fases; ninguna queda huérfana', () => {
    // Una fase sin ningún estatus que la alcance es código muerto que engaña al equipo:
    // aparece en la barra de progreso pero es inalcanzable.
    const reached = new Set(ALL_STATUSES.map((s) => CLIENT_PHASE_MAP[s]))
    expect([...reached].sort()).toEqual([...CLIENT_PHASE_ORDER].sort())
  })
})

describe('getClientPhase', () => {
  it('resuelve los diez estatus del schema', () => {
    for (const status of ALL_STATUSES) {
      expect(getClientPhase(status), `getClientPhase(${status})`).toBe(EXPECTED_PHASE[status])
    }
  })

  it('agrupa en PREPARATION los cuatro estatus previos a producción', () => {
    // Fijamos el agrupamiento por fase de forma explícita además de por tabla: es la
    // regla de negocio real (el cliente no debe distinguir SETUP de ORGANIZING ni enterarse
    // de que su proyecto está bloqueado internamente) y merece fallar con un nombre legible.
    expect(ALL_STATUSES.filter((s) => getClientPhase(s) === 'PREPARATION').sort()).toEqual(
      ['INCOMING', 'ON_HOLD_BLOCKED', 'ORGANIZING', 'SETUP'],
    )
  })

  it('no filtra al cliente en qué validación interna concreta está el proyecto', () => {
    // Los tres estatus de validación interna colapsan a un único 'REVIEW'. Si uno se
    // escapase a su propia fase, el cliente vería el detalle del proceso interno.
    expect(ALL_STATUSES.filter((s) => getClientPhase(s) === 'REVIEW').sort()).toEqual([
      'READY_FINAL_VALIDATION',
      'WAITING_AESTHETIC_VALIDATION',
      'WAITING_TECHNICAL_VALIDATION',
    ])
  })

  it('reserva YOUR_TURN solo para SENT_TO_CLIENT', () => {
    // YOUR_TURN es la única fase que le pide algo al cliente. Que la alcance cualquier otro
    // estatus significa pedirle validar algo que el equipo todavía no le ha enviado.
    expect(ALL_STATUSES.filter((s) => getClientPhase(s) === 'YOUR_TURN')).toEqual(['SENT_TO_CLIENT'])
  })

  it('reserva COMPLETE solo para ARCHIVED', () => {
    expect(ALL_STATUSES.filter((s) => getClientPhase(s) === 'COMPLETE')).toEqual(['ARCHIVED'])
  })
})

describe('mapas de presentación de fase', () => {
  const PRESENTATION_MAPS: Array<[string, Record<ClientPhase, string>]> = [
    ['CLIENT_PHASE_LABELS', CLIENT_PHASE_LABELS],
    ['CLIENT_PHASE_COLORS', CLIENT_PHASE_COLORS],
    ['CLIENT_PHASE_STEP_LABELS', CLIENT_PHASE_STEP_LABELS],
  ]

  it('cada mapa cubre las cinco fases con strings no vacíos', () => {
    for (const [name, map] of PRESENTATION_MAPS) {
      expect(Object.keys(map).sort(), `claves de ${name}`).toEqual([...CLIENT_PHASE_ORDER].sort())
      for (const phase of CLIENT_PHASE_ORDER) {
        expect(typeof map[phase], `${name}[${phase}]`).toBe('string')
        expect(map[phase].trim(), `${name}[${phase}] no vacío`).not.toBe('')
      }
    }
  })

  it('las etiquetas de fase están en francés y son las acordadas', () => {
    // La UI es francés y NO se traduce en el componente: lo que hay aquí es literalmente lo
    // que lee el contacto de la maison. Un fallback en inglés colado aquí llega a producción.
    expect(CLIENT_PHASE_LABELS).toEqual({
      PREPARATION: 'En préparation',
      PRODUCTION: 'En production',
      REVIEW: 'En révision interne',
      YOUR_TURN: 'En attente de votre validation',
      COMPLETE: 'Terminé',
    })
  })

  it('las etiquetas cortas de la barra de progreso están en francés', () => {
    expect(CLIENT_PHASE_STEP_LABELS).toEqual({
      PREPARATION: 'Préparation',
      PRODUCTION: 'Production',
      REVIEW: 'Révision',
      YOUR_TURN: 'Validation',
      COMPLETE: 'Terminé',
    })
  })

  it('ninguna etiqueta ni color se repite entre fases', () => {
    // Dos fases con la misma etiqueta o el mismo color son indistinguibles en pantalla:
    // el cliente no puede saber si su proyecto avanzó.
    for (const [name, map] of PRESENTATION_MAPS) {
      const values = CLIENT_PHASE_ORDER.map((p) => map[p])
      expect(new Set(values).size, `valores únicos en ${name}`).toBe(CLIENT_PHASE_ORDER.length)
    }
  })

  it('los colores traen las tres clases Tailwind que el badge necesita', () => {
    // ClientPhaseBadge sólo concatena el string; si le falta el `border-*` el badge queda con
    // borde por defecto y si le falta el `text-*` hereda un color que puede no contrastar.
    for (const phase of CLIENT_PHASE_ORDER) {
      const classes = CLIENT_PHASE_COLORS[phase]
      expect(classes, `bg en ${phase}`).toMatch(/\bbg-[a-z]+-\d{2,3}\/\d{1,3}\b/)
      expect(classes, `text en ${phase}`).toMatch(/\btext-[a-z]+-\d{2,3}\b/)
      expect(classes, `border en ${phase}`).toMatch(/\bborder-[a-z]+-\d{2,3}\/\d{1,3}\b/)
    }
  })
})

describe('CLIENT_PHASE_PROGRESS', () => {
  it('cubre las cinco fases con porcentajes válidos', () => {
    expect(Object.keys(CLIENT_PHASE_PROGRESS).sort()).toEqual([...CLIENT_PHASE_ORDER].sort())
    for (const phase of CLIENT_PHASE_ORDER) {
      const value = CLIENT_PHASE_PROGRESS[phase]
      expect(Number.isInteger(value), `${phase} entero`).toBe(true)
      expect(value, `${phase} >= 0`).toBeGreaterThanOrEqual(0)
      expect(value, `${phase} <= 100`).toBeLessThanOrEqual(100)
    }
  })

  it('crece estrictamente a lo largo de CLIENT_PHASE_ORDER', () => {
    // El porcentaje y el orden son dos fuentes de verdad separadas; si se desalinean, un
    // proyecto que avanza de fase puede mostrar una barra que RETROCEDE.
    const series = CLIENT_PHASE_ORDER.map((p) => CLIENT_PHASE_PROGRESS[p])
    for (let i = 1; i < series.length; i++) {
      expect(series[i], `${CLIENT_PHASE_ORDER[i]} > ${CLIENT_PHASE_ORDER[i - 1]}`).toBeGreaterThan(
        series[i - 1],
      )
    }
  })

  it('solo COMPLETE llega al 100%', () => {
    expect(CLIENT_PHASE_PROGRESS.COMPLETE).toBe(100)
    for (const phase of CLIENT_PHASE_ORDER.filter((p) => p !== 'COMPLETE')) {
      expect(CLIENT_PHASE_PROGRESS[phase], `${phase} < 100`).toBeLessThan(100)
    }
  })

  it('ninguna fase arranca en 0%: un proyecto recién abierto ya muestra avance', () => {
    for (const phase of CLIENT_PHASE_ORDER) {
      expect(CLIENT_PHASE_PROGRESS[phase], `${phase} > 0`).toBeGreaterThan(0)
    }
  })
})

describe('CLIENT_PHASE_ORDER', () => {
  it('es la secuencia canónica de cinco fases, sin repeticiones', () => {
    expect(CLIENT_PHASE_ORDER).toEqual([
      'PREPARATION',
      'PRODUCTION',
      'REVIEW',
      'YOUR_TURN',
      'COMPLETE',
    ])
    expect(new Set(CLIENT_PHASE_ORDER).size).toBe(CLIENT_PHASE_ORDER.length)
  })
})

describe('getClientPhaseIndex', () => {
  it('devuelve la posición de cada fase', () => {
    expect(getClientPhaseIndex('PREPARATION')).toBe(0)
    expect(getClientPhaseIndex('PRODUCTION')).toBe(1)
    expect(getClientPhaseIndex('REVIEW')).toBe(2)
    expect(getClientPhaseIndex('YOUR_TURN')).toBe(3)
    expect(getClientPhaseIndex('COMPLETE')).toBe(4)
  })

  it('es consistente con CLIENT_PHASE_ORDER para toda fase', () => {
    CLIENT_PHASE_ORDER.forEach((phase, index) => {
      expect(getClientPhaseIndex(phase), `índice de ${phase}`).toBe(index)
    })
  })

  it('devuelve -1 para una fase desconocida en vez de lanzar', () => {
    // Contrato que ProjectProgressBar hereda sin saberlo: con -1 no explota, pero pinta los
    // cinco pasos como futuros. Lo fijamos para que quede documentado que -1 es alcanzable
    // (llega desde getClientPhase(status legacy) === undefined).
    expect(getClientPhaseIndex('DONE' as unknown as ClientPhase)).toBe(-1)
    expect(getClientPhaseIndex(undefined as unknown as ClientPhase)).toBe(-1)
    expect(getClientPhaseIndex(null as unknown as ClientPhase)).toBe(-1)
  })
})

describe('isVisibleStatusChange', () => {
  it('coincide con la tabla esperada en las 100 transiciones posibles', () => {
    // Matriz completa 10x10 derivada de EXPECTED_PHASE, no del mapa de producción. Es el test
    // que da dientes al filtro del dashboard: decide qué movimientos internos se le cuentan
    // al cliente y cuáles se le esconden porque no cambian nada visible para él.
    for (const oldStatus of ALL_STATUSES) {
      for (const newStatus of ALL_STATUSES) {
        const expected = EXPECTED_PHASE[oldStatus] !== EXPECTED_PHASE[newStatus]
        expect(
          isVisibleStatusChange(oldStatus, newStatus),
          `${oldStatus} -> ${newStatus}`,
        ).toBe(expected)
      }
    }
  })

  it('oculta los movimientos internos dentro de la misma fase', () => {
    // Estos son los casos que justifican la función: el equipo mueve el proyecto por su
    // pipeline interno y el cliente no debe recibir ruido por cada paso.
    expect(isVisibleStatusChange('SETUP', 'INCOMING')).toBe(false)
    expect(isVisibleStatusChange('INCOMING', 'ORGANIZING')).toBe(false)
    expect(isVisibleStatusChange('ORGANIZING', 'ON_HOLD_BLOCKED')).toBe(false)
    expect(isVisibleStatusChange('WAITING_AESTHETIC_VALIDATION', 'WAITING_TECHNICAL_VALIDATION')).toBe(false)
    expect(isVisibleStatusChange('WAITING_TECHNICAL_VALIDATION', 'READY_FINAL_VALIDATION')).toBe(false)
  })

  it('un bloqueo interno no se le anuncia al cliente', () => {
    // ON_HOLD_BLOCKED vive en PREPARATION a propósito: pasar de SETUP a bloqueado no genera
    // entrada visible. Pero caer a bloqueado DESDE producción sí es un retroceso real y se ve.
    expect(isVisibleStatusChange('SETUP', 'ON_HOLD_BLOCKED')).toBe(false)
    expect(isVisibleStatusChange('IN_PRODUCTION', 'ON_HOLD_BLOCKED')).toBe(true)
  })

  it('muestra los saltos de fase que sí le importan al cliente', () => {
    expect(isVisibleStatusChange('ORGANIZING', 'IN_PRODUCTION')).toBe(true)
    expect(isVisibleStatusChange('IN_PRODUCTION', 'WAITING_AESTHETIC_VALIDATION')).toBe(true)
    expect(isVisibleStatusChange('READY_FINAL_VALIDATION', 'SENT_TO_CLIENT')).toBe(true)
    expect(isVisibleStatusChange('SENT_TO_CLIENT', 'ARCHIVED')).toBe(true)
  })

  it('nunca marca visible un cambio de un estatus a sí mismo', () => {
    for (const status of ALL_STATUSES) {
      expect(isVisibleStatusChange(status, status), `${status} -> ${status}`).toBe(false)
    }
  })

  it('es simétrica: da igual el sentido del movimiento', () => {
    // Compara fases, no progreso, así que un retroceso es tan visible como el avance inverso.
    for (const a of ALL_STATUSES) {
      for (const b of ALL_STATUSES) {
        expect(isVisibleStatusChange(a, b), `simetría ${a}/${b}`).toBe(isVisibleStatusChange(b, a))
      }
    }
  })
})

describe('estatus legacy y desconocidos (filas históricas de ActivityLog)', () => {
  it('getClientPhase no lanza con ningún valor legacy', () => {
    // Lo mínimo exigible: la página del cliente no se cae por una fila vieja. Un throw aquí
    // tumba el Server Component completo, no solo el badge.
    for (const legacy of LEGACY_STATUSES) {
      expect(() => getClientPhase(asStatus(legacy)), `getClientPhase(${legacy})`).not.toThrow()
    }
  })

  it('getClientPhase devuelve undefined con un valor legacy, pese a prometer ClientPhase', () => {
    // BUG documentado (client-status.ts:58): la firma dice `: ClientPhase` pero el lookup en
    // un Record no valida nada, así que el valor real es undefined y TypeScript no lo ve.
    // Congelamos el comportamiento observado: si algún día se añade un fallback, este test
    // fallará y obligará a revisar los call sites que ya viven con el undefined.
    for (const legacy of LEGACY_STATUSES) {
      expect(getClientPhase(asStatus(legacy)), `getClientPhase(${legacy})`).toBeUndefined()
    }
  })

  it('null y undefined tampoco lanzan, pero también dan undefined', () => {
    expect(() => getClientPhase(null as unknown as ProjectStatus)).not.toThrow()
    expect(() => getClientPhase(undefined as unknown as ProjectStatus)).not.toThrow()
    expect(getClientPhase(null as unknown as ProjectStatus)).toBeUndefined()
    expect(getClientPhase(undefined as unknown as ProjectStatus)).toBeUndefined()
  })

  it('la cadena completa del dashboard con un estatus legacy no lanza y produce etiqueta vacía', () => {
    // Reproducimos literalmente dashboard/page.tsx:171 y projects/[id]/page.tsx:214:
    //   CLIENT_PHASE_LABELS[getClientPhase(details.newStatus as ProjectStatus)]
    // El resultado es undefined: React no revienta, pinta un badge sin texto. El cliente ve
    // un chip vacío en su timeline en vez del estado real. Degradación silenciosa, no crash.
    for (const legacy of LEGACY_STATUSES) {
      const phase = getClientPhase(asStatus(legacy))
      expect(() => CLIENT_PHASE_LABELS[phase]).not.toThrow()
      expect(CLIENT_PHASE_LABELS[phase], `etiqueta de ${legacy}`).toBeUndefined()
      expect(CLIENT_PHASE_COLORS[phase], `color de ${legacy}`).toBeUndefined()
      expect(getClientPhaseIndex(phase), `índice de ${legacy}`).toBe(-1)
    }
  })

  it('un cambio legacy -> legacy desaparece del timeline del cliente', () => {
    // undefined !== undefined es false, así que el filtro del dashboard descarta la entrada.
    // No es un crash pero sí pérdida de información: dos estatus retirados distintos entre sí
    // se consideran "el mismo sitio" y el movimiento no se le cuenta nunca al cliente.
    expect(isVisibleStatusChange(asStatus('WAITING_VALIDATION'), asStatus('DELIVERED'))).toBe(false)
    expect(isVisibleStatusChange(asStatus('DRAFT'), asStatus('CANCELLED'))).toBe(false)
  })

  it('un cambio legacy -> conocido sí se muestra, con la fase de origen en blanco', () => {
    // Mezcla peor: la entrada pasa el filtro (undefined !== 'PRODUCTION') y se renderiza
    // apoyándose en un lado del cambio que no existe en el mapa.
    expect(isVisibleStatusChange(asStatus('DELIVERED'), 'IN_PRODUCTION')).toBe(true)
    expect(isVisibleStatusChange('IN_PRODUCTION', asStatus('DELIVERED'))).toBe(true)
  })

  it('isVisibleStatusChange no lanza con ninguna combinación legacy/nula', () => {
    const dirty = [...LEGACY_STATUSES, null, undefined]
    for (const a of dirty) {
      for (const b of dirty) {
        expect(
          () => isVisibleStatusChange(a as unknown as ProjectStatus, b as unknown as ProjectStatus),
          `${String(a)} -> ${String(b)}`,
        ).not.toThrow()
      }
    }
  })

  it('una clave de Object.prototype devuelve un valor que NO es una fase ni undefined', () => {
    // BUG documentado (client-status.ts:5,58): CLIENT_PHASE_MAP es un objeto literal, hereda
    // Object.prototype, y ActivityLog.details es Json arbitrario. Con newStatus === 'toString'
    // el mapper devuelve una FUNCIÓN. Importa porque el arreglo obvio —`?? 'PREPARATION'`—
    // no atrapa este caso: el valor no es nullish. Haría falta un Object.hasOwn o un
    // Object.create(null). Con 'constructor' el valor devuelto es incluso construible.
    const viaToString: unknown = getClientPhase(asStatus('toString'))
    expect(typeof viaToString).toBe('function')
    expect(CLIENT_PHASE_ORDER).not.toContain(viaToString)

    for (const key of PROTO_KEYS) {
      const value: unknown = getClientPhase(asStatus(key))
      expect(value, `${key} no debería resolver a nada`).not.toBeUndefined()
      expect(CLIENT_PHASE_ORDER, `${key} no es una fase`).not.toContain(value)
    }
  })

  it('con claves heredadas isVisibleStatusChange miente sobre la visibilidad', () => {
    // 'toString' y 'valueOf' resuelven a funciones DISTINTAS, así que el cambio se reporta
    // como visible; 'toString' contra sí mismo resuelve a la misma función y se oculta.
    // Ninguna de las dos respuestas significa nada, y ninguna lanza.
    expect(isVisibleStatusChange(asStatus('toString'), asStatus('valueOf'))).toBe(true)
    expect(isVisibleStatusChange(asStatus('toString'), asStatus('toString'))).toBe(false)
    expect(isVisibleStatusChange(asStatus('constructor'), 'IN_PRODUCTION')).toBe(true)
  })
})

describe('APPROVAL_STATUS_LABELS / APPROVAL_STATUS_COLORS', () => {
  // Approval.status es String libre en el schema (prisma/schema.prisma:265), no un enum de
  // Prisma: la lista válida sólo existe como comentario. Por eso la fijamos aquí a mano.
  const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED']

  it('etiqueta y colorea exactamente los cuatro estatus documentados', () => {
    expect(Object.keys(APPROVAL_STATUS_LABELS).sort()).toEqual([...APPROVAL_STATUSES].sort())
    expect(Object.keys(APPROVAL_STATUS_COLORS).sort()).toEqual([...APPROVAL_STATUSES].sort())
  })

  it('las etiquetas están en francés y son las acordadas', () => {
    expect(APPROVAL_STATUS_LABELS).toEqual({
      PENDING: 'En attente',
      APPROVED: 'Approuvé',
      REJECTED: 'Rejeté',
      REVISION_REQUESTED: 'Modifications demandées',
    })
  })

  it('cada estatus trae bg, text y border, y ningún color se repite', () => {
    // El color es la única señal rápida de "esto está pendiente de mí" vs "esto ya se aprobó".
    for (const status of APPROVAL_STATUSES) {
      const classes = APPROVAL_STATUS_COLORS[status]
      expect(classes, `bg en ${status}`).toMatch(/\bbg-[a-z]+-\d{2,3}\/\d{1,3}\b/)
      expect(classes, `text en ${status}`).toMatch(/\btext-[a-z]+-\d{2,3}\b/)
      expect(classes, `border en ${status}`).toMatch(/\bborder-[a-z]+-\d{2,3}\/\d{1,3}\b/)
    }
    const values = APPROVAL_STATUSES.map((s) => APPROVAL_STATUS_COLORS[s])
    expect(new Set(values).size).toBe(APPROVAL_STATUSES.length)
  })

  it('APPROVED y REJECTED no comparten color: es la distinción crítica de la pantalla', () => {
    expect(APPROVAL_STATUS_COLORS.APPROVED).not.toBe(APPROVAL_STATUS_COLORS.REJECTED)
    expect(APPROVAL_STATUS_LABELS.APPROVED).not.toBe(APPROVAL_STATUS_LABELS.REJECTED)
  })

  it('un estatus fuera de la lista da undefined y no lanza', () => {
    // BUG documentado: los tres call sites (approvals/page.tsx:105, approvals/[id]/page.tsx:86,
    // dashboard/page.tsx:233) indexan estos Record<string, string> SIN `?? fallback`, al
    // contrario que CLIENT_ACTIVITY_LABELS y CLIENT_PRIORITY_LABELS que sí lo tienen. Como el
    // campo es String libre en la BD, un 'CHANGES_REQUESTED' escrito por el portal interno
    // deja el badge sin texto y sin clases de color en la pantalla de validaciones.
    for (const unknownStatus of ['CHANGES_REQUESTED', 'pending', 'DONE', '', 'toString']) {
      expect(() => APPROVAL_STATUS_LABELS[unknownStatus]).not.toThrow()
    }
    expect(APPROVAL_STATUS_LABELS.CHANGES_REQUESTED).toBeUndefined()
    expect(APPROVAL_STATUS_LABELS.pending).toBeUndefined()
    expect(APPROVAL_STATUS_COLORS.CHANGES_REQUESTED).toBeUndefined()
  })
})

describe('CLIENT_PRIORITY_LABELS / CLIENT_PRIORITY_COLORS', () => {
  const PRIORITIES = [1, 2, 3]

  it('cubre las tres prioridades del schema (1=urgent, 2=normal, 3=low)', () => {
    expect(Object.keys(CLIENT_PRIORITY_LABELS).sort()).toEqual(['1', '2', '3'])
    expect(Object.keys(CLIENT_PRIORITY_COLORS).sort()).toEqual(['1', '2', '3'])
  })

  it('etiqueta cada prioridad y no repite etiquetas ni colores', () => {
    expect(CLIENT_PRIORITY_LABELS[1]).toBe('Urgent')
    expect(CLIENT_PRIORITY_LABELS[2]).toBe('Normal')
    expect(CLIENT_PRIORITY_LABELS[3]).toBe('Bas')
    expect(new Set(PRIORITIES.map((p) => CLIENT_PRIORITY_LABELS[p])).size).toBe(3)
    expect(new Set(PRIORITIES.map((p) => CLIENT_PRIORITY_COLORS[p])).size).toBe(3)
  })

  it('respeta el default 2 del schema: prioridad normal siempre resuelve', () => {
    // Project.priority tiene @default(2) (prisma/schema.prisma:184). Si el 2 faltase, TODO
    // proyecto creado sin prioridad explícita caería al fallback `P2` del badge.
    expect(CLIENT_PRIORITY_LABELS[2]).toBeDefined()
    expect(CLIENT_PRIORITY_COLORS[2]).toBeDefined()
  })

  it('cada prioridad trae bg, text y border', () => {
    for (const priority of PRIORITIES) {
      const classes = CLIENT_PRIORITY_COLORS[priority]
      expect(classes, `bg en P${priority}`).toMatch(/\bbg-[a-z]+-\d{2,3}\/\d{1,3}\b/)
      expect(classes, `text en P${priority}`).toMatch(/\btext-[a-z]+-\d{2,3}\b/)
      expect(classes, `border en P${priority}`).toMatch(/\bborder-[a-z]+-\d{2,3}\/\d{1,3}\b/)
    }
  })

  it('una prioridad fuera de rango da undefined: el fallback del badge es carga real', () => {
    // priority es Int sin constraint en la BD, así que 0, 4 o 99 son perfectamente escribibles
    // desde el portal interno. ClientPriorityBadge:5-6 tiene `?? \`P${priority}\`` y `?? slate`,
    // y este test es lo que justifica que esos dos fallbacks no se puedan borrar.
    for (const outOfRange of [0, 4, -1, 99, 2.5, Number.NaN]) {
      expect(CLIENT_PRIORITY_LABELS[outOfRange], `label de ${outOfRange}`).toBeUndefined()
      expect(CLIENT_PRIORITY_COLORS[outOfRange], `color de ${outOfRange}`).toBeUndefined()
    }
  })
})

describe('CLIENT_VISIBLE_ACTIONS / CLIENT_ACTIVITY_LABELS', () => {
  it('es la lista exacta de acciones que el cliente puede ver, sin duplicados', () => {
    // Esta constante alimenta el `action: { in: [...] }` de las dos queries de ActivityLog
    // (dashboard/page.tsx:57, projects/[id]/page.tsx:75). Es un ALLOWLIST: añadir aquí una
    // acción interna —TASK_ASSIGNED, TIME_LOGGED, INVOICE_SENT— expone la mecánica interna
    // del estudio al cliente. Por eso se fija literalmente y no por forma.
    expect([...CLIENT_VISIBLE_ACTIONS]).toEqual([
      'PROJECT_CREATED',
      'STATUS_CHANGED',
      'FILE_UPLOADED',
      'APPROVAL_CREATED',
      'APPROVAL_APPROVED',
      'APPROVAL_REJECTED',
    ])
    expect(new Set(CLIENT_VISIBLE_ACTIONS).size).toBe(CLIENT_VISIBLE_ACTIONS.length)
  })

  it('no incluye ninguna acción de la mecánica interna del estudio', () => {
    const internalOnly = [
      'TASK_ASSIGNED',
      'TASK_COMPLETED',
      'TIME_LOGGED',
      'INVOICE_SENT',
      'INVOICE_PAID',
      'USER_ASSIGNED',
      'COMMENT_ADDED',
      'PROJECT_DELETED',
    ]
    for (const action of internalOnly) {
      expect([...CLIENT_VISIBLE_ACTIONS], `${action} no debe ser visible`).not.toContain(action)
    }
  })

  it('toda acción visible tiene etiqueta en francés', () => {
    // Acoplamiento real: se consulta por CLIENT_VISIBLE_ACTIONS y se renderiza por
    // CLIENT_ACTIVITY_LABELS. Una acción en la primera y no en la segunda cae al fallback
    // `?? log.action` y el cliente lee el identificador crudo, 'FILE_UPLOADED', en la UI.
    for (const action of CLIENT_VISIBLE_ACTIONS) {
      expect(CLIENT_ACTIVITY_LABELS[action], `etiqueta de ${action}`).toBeDefined()
      expect(CLIENT_ACTIVITY_LABELS[action].trim(), `etiqueta de ${action} no vacía`).not.toBe('')
      expect(CLIENT_ACTIVITY_LABELS[action], `${action} sin traducir`).not.toBe(action)
    }
  })

  it('no etiqueta acciones que el cliente no puede ver', () => {
    // El sentido inverso del acoplamiento: una etiqueta huérfana es señal de que alguien quitó
    // la acción del allowlist a medias, o de que planea meterla sin revisar la exposición.
    expect(Object.keys(CLIENT_ACTIVITY_LABELS).sort()).toEqual([...CLIENT_VISIBLE_ACTIONS].sort())
  })

  it('las etiquetas de actividad son las acordadas, en francés', () => {
    expect(CLIENT_ACTIVITY_LABELS).toEqual({
      PROJECT_CREATED: 'Projet créé',
      STATUS_CHANGED: 'Statut mis à jour',
      FILE_UPLOADED: 'Nouveau fichier disponible',
      APPROVAL_CREATED: 'Validation demandée',
      APPROVAL_APPROVED: 'Validation approuvée',
      APPROVAL_REJECTED: 'Modifications demandées',
    })
  })

  it('una acción desconocida da undefined y no lanza', () => {
    // ActivityLog.action es String libre; el call site tiene `?? log.action`, así que el
    // undefined es tolerable. Lo pinchamos para que quede claro que sin ese fallback la UI
    // mostraría un hueco.
    for (const action of ['TASK_ASSIGNED', 'unknown', '', 'toString']) {
      expect(() => CLIENT_ACTIVITY_LABELS[action]).not.toThrow()
    }
    expect(CLIENT_ACTIVITY_LABELS.TASK_ASSIGNED).toBeUndefined()
  })
})

describe('CLIENT_NAV_ITEMS', () => {
  it('expone las cuatro secciones del portal, en orden', () => {
    expect(CLIENT_NAV_ITEMS.map((item) => item.href)).toEqual([
      '/client/dashboard',
      '/client/projects',
      '/client/approvals',
      '/client/brand',
    ])
  })

  it('toda ruta vive bajo /client: nada apunta al portal interno', () => {
    // El portal interno comparte base de datos y convenciones de rutas. Un href a /admin o
    // /internal aquí sería un enlace visible al backoffice desde la sesión de un cliente.
    for (const item of CLIENT_NAV_ITEMS) {
      expect(item.href, `href de ${item.label}`).toMatch(/^\/client\//)
      expect(item.href, `${item.label} sin host externo`).not.toMatch(/^https?:/)
    }
  })

  it('no repite hrefs ni etiquetas', () => {
    expect(new Set(CLIENT_NAV_ITEMS.map((i) => i.href)).size).toBe(CLIENT_NAV_ITEMS.length)
    expect(new Set(CLIENT_NAV_ITEMS.map((i) => i.label)).size).toBe(CLIENT_NAV_ITEMS.length)
  })

  it('cada item trae etiqueta francesa e icono utilizable', () => {
    // No montamos nada: jsdom no está instalado. Sólo verificamos que el icono es un
    // componente (función o exotic component de React) y no un undefined por un import roto,
    // que es el fallo que en runtime tumba toda la barra de navegación.
    for (const item of CLIENT_NAV_ITEMS) {
      expect(item.label.trim(), `etiqueta de ${item.href}`).not.toBe('')
      expect(item.icon, `icono de ${item.href}`).toBeDefined()
      expect(['function', 'object'], `tipo del icono de ${item.href}`).toContain(typeof item.icon)
    }
    expect(CLIENT_NAV_ITEMS.map((i) => i.label)).toEqual([
      'Tableau de bord',
      'Projets',
      'Validations',
      'Univers marque',
    ])
  })

  it('ningún icono se reutiliza entre secciones', () => {
    expect(new Set(CLIENT_NAV_ITEMS.map((i) => i.icon)).size).toBe(CLIENT_NAV_ITEMS.length)
  })
})

describe('CLIENT_LABELS', () => {
  // Recorremos el árbol completo en vez de listar cada clave: CLIENT_LABELS crece con cada
  // pantalla nueva y una hoja vacía o dejada en inglés llega intacta a la UI del cliente,
  // porque los componentes no validan nada, sólo interpolan.
  function collectLeaves(node: unknown, path: string): Array<{ path: string; value: unknown }> {
    if (typeof node === 'object' && node !== null) {
      return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        collectLeaves(value, path ? `${path}.${key}` : key),
      )
    }
    return [{ path, value: node }]
  }

  const leaves = collectLeaves(CLIENT_LABELS, '')

  it('tiene hojas y todas son strings no vacíos', () => {
    expect(leaves.length).toBeGreaterThan(20)
    for (const leaf of leaves) {
      expect(typeof leaf.value, `${leaf.path} debe ser string`).toBe('string')
      expect(String(leaf.value).trim(), `${leaf.path} no vacío`).not.toBe('')
    }
  })

  it('ninguna hoja quedó como marcador de trabajo pendiente', () => {
    for (const leaf of leaves) {
      expect(String(leaf.value), `${leaf.path} sin TODO`).not.toMatch(/TODO|FIXME|XXX|Lorem/i)
    }
  })

  it('los textos de error y de acción son los acordados, en francés', () => {
    // Estos son los que ve el cliente en el peor momento (fallo de carga, acceso denegado):
    // un fallback en inglés aquí es lo más visible que puede romperse en la UI.
    expect(CLIENT_LABELS.errors).toEqual({
      generic: 'Une erreur est survenue',
      notFound: 'Page introuvable',
      unauthorized: 'Accès non autorisé',
    })
    expect(CLIENT_LABELS.actions.approve).toBe('Approuver')
    expect(CLIENT_LABELS.actions.requestChanges).toBe('Demander des modifications')
    expect(CLIENT_LABELS.welcome).toBe('Bienvenue')
  })

  it('cubre los cuatro KPI del dashboard y los cinco vacíos', () => {
    expect(Object.keys(CLIENT_LABELS.kpi).sort()).toEqual([
      'activeProjects',
      'completedThisMonth',
      'filesToReview',
      'pendingApprovals',
    ])
    expect(Object.keys(CLIENT_LABELS.empty).sort()).toEqual([
      'activity',
      'approvals',
      'brandAssets',
      'files',
      'projects',
    ])
  })
})
