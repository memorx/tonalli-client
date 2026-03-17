# Onboarding — Tonalli Client (Portal Cliente Bureau Tonalli)

## Bienvenido al equipo

Este repositorio es el **portal del cliente** de Bureau Tonalli, una agencia creativa de moda de lujo en Paris. Los clientes de la agencia (Givenchy, Cartier, Louis Vuitton, etc.) usan este portal para seguir sus proyectos, aprobar entregables, y consultar activos de marca.

> **Importante:** Este repo es SOLO el portal del cliente. El portal interno del equipo vive en un repo separado (`tonalli-internal`). Ambos comparten la misma base de datos Supabase.

---

## Documentacion disponible

Lee estos documentos en este orden:

| # | Documento | Que contiene |
|---|-----------|-------------|
| 1 | `docs/tonalli-client-dev-guide.md` | **Empieza aqui.** Guia de desarrollo: setup local, estructura del proyecto, convenciones de codigo, componentes, API routes, variables de entorno. |
| 2 | `docs/BureauTonalli_Arquitectura_Fase2_Portal_Cliente.docx` | Arquitectura detallada del portal del cliente: modelo de estados simplificado, flujo de aprobaciones, specs de cada pagina, seguridad, notificaciones, diseno visual. |
| 3 | `docs/BureauTonalli_Arquitectura_Tecnica_v2.docx` | Arquitectura tecnica completa del sistema: modelo de datos, pipeline de validacion en 3 puertas, integraciones, agentes AI, auth, real-time, deploy. |
| 4 | `CLAUDE.md` (raiz del proyecto) | Referencia tecnica rapida para Claude Code: stack, estructura, convenciones, enums, reglas de negocio. |

---

## Setup rapido

### Requisitos
- Node.js 20+
- npm 10+
- Acceso al repo: `git@github.com:memorx/tonalli-client.git`
- Credenciales de Supabase (pedir a Memo)

### Instalacion

```bash
git clone git@github.com:memorx/tonalli-client.git
cd tonalli-client
npm install
cp .env.example .env.local   # pide las credenciales a Memo
npx prisma generate
PORT=3001 npm run dev
```

Abre http://localhost:3001 — deberias ver la pantalla de login.

> **Puerto 3001**: Este portal corre en puerto 3001 para no chocar con el portal interno (puerto 3000).

### Login en modo desarrollo

Si `ENABLE_DEV_LOGIN=true` en tu `.env.local`, veras un dropdown para seleccionar cualquier usuario sin necesidad de Google OAuth. Selecciona un usuario con rol `CLIENT_CONTACT` para ver el portal del cliente.

---

## Estructura del proyecto

```
tonalli-client/
  docs/                           <- Documentacion (estas aqui)
  prisma/
    schema.prisma                 <- Schema completo (compartido con portal interno)
    seed.ts                       <- Datos de prueba
  src/
    app/
      (auth)/login/               <- Pagina de login
      (external)/client/          <- TODAS las paginas del portal
        dashboard/                <- KPIs, actividad reciente, proyectos
        projects/                 <- Lista de proyectos
        projects/[id]/            <- Detalle de proyecto (timeline, archivos)
        approvals/                <- Lista de validaciones con filtros
        approvals/[id]/           <- Detalle + aprobar/rechazar
        brand/                    <- Logos, colores, tipografias
      api/
        auth/[...nextauth]/       <- NextAuth endpoints
        external/                 <- API routes del cliente
          projects/               <- GET: lista proyectos
          approvals/              <- GET: lista, PATCH [id]: aprobar/rechazar
    components/
      external/                   <- Componentes del portal del cliente
      ui/                         <- Componentes base (Avatar, Badge, Button, etc.)
    lib/
      external-auth.ts            <- getClientSession() — CLAVE para seguridad
    utils/
      client-status.ts            <- Mapeo de estados internos -> fases del cliente
      external-constants.ts       <- Labels, colores, navegacion (todo en frances)
```

---

## Regla #1 de seguridad

> **TODAS las queries a la base de datos DEBEN filtrar por `session.clientId`.**
>
> Un cliente NUNCA debe ver datos de otro cliente. Si escribes una query a Prisma sin `where: { clientId: session.clientId }`, es un bug de seguridad.

Ejemplo correcto:
```typescript
const session = await getClientSession()
const projects = await prisma.project.findMany({
  where: { clientId: session.clientId },  // <- SIEMPRE
})
```

---

## Convenciones importantes

- **UI en frances** — Todos los textos de la interfaz estan en frances. Usa los archivos de constantes (`external-constants.ts`), nunca hardcodees strings.
- **TypeScript strict** — Cero `any`, cero `@ts-ignore`.
- **Server Components** por defecto — Solo usa `'use client'` cuando necesites interactividad (hooks, event handlers).
- **Dark theme** — El portal del cliente usa un theme oscuro estilo luxury. Los colores estan definidos en `globals.css` bajo `.dark`.
- **dayjs con locale frances** — Siempre `dayjs.locale('fr')` para fechas.

---

## Tareas pendientes (Roadmap)

1. Notificaciones en tiempo real (Supabase Realtime)
2. Descarga/preview de archivos desde R2 storage
3. Pagina de facturas del cliente (`/client/invoices`)
4. Integracion WhatsApp (Twilio) para notificaciones de aprobacion
5. Chat integrado con el equipo del proyecto
6. Soporte multi-idioma (FR/EN)

---

## Dudas

Contacta a **Memo (Guillermo Sanchez, CTO)** por Slack o WhatsApp.
