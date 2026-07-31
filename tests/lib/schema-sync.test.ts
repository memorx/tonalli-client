import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProjectStatus, UserRole } from '@/generated/prisma/enums'

/**
 * Los dos portales comparten UNA base de datos. Sus schema.prisma tienen que
 * ser el mismo archivo, y durante meses no lo fueron.
 *
 * Cuando se detectó, la deriva era: 13 modelos ausentes aquí, 8 de los 17
 * modelos compartidos con campos distintos, y —lo peor— este repo declaraba
 * campos que la base ya no tiene (Task.ownerId, Project.leadAestheticId,
 * leadTechnicalId, verificado contra information_schema).
 *
 * No era teoría. Escondía un bug vivo: CLIENT_PHASE_MAP no tenía entrada para
 * GATE_1 ni GATE_2, así que un proyecto en validación le devolvía `undefined`
 * al cliente y la fase salía en blanco justo en el tramo previo a su entrega.
 * TypeScript no podía avisar porque comparaba contra el enum viejo.
 *
 * Estos tests son la valla para que no vuelva a pasar.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Los enums, fijados a mano
// ─────────────────────────────────────────────────────────────────────────────
// Escritos literalmente, no derivados del enum generado: comparar el enum
// consigo mismo sería una tautología que sigue verde después de regenerar
// desde un esquema viejo, que es exactamente el fallo que estamos cubriendo.

describe('ProjectStatus refleja el pipeline real de 2 puertas', () => {
  it('tiene exactamente los ocho estatus vigentes', () => {
    expect(Object.values(ProjectStatus).sort()).toEqual([
      'ARCHIVED',
      'CREATED',
      'GATE_1',
      'GATE_2',
      'IN_PRODUCTION',
      'ON_HOLD_BLOCKED',
      'SENT_TO_CLIENT',
      'SETUP',
    ])
  })

  it('no reaparecen los cinco estatus eliminados', () => {
    // El CLAUDE.md del portal interno los marca como REMOVED. Si vuelven, es
    // que alguien regeneró el cliente Prisma desde un esquema anterior.
    const statuses = Object.values(ProjectStatus) as string[]
    for (const gone of [
      'INCOMING',
      'ORGANIZING',
      'WAITING_AESTHETIC_VALIDATION',
      'WAITING_TECHNICAL_VALIDATION',
      'READY_FINAL_VALIDATION',
    ]) {
      expect(statuses, `${gone} está eliminado`).not.toContain(gone)
    }
  })
})

describe('UserRole refleja la fusión en CHEF_PROJECT', () => {
  it('tiene exactamente los siete roles vigentes', () => {
    expect(Object.values(UserRole).sort()).toEqual([
      'ADMINISTRATIVE',
      'ARTISTIC_CREATOR',
      'CHEF_PROJECT',
      'CLIENT_CONTACT',
      'COORDINATOR',
      'DESIGNER',
      'SUPPORT',
    ])
  })

  it('no reaparecen los dos roles fusionados', () => {
    const roles = Object.values(UserRole) as string[]
    expect(roles).not.toContain('LEAD_AESTHETIC')
    expect(roles).not.toContain('LEAD_TECHNICAL')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Comparación directa con el portal interno, cuando está al lado
// ─────────────────────────────────────────────────────────────────────────────

const INTERNAL_SCHEMA = join(process.cwd(), '..', 'bureau-tonalli', 'prisma', 'schema.prisma')

describe('schema.prisma es idéntico al del portal interno', () => {
  it('coincide byte a byte cuando el repo interno está presente', () => {
    if (!existsSync(INTERNAL_SCHEMA)) {
      // En CI el repo hermano no está clonado. Los tests de enums de arriba
      // cubren ese caso; esta comprobación es la que corre en la máquina de
      // quien trabaja con los dos repos a la vez, que es donde la deriva se
      // introduce.
      expect(true).toBe(true)
      return
    }

    const mine = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')
    const theirs = readFileSync(INTERNAL_SCHEMA, 'utf8')

    // Normalizado solo en finales de línea: Windows los reescribe al hacer
    // checkout y eso no es deriva.
    const norm = (s: string) => s.replace(/\r\n/g, '\n').trimEnd()

    expect(norm(mine)).toBe(norm(theirs))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Este repo no siembra
// ─────────────────────────────────────────────────────────────────────────────

describe('el portal del cliente no puede sembrar la base compartida', () => {
  it('no tiene seed propio', () => {
    // Tenía uno, de 505 líneas y distinto del interno. Referenciaba campos que
    // la base ya no tiene, así que ni siquiera podía ejecutarse — pero seguía
    // cableado en package.json apuntando a la MISMA base de producción que usa
    // el portal interno. Sembrar es trabajo de un solo repo.
    expect(existsSync(join(process.cwd(), 'prisma', 'seed.ts'))).toBe(false)
  })

  it('package.json no declara un comando de seed', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      prisma?: { seed?: string }
      scripts?: Record<string, string>
    }
    expect(pkg.prisma?.seed).toBeUndefined()
    for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
      expect(cmd, `script ${name}`).not.toMatch(/prisma\s+db\s+seed/)
    }
  })

  it('tampoco declara comandos de migración', () => {
    // Migrar desde aquí sería peor que sembrar: Prisma vería en la base 13
    // tablas que este esquema no declaraba y propondría BORRARLAS.
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
      expect(cmd, `script ${name}`).not.toMatch(/prisma\s+migrate/)
    }
  })
})
