# Tonalli Client — Portal Cliente Bureau Tonalli

## Project Overview

Portal externo (cliente) de Bureau Tonalli, una agencia creativa de moda de lujo en París. Este portal permite a los clientes (Givenchy, Cartier, Louis Vuitton, etc.) ver el estado de sus proyectos, aprobar/rechazar entregables, y consultar los activos de su marca.

**Este repositorio es SOLO el portal del cliente.** El portal interno del equipo vive en un repo separado (`tonalli-internal`). Ambos comparten la misma base de datos Supabase (PostgreSQL).

**Idioma de la UI:** Francés.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 (App Router) | React 19, TypeScript strict |
| Styling | Tailwind CSS 4 + Radix UI | Dark theme, luxury aesthetic |
| Database | PostgreSQL via Supabase | Shared with internal portal |
| ORM | Prisma 7 (driver adapters) | Schema shared with internal portal |
| Auth | NextAuth.js v5 (Auth.js) | Google OAuth, JWT strategy |
| Validation | Zod | Request validation |
| Testing | Vitest 4 | 228 tests en 9 archivos, entorno node |
| Deploy | Vercel | Separate project from internal |

---

## Project Structure

```
tonalli-client/
  src/
    app/
      (auth)/login/          # Login page (Google OAuth + dev mode)
      (external)/            # Client portal pages
        client/dashboard/    # KPI overview, recent activity
        client/projects/     # Project list
        client/projects/[id] # Project detail (timeline, files)
        client/approvals/    # Approval list with filters
        client/approvals/[id]# Approval detail + approve/reject
        client/brand/        # Brand universe (logos, colors, typo)
      api/
        auth/[...nextauth]/  # NextAuth endpoints
        external/            # Client-facing API routes
          projects/          # GET: list client projects
          approvals/         # GET: list, PATCH [id]: approve/reject
    components/
      ui/                    # Base components (Avatar, Badge, Button, etc.)
      external/              # Client portal components
      auth/                  # LoginForm
      shared/                # PageError
    lib/
      auth.ts                # NextAuth config (Google + dev credentials)
      prisma.ts              # Prisma client singleton
      external-auth.ts       # getClientSession / getClientSessionForApi
      activity-log.ts        # Activity logging
      notifications.ts       # Notification creation
    utils/
      cn.ts                  # clsx + tailwind-merge
      client-status.ts       # ProjectStatus → ClientPhase mapping
      external-constants.ts  # Nav items, labels, colors (all French)
      constants.ts           # Role labels (for login)
  prisma/
    schema.prisma            # Full schema (shared with internal)
    seed.ts                  # Full seed (shared with internal)
```

---

## Key Concepts

### Client Phase Mapping

The client sees a simplified 5-phase view of project status:

| Internal Status | Client Phase | Client Label |
|----------------|-------------|-------------|
| SETUP, INCOMING, ORGANIZING, ON_HOLD_BLOCKED | PREPARATION | En préparation |
| IN_PRODUCTION | PRODUCTION | En production |
| WAITING_AESTHETIC/TECHNICAL_VALIDATION, READY_FINAL | REVIEW | En révision interne |
| SENT_TO_CLIENT | YOUR_TURN | En attente de votre validation |
| ARCHIVED | COMPLETE | Terminé |

### Auth Flow

1. Client contacts have role `CLIENT_CONTACT` and a `clientId` foreign key
2. `getClientSession()` validates role + clientId, redirects unauthorized users
3. All data queries are scoped to `session.clientId` — clients ONLY see their own data.
   Lo vigila `tests/app/external-pages-tenancy.test.tsx`, que afirma sobre los
   ARGUMENTOS con que cada una de las 6 páginas llama a Prisma, no sobre el HTML.
   Es la frontera real: una aserción sobre lo pintado pasaría igual si la consulta
   trajera de más y el componente casualmente no lo mostrara.

   Ojo con el historial del detalle de proyecto: su `where` es
   `{ projectId, action: { in: … } }` y NO menciona la marca. Es seguro sólo
   porque corre después de que la página resolvió el proyecto con
   `findFirst({ id, clientId })` y llamó a `notFound()`. Mover esa consulta arriba
   del guard, o pasarle el id crudo de la URL en vez de `project.id`, filtraría el
   historial de otra marca sin tocar una sola línea que mencione `clientId`.
4. Non-CLIENT_CONTACT users are redirected to `/login`

### Approval Workflow

1. Internal team creates an `Approval` record linked to a `FileVersion` + `Project`
2. Client sees pending approvals on dashboard and approvals page
3. Client can APPROVE (one-click) or REQUEST_CHANGES (requires feedback)
4. Action triggers activity log + notifications to coordinator and file uploader

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in values
cp .env.example .env.local
# NOTE: Use port 3001 to avoid conflicting with internal portal on 3000

# 3. Generate Prisma client
npx prisma generate

# 4. Run dev server on port 3001
PORT=3001 npm run dev

# 5. (Optional) Seed database if starting fresh
npx prisma db seed
```

**Important:** This portal shares the database with the internal portal. If the internal portal has already seeded the database, you do NOT need to re-seed.

---

## Environment Variables

Only these are needed for the client portal:

```env
DATABASE_URL=        # Supabase pooled connection
DIRECT_URL=          # Supabase direct connection (for migrations/seed)
NEXTAUTH_SECRET=     # Same secret as internal portal
NEXTAUTH_URL=        # http://localhost:3001 (or production URL)
GOOGLE_CLIENT_ID=    # Google OAuth
GOOGLE_CLIENT_SECRET=
ENABLE_DEV_LOGIN=    # "true" to enable dev login dropdown.
                     # NO funciona en un build de producción: el provider exige
                     # además NODE_ENV !== 'production'. Autentica con solo un
                     # userId, sin contraseña, así que en producción sería una
                     # puerta a la cuenta de cualquier contacto. Ver
                     # tests/lib/dev-login-gate.test.ts.
```

---

## Coding Conventions

- **TypeScript strict** — no `any` types
- **React Server Components** by default, `'use client'` only when needed
- **API routes** — use Zod for request validation, consistent error format: `{ error: string, code?: string }`
- **Auth** — ALWAYS check session + role in every protected route
- **Security** — ALL queries MUST be scoped to `session.clientId`. Never expose data from other clients.
- **UI language** — French. Use constants files, never hardcode text.
- **Dates** — dayjs with French locale
- **Imports** — use `@/` path alias

---

## Deployment (Vercel)

1. Create a new Vercel project pointing to this repo
2. Set environment variables (same DATABASE_URL as internal portal)
3. Set NEXTAUTH_URL to production domain
4. Configure Google OAuth redirect URI for this domain
5. Build command: `next build` (default)

---

## Roadmap / TODO

- [ ] Client notifications (real-time via Supabase Realtime)
- [ ] File download/preview from R2 storage
- [ ] Client invoices page (`/client/invoices`)
- [ ] WhatsApp integration (Twilio) for approval notifications
- [ ] Push notifications (mobile app — Phase 3)
- [ ] Client-side chat with project team
- [ ] Multi-language support (FR/EN)
