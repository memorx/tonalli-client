# Tonalli Client

Portal cliente de **Bureau Tonalli** — agencia creativa de moda de lujo (París).

Permite a los clientes consultar el avance de sus proyectos, aprobar entregables y acceder a los activos de su marca.

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in values
npx prisma generate
PORT=3001 npm run dev
```

> Runs on port 3001 by default to avoid conflicting with the internal portal (port 3000).

## Stack

Next.js 16 · React 19 · TypeScript · Prisma 7 · Supabase · NextAuth v5 · Tailwind CSS 4

## Related

- **tonalli-internal** — Portal interno del equipo (repo separado)
- Ambos portales comparten la misma base de datos Supabase

## Documentacion

- [Onboarding para devs](docs/ONBOARDING.md) — Empieza aqui
- [Guia de desarrollo](docs/tonalli-client-dev-guide.md)
- [Arquitectura del portal cliente](docs/BureauTonalli_Arquitectura_Fase2_Portal_Cliente.docx)
- [Arquitectura tecnica completa](docs/BureauTonalli_Arquitectura_Tecnica_v2.docx)
- [CLAUDE.md](CLAUDE.md) — Referencia tecnica para Claude Code

---

Made with ♥ by [Made by Humans](https://madebyhumans.dev)
