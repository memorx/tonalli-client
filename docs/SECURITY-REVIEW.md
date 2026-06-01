# Security Review — F2 sprint (2026-06)

**Scope:** review of the 7 PRs landed in the Fase 2 sprint of `tonalli-client`.
**Date:** 2026-06-01
**Owner of fixes in this PR:** Isabela
**Owner of follow-ups:** Memo (server-side) + future tickets

---

## Audited PRs

| PR | Branch | Summary | Status |
|---|---|---|---|
| #1 | `feat/F2-015-i18n-setup` | next-intl + locale routing + i18n migration of all client pages | Ready |
| #3 | `feat/F2-025-email-templates` | Resend wrapper + 4 transactional email templates | Ready |
| #7 | `feat/F2-025-emails-extension` | +4 templates (reminder, comment, file, status) from industry gap analysis | Ready |
| #4 | `feat/F2-037-038-supabase-realtime` | Supabase Realtime client + useClientRealtime hook | Ready |
| #5 | `feat/F2-036-frame-io-adapter` | Frame.io adapter (read) + signed webhook | Draft (arquitectura) |
| #6 | `feat/F2-042-metricool-adapter` | Metricool read-only adapter | Draft (arquitectura) |
| (this) | `feat/F2-050-security-audit-log` | Security headers + audit log helper + this doc | In PR |

---

## ✅ Strengths

These are good practices we already follow across the sprint. Worth documenting so they're maintained:

### Auth & multi-tenancy

- **`getClientSession()` / `getClientSessionForApi()`** enforce `role === 'CLIENT_CONTACT'` + presence of `clientId` + presence of related `Client` row. Returns null (API) or redirects (UI) on any failure.
- **All Prisma queries against client-owned tables are scoped by `clientId`** — verified across `dashboard`, `projects`, `projects/[id]`, `approvals`, `approvals/[id]`, `brand`, `/api/external/projects`, `/api/external/approvals`, `/api/external/approvals/[id]`.
- **Middleware (`src/proxy.ts`)** gates `/client/*` and `/api/external/*` on session-cookie presence, returns 401 / 307-to-`/<locale>/login`.
- **Defense-in-depth:** API handler still re-verifies session even though middleware already gated by cookie.

### Input validation

- **Zod schemas** on every PATCH/POST endpoint that takes a body. Approval PATCH validates `action: enum(['APPROVE', 'REJECT'])` and rejects with `400 + code: 'VALIDATION_ERROR'`.
- **Reject requires non-empty feedback** — enforced server-side (line 80–82 of `/api/external/approvals/[id]/route.ts`), not just UI.

### Secret handling

- **`.env.local` is gitignored** (verified in both repos).
- **Lazy init of integrations:** `sendEmail`, Frame.io adapter, Metricool adapter, supabase-client all read env vars at call-time / module-load and degrade to a no-op when missing. Nothing throws on missing secret.
- **No secret values logged.** Helpers log only event metadata + outcome, never the API key.
- **`NEXT_PUBLIC_*` discipline:** only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are intentionally client-exposed (per Supabase's design; RLS protects the rest). All other tokens (`RESEND_API_KEY`, `FRAME_IO_TOKEN`, `FRAME_IO_WEBHOOK_SECRET`, `METRICOOL_API_KEY`, `METRICOOL_USER_ID`) are server-only.
- **`NEXTAUTH_SECRET` rotation** is straightforward (single env var; JWT-mode sessions invalidate cleanly on rotation).

### Webhook security

- **Frame.io webhook validates HMAC-SHA256 signature** with `crypto.timingSafeEqual`. Rejects:
  - Missing `FRAME_IO_WEBHOOK_SECRET` (returns 503, fail-loud)
  - Missing/malformed signature or timestamp header (403)
  - Length-mismatched signature hex (403)
  - Tampered body / wrong secret (403)
- Returns 200 for unknown event types so Frame.io doesn't enter retry loops on benign events.

### Realtime client

- **`supabase-client.ts` returns `null` when env vars are absent.** The hook and provider check for null before subscribing — no crash, no fallback that leaks data.
- **`useClientRealtime` filters in-memory by `projectIds`** owned by the session client for tables that don't carry `clientId` directly (Approval, ActivityLog). For `Project` we use a server-side filter `clientId=eq.<id>`.

---

## 🛠️ Findings + fixes in this PR

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | No security headers configured | Medium | **Fixed:** `next.config.ts` adds X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, plus HSTS + CSP in production. |
| 2 | Silent `catch {}` blocks in `/api/external/approvals/[id]/route.ts` swallow errors with no log | Low | **Fixed:** `catch (err) { console.error(...) }` — errors are now visible in server logs without changing the user-facing 500. |
| 3 | `logActivity()` doesn't capture request metadata (IP, user agent) — useful for audit/forensics | Low | **Fixed:** added `logAuditEvent()` that extracts IP + UA from the `Request` and persists in `details`. Wired into the approval PATCH route. |
| 4 | Audit logging could throw and propagate to the caller, breaking the user flow | Low | **Fixed:** `logAuditEvent()` catches its own errors and `console.error`s instead. Never throws. |

---

## 🚫 Deferred / known gaps

These were intentionally NOT addressed in this PR. Each has a reason:

| Gap | Why deferred | Owner |
|---|---|---|
| **Rate limiting** on `/api/external/*` and `/api/integrations/*` | Needs Upstash KV / Vercel KV / similar — decision of tooling. Without it, an authenticated client could DoS the backend (or an attacker could brute-force the Frame.io webhook signature). | Follow-up ticket, decision needed from Memo |
| **CSRF tokens** on POST/PATCH endpoints | NextAuth v5 sets `SameSite=Lax` session cookies, which mitigates most CSRF. A dedicated CSRF token is recommended for additional defense, but cross-site cookie behavior on modern browsers covers the realistic attack surface. | Future ticket if internal threat modeling demands it |
| **DB row-level security (RLS) policies** in Supabase | Cubierto por #11 F2-014, bloqueado por #8 schema sync con Memo | F2-014 |
| **Penetration testing** | Out of scope for local dev work — requires staging URL + appropriate tooling | After deploy to staging |
| **Audit log retention / GDPR purge** | Cubierto por #30 F2-048 GDPR export (también bloqueado por F2-003) | F2-048 |
| **Secret rotation policy** | Operational concern — env var rotation cadence + alert on near-expiry. Memo's call. | Memo / ops |
| **CSP nonce-based scripts** (removing 'unsafe-inline' for scripts) | Next.js 16 nonce support exists but requires per-request work in middleware. Current CSP is good enough for v1; tighten in a future hardening pass. | Future hardening ticket |
| **Webhook replay protection** for Frame.io | Frame.io's timestamp header could be checked to reject events older than N minutes (replay attacks). Current implementation validates the signature but doesn't enforce freshness. | Future ticket — low priority because attacker would still need the secret to forge a signature |

---

## 📋 Recommendations for Memo (server-side / operational)

These require access to Supabase, Vercel, or the DNS:

1. **Enable Supabase Realtime publications** on `Approval`, `Project`, `ActivityLog` (replication only on the columns needed). Without this, the frontend Realtime code we shipped is dormant.
2. **Write RLS policies** that mirror the app-side filter `where: { clientId: session.clientId }`. The cliente's Realtime client uses the anon key — without RLS, a malicious client could subscribe to other clients' rows even though our app code wouldn't render them.
3. **Configure DKIM / SPF / DMARC** for the Resend sender domain (`notifications@bureautonalli.com`). Without these, transactional emails are likely to land in spam.
4. **Vercel secret rotation cadence.** At minimum: `NEXTAUTH_SECRET`, `RESEND_API_KEY`, `FRAME_IO_TOKEN`, `FRAME_IO_WEBHOOK_SECRET`, `METRICOOL_API_KEY`. Document the rotation runbook.
5. **Audit which env vars end up in the client bundle.** Only `NEXT_PUBLIC_*` should reach the browser. A check in CI: grep the built `.next` for any non-`NEXT_PUBLIC_` env var that leaked in.
6. **Webhook URL hygiene.** When the Frame.io webhook URL is registered, confirm it's the production domain (not a tunnel like ngrok left over from dev).

---

## How to verify the fixes in this PR

After merging:

```bash
# Headers (after `pnpm build && pnpm start`, or after deploy to a Vercel preview)
curl -I http://localhost:3001/fr/login | grep -E "^(X-Frame|X-Content|Referrer|Permissions|Strict-Transport|Content-Security)"

# CSP only set in prod (NODE_ENV=production):
NODE_ENV=production pnpm build && pnpm start
curl -I http://localhost:3000/fr/login | grep "Content-Security-Policy"

# Audit log: trigger an approval decision and verify a row in ActivityLog
# (with `details.ip` and `details.userAgent` populated)
```

---

## Sources consulted

- OWASP Secure Headers Project — recommended HTTP security headers
- Next.js docs — `headers()` config + CSP guidance
- NextAuth.js v5 docs — session security model
- Supabase docs — RLS for anonymous-key client safety
- Frame.io webhook docs — signature scheme (`v0=<hex>` over `v0:<ts>:<body>`)
