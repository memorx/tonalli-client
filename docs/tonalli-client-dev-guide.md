# TONALLI CLIENT — Portal Cliente Bureau Tonalli

## Guia de Desarrollo para el Equipo

Made by Humans — Marzo 2026
v1.0 — Documento interno

---

## 1. Contexto del Proyecto

Bureau Tonalli es una agencia creativa de moda de lujo con sede en Paris. Sus clientes incluyen marcas como Givenchy, Cartier, Louis Vuitton, Jean Paul Gaultier, entre otras.

La plataforma digital de Bureau Tonalli tiene dos portales:

- **Portal Interno** (tonalli-internal) — Para el equipo de la agencia (~15 personas)
- **Portal Cliente** (tonalli-client) — Para los contactos de cada marca

Este repositorio es el **Portal del Cliente**. Ambos portales comparten la misma base de datos en Supabase (PostgreSQL, region Paris).

El idioma de toda la interfaz es frances. El codigo y la documentacion interna estan en ingles/espanol.

---

## 2. Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Lenguaje | TypeScript strict |
| Estilos | Tailwind CSS 4 + Radix UI primitives |
| Base de datos | PostgreSQL via Supabase (region eu-west-3) |
| ORM | Prisma 7 con driver adapters (pg) |
| Auth | NextAuth.js v5 (Auth.js) — Google OAuth + JWT |
| Validacion | Zod v4 |
| Testing | Vitest |
| Deploy | Vercel |

---

## 3. Setup Local

### 3.1 Requisitos previos

- Node.js 20+
- npm 10+
- Acceso al repo: `git@github.com:memorx/tonalli-client.git`
- Credenciales de Supabase (pedir a Memo)

### 3.2 Instalacion

```bash
git clone git@github.com:memorx/tonalli-client.git
cd tonalli-client
npm install
cp .env.example .env.local
```

Edita `.env.local` con las credenciales que te proporcione Memo.

### 3.3 Generar cliente Prisma

```bash
npx prisma generate
```

### 3.4 Levantar el servidor de desarrollo

```bash
PORT=3001 npm run dev
```

El portal corre en **puerto 3001** para no chocar con el portal interno (puerto 3000).

### 3.5 Acceder

Abre http://localhost:3001 — veras la pantalla de login.

Si `ENABLE_DEV_LOGIN=true`, podras seleccionar cualquier usuario del dropdown para login rapido sin necesidad de Google OAuth.

---

## 4. Estructura del Proyecto

### 4.1 Directorios principales

| Directorio | Descripcion |
|-----------|------------|
| `src/app/(auth)/` | Login page (Google OAuth + dev mode) |
| `src/app/(external)/` | Todas las paginas del portal del cliente |
| `src/app/api/external/` | API routes del cliente (projects, approvals) |
| `src/app/api/auth/` | NextAuth endpoints |
| `src/components/external/` | Componentes del portal del cliente |
| `src/components/ui/` | Componentes base (Avatar, Badge, Button, etc.) |
| `src/lib/` | Prisma, auth, external-auth, activity-log, notifications |
| `src/utils/` | Constantes, helpers, mapeo de estados |
| `prisma/` | Schema y seed (compartidos con portal interno) |

### 4.2 Paginas del portal

| Ruta | Archivo | Descripcion |
|------|---------|------------|
| `/client/dashboard` | `(external)/client/dashboard/page.tsx` | KPIs, actividad reciente, proyectos activos |
| `/client/projects` | `(external)/client/projects/page.tsx` | Lista de proyectos del cliente |
| `/client/projects/[id]` | `(external)/client/projects/[id]/page.tsx` | Detalle con timeline, archivos, actividad |
| `/client/approvals` | `(external)/client/approvals/page.tsx` | Lista de validaciones con filtros |
| `/client/approvals/[id]` | `(external)/client/approvals/[id]/page.tsx` | Detalle + aprobar/rechazar con feedback |
| `/client/brand` | `(external)/client/brand/page.tsx` | Logos, colores, tipografias, guidelines |

---

## 5. Conceptos Clave

### 5.1 Mapeo de fases del cliente

El cliente ve una vista simplificada de 5 fases. El mapeo se define en `src/utils/client-status.ts`:

| Status Interno | Fase Cliente | Label (FR) |
|---------------|-------------|-----------|
| SETUP, INCOMING, ORGANIZING | PREPARATION | En preparation |
| IN_PRODUCTION | PRODUCTION | En production |
| WAITING_*_VALIDATION, READY_FINAL | REVIEW | En revision interne |
| SENT_TO_CLIENT | YOUR_TURN | En attente de votre validation |
| ARCHIVED | COMPLETE | Termine |

### 5.2 Autenticacion y seguridad

El archivo clave es `src/lib/external-auth.ts`. Proporciona dos funciones:

- **`getClientSession()`** — Para Server Components. Valida sesion + rol CLIENT_CONTACT + clientId. Redirige si no autorizado.
- **`getClientSessionForApi()`** — Para API routes. Retorna null si no autorizado (no redirige).

**REGLA DE SEGURIDAD CRITICA:**

TODAS las queries a la base de datos DEBEN filtrar por `session.clientId`. Un cliente NUNCA debe ver datos de otro cliente. Siempre usa `where: { clientId: session.clientId }` o `where: { project: { clientId: session.clientId } }`.

### 5.3 Flujo de aprobaciones

El equipo interno crea un registro `Approval` vinculado a un `FileVersion` y un `Project`. El cliente lo ve en su dashboard y puede:

- **APROBAR** — Un clic, sin comentarios requeridos
- **SOLICITAR CAMBIOS** — Requiere feedback obligatorio

Al aprobar/rechazar se dispara: activity log + notificaciones al coordinador y al uploader del archivo.

---

## 6. API Routes

| Metodo | Ruta | Descripcion |
|--------|------|------------|
| GET | `/api/external/projects` | Lista proyectos del cliente autenticado |
| GET | `/api/external/approvals` | Lista todas las validaciones del cliente |
| GET | `/api/external/approvals/[id]` | Detalle de una validacion especifica |
| PATCH | `/api/external/approvals/[id]` | Aprobar o rechazar (body: `{action, feedback?}`) |

Formato de error consistente en todas las rutas:

```json
{ "error": "Mensaje en frances", "code": "VALIDATION_ERROR" }
```

---

## 7. Componentes Principales

| Componente | Tipo | Descripcion |
|-----------|------|------------|
| ExternalShell | Client Component | Layout principal: sidebar + header + main area |
| ClientSidebar | Client Component | Navegacion lateral con items de external-constants |
| ClientHeader | Client Component | Header con nombre cliente, notificaciones, avatar |
| ProjectCard | Server Component | Card de proyecto con fase, prioridad, deadline |
| ProjectProgressBar | Server Component | Barra de progreso 5 pasos (Preparation->Termine) |
| ApprovalActions | Client Component | Botones aprobar/rechazar con textarea de feedback |
| ClientKpiCard | Server Component | Tarjeta de metrica (proyectos activos, pending, etc.) |
| BrandColorCopy | Client Component | Color swatch con copy-to-clipboard |

---

## 8. Convenciones de Codigo

- **TypeScript strict** — cero `any`, cero `@ts-ignore`
- **React Server Components** por defecto, `'use client'` solo cuando es necesario (interactividad, hooks)
- **Imports con alias `@/`** — nunca rutas relativas largas
- **Textos de la UI siempre en frances**, sacados de archivos de constantes (nunca hardcodeados)
- **Fechas con dayjs** y locale frances: `dayjs.locale('fr')`
- **Errores de API** con formato consistente: `{ error: string, code?: string }`
- **Validacion de requests con Zod** en todos los API routes
- **Componentes**: un archivo por componente, nombre = PascalCase del archivo

---

## 9. Variables de Entorno

| Variable | Descripcion | Nota |
|----------|-----------|------|
| DATABASE_URL | Conexion pooled a Supabase | Misma que portal interno |
| DIRECT_URL | Conexion directa (migraciones/seed) | Misma que portal interno |
| NEXTAUTH_SECRET | Secret para firmar JWT | DEBE ser el mismo que portal interno |
| NEXTAUTH_URL | URL base del portal | http://localhost:3001 en dev |
| GOOGLE_CLIENT_ID | OAuth client ID | Configurar redirect URI por dominio |
| GOOGLE_CLIENT_SECRET | OAuth client secret | |
| ENABLE_DEV_LOGIN | Habilita login rapido sin OAuth | Solo true en dev/staging |

---

## 10. Roadmap / Tareas Pendientes

1. Notificaciones en tiempo real (Supabase Realtime)
2. Descarga/preview de archivos desde R2 storage
3. Pagina de facturas del cliente (`/client/invoices`)
4. Integracion WhatsApp (Twilio) para notificaciones de aprobacion
5. Push notifications (app movil — Fase 3)
6. Chat integrado con el equipo del proyecto
7. Soporte multi-idioma (FR/EN)

---

Dudas? Contacta a Memo (Guillermo Sanchez, CTO)
