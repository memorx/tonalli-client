// prisma/seed.ts
// Bureau Tonalli — Seed data based on real team and operations
// Run with: npx prisma db seed
// IDEMPOTENT: safe to run multiple times without creating duplicates

import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, UserRole, ProjectStatus, ProjectPhase, TaskStatus, TaskType, ValidationStatus, RiskType } from '../src/generated/prisma/client.js'

const connectionString = process.env['DIRECT_URL'] || process.env['DATABASE_URL']
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0])
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding Bureau Tonalli database...')

  // ══════════════════════════════════════════════
  // TEAM MEMBERS
  // ══════════════════════════════════════════════

  const alonso = await prisma.user.upsert({
    where: { email: 'alonso@bureautonalli.com' },
    update: {},
    create: {
      email: 'alonso@bureautonalli.com',
      name: 'Alonso',
      role: UserRole.ARTISTIC_CREATOR,
      isActive: true,
    },
  })

  const mar = await prisma.user.upsert({
    where: { email: 'mar@bureautonalli.com' },
    update: {},
    create: {
      email: 'mar@bureautonalli.com',
      name: 'Mar',
      role: UserRole.COORDINATOR,
      isActive: true,
    },
  })

  const flavien = await prisma.user.upsert({
    where: { email: 'flavien@bureautonalli.com' },
    update: {},
    create: {
      email: 'flavien@bureautonalli.com',
      name: 'Flavien',
      role: UserRole.LEAD_AESTHETIC,
      isActive: true,
    },
  })

  const zach = await prisma.user.upsert({
    where: { email: 'zach@bureautonalli.com' },
    update: {},
    create: {
      email: 'zach@bureautonalli.com',
      name: 'Zach',
      role: UserRole.LEAD_TECHNICAL,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { email: 'ximena@bureautonalli.com' },
    update: {},
    create: {
      email: 'ximena@bureautonalli.com',
      name: 'Ximena',
      role: UserRole.SUPPORT,
      isActive: true,
    },
  })

  await prisma.user.upsert({
    where: { email: 'marjorie@bureautonalli.com' },
    update: {},
    create: {
      email: 'marjorie@bureautonalli.com',
      name: 'Marjorie',
      role: UserRole.ADMINISTRATIVE,
      isActive: true,
    },
  })

  // Designers
  const designerNames = ['Emile', 'Andrade', 'Charles', 'Mathias', 'Yvan', 'Paul', 'Gabriel', 'Remy', 'Bynn']
  const designers = await Promise.all(
    designerNames.map(name =>
      prisma.user.upsert({
        where: { email: `${name.toLowerCase()}@bureautonalli.com` },
        update: {},
        create: {
          email: `${name.toLowerCase()}@bureautonalli.com`,
          name,
          role: UserRole.DESIGNER,
          isActive: true,
        },
      })
    )
  )

  console.log(`  ${6 + designers.length} team members upserted`)

  // ══════════════════════════════════════════════
  // CLIENTS (luxury brands)
  // ══════════════════════════════════════════════

  const clients = await Promise.all([
    { name: 'Givenchy', industry: 'Haute Couture' },
    { name: 'Cartier', industry: 'Joaillerie' },
    { name: 'Louis Vuitton', industry: 'Maroquinerie & Mode' },
    { name: 'Jean Paul Gaultier', industry: 'Haute Couture' },
    { name: 'Azzaro', industry: 'Parfumerie & Mode' },
    { name: 'Diesel', industry: 'Mode & Lifestyle' },
    { name: 'YSL', industry: 'Mode & Beaute' },
    { name: 'Frederic Malle', industry: 'Parfumerie de niche' },
    { name: 'Initio', industry: 'Parfumerie de niche' },
  ].map(c =>
    prisma.client.upsert({
      where: { id: c.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: {
        id: c.name.toLowerCase().replace(/\s+/g, '-'),
        name: c.name,
        email: `contact@${c.name.toLowerCase().replace(/\s+/g, '')}.com`,
        industry: c.industry,
      },
    })
  ))

  console.log(`  ${clients.length} clients upserted`)

  // ══════════════════════════════════════════════
  // SAMPLE PROJECTS (various statuses to test pipeline)
  // ══════════════════════════════════════════════

  const sampleProjects = [
    {
      name: 'Campagne Printemps 2026',
      clientId: clients[0].id, // Givenchy
      status: ProjectStatus.IN_PRODUCTION,
      phase: ProjectPhase.PRODUCTION,
      priority: 1,
      risk: RiskType.NONE,
    },
    {
      name: 'Collection Capsule Ete',
      clientId: clients[1].id, // Cartier
      status: ProjectStatus.WAITING_AESTHETIC_VALIDATION,
      phase: ProjectPhase.AESTHETIC,
      priority: 1,
      risk: RiskType.AESTHETIC,
    },
    {
      name: 'Lancement Parfum "Nuit"',
      clientId: clients[4].id, // Azzaro
      status: ProjectStatus.WAITING_TECHNICAL_VALIDATION,
      phase: ProjectPhase.TECHNICAL,
      priority: 2,
      risk: RiskType.NONE,
    },
    {
      name: 'Refonte Identite Visuelle',
      clientId: clients[5].id, // Diesel
      status: ProjectStatus.READY_FINAL_VALIDATION,
      phase: ProjectPhase.FINAL,
      priority: 2,
      risk: RiskType.NONE,
    },
    {
      name: 'Social Media Q1 2026',
      clientId: clients[6].id, // YSL
      status: ProjectStatus.ORGANIZING,
      phase: ProjectPhase.ORGANIZATION,
      priority: 3,
      risk: RiskType.EXTERNAL,
    },
    {
      name: 'Packaging Collector',
      clientId: clients[7].id, // Frederic Malle
      status: ProjectStatus.SENT_TO_CLIENT,
      phase: ProjectPhase.FINAL,
      priority: 2,
      risk: RiskType.NONE,
    },
    {
      name: 'Campagne Digitale Hiver',
      clientId: clients[2].id, // Louis Vuitton
      status: ProjectStatus.IN_PRODUCTION,
      phase: ProjectPhase.PRODUCTION,
      priority: 1,
      risk: RiskType.TECHNICAL,
    },
    {
      name: 'Lookbook SS26',
      clientId: clients[3].id, // JPG
      status: ProjectStatus.INCOMING,
      phase: ProjectPhase.ORGANIZATION,
      priority: 2,
      risk: RiskType.NONE,
    },
  ]

  const projects = await Promise.all(
    sampleProjects.map(async (p) => {
      const existing = await prisma.project.findFirst({
        where: { name: p.name, clientId: p.clientId },
      })
      if (existing) return existing
      return prisma.project.create({
        data: {
          name: p.name,
          clientId: p.clientId,
          status: p.status,
          currentPhase: p.phase,
          priority: p.priority,
          risk: p.risk,
          startDate: new Date('2026-01-15'),
          deadline: new Date('2026-04-30'),
          opsOwnerId: mar.id,
          leadAestheticId: flavien.id,
          leadTechnicalId: zach.id,
        },
      })
    })
  )

  console.log(`  ${projects.length} projects ensured`)

  // ══════════════════════════════════════════════
  // SAMPLE TASKS (distributed across designers)
  // ══════════════════════════════════════════════

  const taskTemplates = [
    { name: 'Direction artistique', type: TaskType.CREATIVE },
    { name: 'Recherche visuelle', type: TaskType.CREATIVE },
    { name: 'Maquette principale', type: TaskType.CREATIVE },
    { name: 'Declinaisons formats', type: TaskType.PRODUCTION },
    { name: 'Retouche photo', type: TaskType.PRODUCTION },
    { name: 'Adaptation print', type: TaskType.TECHNICAL },
    { name: 'Preparation fichiers', type: TaskType.TECHNICAL },
  ]

  let taskCount = 0
  // Use a stable seed for "random" designer assignment to be idempotent
  const designerOrder = [0, 3, 6, 1, 4, 7, 2, 5, 8]

  for (let pi = 0; pi < Math.min(5, projects.length); pi++) {
    const project = projects[pi]
    const numTasks = 3 + (pi % 4) // 3-6 tasks per project, deterministic

    for (let i = 0; i < numTasks; i++) {
      const template = taskTemplates[i % taskTemplates.length]
      const ownerIdx = designerOrder[(pi * 7 + i) % designerOrder.length]
      const owner = designers[ownerIdx % designers.length]
      const needsValidation = i % 3 !== 0 // ~66% need validation, deterministic

      const existingTask = await prisma.task.findFirst({
        where: { name: template.name, projectId: project.id },
      })
      if (!existingTask) {
        await prisma.task.create({
          data: {
            name: template.name,
            type: template.type,
            status: TaskStatus.IN_PROGRESS,
            validationStatus: needsValidation ? ValidationStatus.WAITING : ValidationStatus.NOT_REQUIRED,
            priority: project.priority,
            dueDate: new Date('2026-03-15'),
            projectId: project.id,
            ownerId: owner.id,
            validatorId: needsValidation
              ? (template.type === TaskType.CREATIVE ? flavien.id :
                 template.type === TaskType.TECHNICAL ? zach.id : flavien.id)
              : null,
          },
        })
        taskCount++
      }
    }
  }

  console.log(`  ${taskCount} tasks created (skipped existing)`)

  // ══════════════════════════════════════════════
  // BRAND ASSETS (idempotent with findFirst + create)
  // ══════════════════════════════════════════════

  const allBrandAssets = [
    // Givenchy
    { name: 'Logo Principal', type: 'LOGO' as const, value: '/assets/givenchy-logo.svg', clientId: clients[0].id },
    { name: 'Noir Givenchy', type: 'COLOR' as const, value: '#1A1A1A', clientId: clients[0].id },
    { name: 'Blanc Casse', type: 'COLOR' as const, value: '#F5F0EB', clientId: clients[0].id },
    { name: 'Or Signature', type: 'COLOR' as const, value: '#C4A265', clientId: clients[0].id },
    { name: 'Typographie Principale', type: 'TYPOGRAPHY' as const, value: 'Didot', clientId: clients[0].id },
    { name: 'Typographie Secondaire', type: 'TYPOGRAPHY' as const, value: 'Helvetica Neue', clientId: clients[0].id },
    // Cartier
    { name: 'Logo Cartier', type: 'LOGO' as const, value: '/assets/cartier-logo.svg', clientId: clients[1].id },
    { name: 'Rouge Cartier', type: 'COLOR' as const, value: '#8B0000', clientId: clients[1].id },
    { name: 'Or Cartier', type: 'COLOR' as const, value: '#D4AF37', clientId: clients[1].id },
    { name: 'Blanc Cartier', type: 'COLOR' as const, value: '#FFFDF7', clientId: clients[1].id },
    { name: 'Typographie Cartier', type: 'TYPOGRAPHY' as const, value: 'Cartier', clientId: clients[1].id },
    // Louis Vuitton
    { name: 'Logo LV', type: 'LOGO' as const, value: '/assets/lv-logo.svg', clientId: clients[2].id },
    { name: 'Brun LV', type: 'COLOR' as const, value: '#6B4226', clientId: clients[2].id },
    { name: 'Or LV', type: 'COLOR' as const, value: '#C2A050', clientId: clients[2].id },
    { name: 'Creme LV', type: 'COLOR' as const, value: '#F5EFE0', clientId: clients[2].id },
    { name: 'Typographie LV', type: 'TYPOGRAPHY' as const, value: 'Futura', clientId: clients[2].id },
    // Frederic Malle
    { name: 'Logo Frederic Malle', type: 'LOGO' as const, value: '/assets/frederic-malle-logo.svg', clientId: clients[7].id },
    { name: 'Noir Malle', type: 'COLOR' as const, value: '#1C1C1C', clientId: clients[7].id },
    { name: 'Rouge Malle', type: 'COLOR' as const, value: '#8B2500', clientId: clients[7].id },
    { name: 'Ivoire Malle', type: 'COLOR' as const, value: '#FFFFF0', clientId: clients[7].id },
    { name: 'Typographie Malle', type: 'TYPOGRAPHY' as const, value: 'Garamond', clientId: clients[7].id },
  ]

  let assetCount = 0
  for (const asset of allBrandAssets) {
    const existing = await prisma.brandAsset.findFirst({
      where: { name: asset.name, clientId: asset.clientId },
    })
    if (!existing) {
      await prisma.brandAsset.create({ data: asset })
      assetCount++
    }
  }

  console.log(`  ${assetCount} brand assets created (skipped existing)`)

  // ══════════════════════════════════════════════
  // CLIENT_CONTACT USERS
  // ══════════════════════════════════════════════

  const sophie = await prisma.user.upsert({
    where: { email: 'sophie@givenchy.com' },
    update: {},
    create: {
      email: 'sophie@givenchy.com',
      name: 'Sophie Laurent',
      role: UserRole.CLIENT_CONTACT,
      isActive: true,
      clientId: clients[0].id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'pierre@cartier.com' },
    update: {},
    create: {
      email: 'pierre@cartier.com',
      name: 'Pierre Dumont',
      role: UserRole.CLIENT_CONTACT,
      isActive: true,
      clientId: clients[1].id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'isabelle@louisvuitton.com' },
    update: {},
    create: {
      email: 'isabelle@louisvuitton.com',
      name: 'Isabelle Martin',
      role: UserRole.CLIENT_CONTACT,
      isActive: true,
      clientId: clients[2].id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'marie@jpgaultier.com' },
    update: {},
    create: {
      email: 'marie@jpgaultier.com',
      name: 'Marie Dubois',
      role: UserRole.CLIENT_CONTACT,
      isActive: true,
      clientId: clients[3].id,
    },
  })

  console.log('  4 client contacts upserted')

  // ══════════════════════════════════════════════
  // FILE VERSIONS (for SENT_TO_CLIENT project)
  // ══════════════════════════════════════════════

  const sentProject = projects[5] // Packaging Collector — SENT_TO_CLIENT

  const fileData = [
    { filename: 'Packaging_Collector_v3.pdf', mimeType: 'application/pdf', size: 4_718_592, version: 3, storageUrl: 'https://r2.bureautonalli.com/files/packaging-collector-v3.pdf', thumbnailUrl: 'https://r2.bureautonalli.com/thumbs/packaging-collector-v3.jpg', uploaderId: designers[0].id },
    { filename: 'Visuel_Principal_v2.jpg', mimeType: 'image/jpeg', size: 8_597_504, version: 2, storageUrl: 'https://r2.bureautonalli.com/files/visuel-principal-v2.jpg', thumbnailUrl: 'https://r2.bureautonalli.com/thumbs/visuel-principal-v2.jpg', uploaderId: designers[1].id },
    { filename: 'Logo_Variante_Gold.svg', mimeType: 'image/svg+xml', size: 128_000, version: 1, storageUrl: 'https://r2.bureautonalli.com/files/logo-variante-gold.svg', thumbnailUrl: null, uploaderId: designers[2].id },
  ]

  const files = []
  for (const fd of fileData) {
    const existing = await prisma.fileVersion.findFirst({
      where: { filename: fd.filename, projectId: sentProject.id },
    })
    if (existing) {
      files.push(existing)
    } else {
      const file = await prisma.fileVersion.create({
        data: { ...fd, projectId: sentProject.id },
      })
      files.push(file)
    }
  }

  console.log(`  ${files.length} file versions ensured`)

  // ══════════════════════════════════════════════
  // APPROVALS
  // ══════════════════════════════════════════════

  const approvalData = [
    { status: 'PENDING' as const, fileId: files[0].id, reviewerId: sophie.id, reviewedAt: null },
    { status: 'PENDING' as const, fileId: files[1].id, reviewerId: sophie.id, reviewedAt: null },
    { status: 'APPROVED' as const, fileId: files[2].id, reviewerId: sophie.id, reviewedAt: new Date('2026-02-10') },
  ]

  let approvalCount = 0
  for (const ad of approvalData) {
    const existing = await prisma.approval.findFirst({
      where: { fileId: ad.fileId, reviewerId: ad.reviewerId },
    })
    if (!existing) {
      await prisma.approval.create({
        data: {
          status: ad.status,
          projectId: sentProject.id,
          fileId: ad.fileId,
          reviewerId: ad.reviewerId,
          reviewedAt: ad.reviewedAt,
        },
      })
      approvalCount++
    }
  }

  console.log(`  ${approvalCount} approvals created (skipped existing)`)

  // ══════════════════════════════════════════════
  // ACTIVITY LOGS (append-only — skip if project already has logs)
  // ══════════════════════════════════════════════

  const existingLogCount = await prisma.activityLog.count({ where: { projectId: sentProject.id } })

  if (existingLogCount === 0) {
    await prisma.activityLog.createMany({
      data: [
        {
          action: 'PROJECT_CREATED',
          userId: mar.id,
          projectId: sentProject.id,
          createdAt: new Date('2026-01-10T09:00:00Z'),
        },
        {
          action: 'STATUS_CHANGED',
          userId: mar.id,
          projectId: sentProject.id,
          details: { oldStatus: 'ORGANIZING', newStatus: 'IN_PRODUCTION' },
          createdAt: new Date('2026-01-20T14:30:00Z'),
        },
        {
          action: 'STATUS_CHANGED',
          userId: alonso.id,
          projectId: sentProject.id,
          details: { oldStatus: 'READY_FINAL_VALIDATION', newStatus: 'SENT_TO_CLIENT' },
          createdAt: new Date('2026-02-05T11:00:00Z'),
        },
        {
          action: 'FILE_UPLOADED',
          userId: designers[0].id,
          projectId: sentProject.id,
          details: { filename: 'Packaging_Collector_v3.pdf' },
          createdAt: new Date('2026-02-08T16:45:00Z'),
        },
      ],
    })
    console.log('  4 activity logs created')
  } else {
    console.log(`  Activity logs skipped (${existingLogCount} already exist)`)
  }

  console.log('\nSeed complete!')
  console.log(`   Team: ${6 + designers.length} internal + 4 client contacts`)
  console.log(`   Clients: ${clients.length} luxury brands`)
  console.log(`   Projects: ${projects.length} (various pipeline stages)`)
}

main()
  .catch(e => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
