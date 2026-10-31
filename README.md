# Ivan OS · ivanandresdiaz.com

Strategic management of my life, tactics and execution without friction. Design: [IVAN_OS.md](./IVAN_OS.md) · Terms: [GLOSSARY.md](./GLOSSARY.md) · Decisions: [docs/adr](./docs/adr).

## Run locally

```bash
pnpm install
cp .env.example .env          # then fill AUTH_SECRET (openssl rand -base64 32)
pnpm db:up                    # Postgres 16 in Docker on port 5440
pnpm db:migrate
pnpm db:seed                  # Season, Q4 2026, Campaign "Build Ivan OS", Monday's Structure
pnpm dev                      # http://localhost:3000 → "Dev sign-in (local only)"
```

`pnpm test` runs the domain tests (`src/domain`, pure TypeScript). `pnpm typecheck`, `pnpm lint`, `pnpm db:studio`.

## Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application).
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (and the production one: `https://ivanandresdiaz.com/api/auth/callback/google`).
3. In `.env`: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `ALLOWED_EMAIL` = the only Google account allowed in.

The dev sign-in only exists when `NODE_ENV !== "production"` and `AUTH_DEV_LOGIN=1`.

## PWA and notifications

Installable from the browser (manifest + `public/sw.js`, no offline). Cycle notifications are local: the page asks for permission
("Enable notifications" on `/os/focus` or `/os/cycles`) and shows them through the service worker. Browsers only allow this on
`localhost` or HTTPS; to test on a phone in the LAN use `pnpm dev --experimental-https`.

## Layout

- `src/domain/` — pure rules: dates and Quarters, Structure + Exceptions, Slots and carried over, Highlights / Day Won, Secondary Tasks, Infinite Games, Cycles.
- `src/db/` — Drizzle schema, client, seed. Migrations in `drizzle/`.
- `src/server/` — queries and Server Actions (each one calls `requireIvan()`).
- `src/components/` — `TimeGrid` (drag/resize/draw grid), `Calendar`, `Stack`, `SecondaryTasks`, `NoiseItems`, `StructureEditor`, `StructureBlockDialog`, `FocusScreen`, `CycleBadge`.
- `src/app/os/` — the private OS. `src/app/page.tsx` — minimal public root.
