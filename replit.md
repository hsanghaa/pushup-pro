# PushUp Pro

A camera-powered AI push-up tracking web app that counts reps, tracks streaks, sets goals, and ranks you on a weekly leaderboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/pushup-pro run dev` — run the frontend (port 22486, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Tailwind CSS v4, wouter routing, @tanstack/react-query)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Theme: dark athletic, electric lime (#D4FF00), Bricolage Grotesque display font

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle ORM schema (users, workouts, goals, challenges, challengeParticipants)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/pushup-pro/src/pages/` — all React page components
- `artifacts/pushup-pro/src/components/layout/` — AppLayout + BottomNav
- `artifacts/pushup-pro/src/lib/auth.ts` — userId helpers (localStorage-based)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → Zod validators + React Query hooks
- Auth is localStorage-only (no sessions): `pushupProUserId` key stores numeric user ID
- Camera motion detection uses pixel luminance diff (32×32 canvas sampling) — works without ML libraries
- Badge evaluation runs on every workout POST server-side; badges are returned in GET /badges/:userId
- Progress score = total reps + streak bonus (10/day) + personal bests + daily challenge completions
- Push-up variations library is seeded in-memory on first GET (not stored in DB)

## Product

- **Home**: splash/landing screen
- **Onboarding**: 3-step profile setup (name, fitness level, goal)
- **Dashboard**: today/weekly stats, AI coach message, start workout CTA
- **Workout**: camera rep counting (luminance diff) + manual override + summary/save
- **Goals**: AI-recommended goals + custom goal creation with progress bars
- **Library**: 19 push-up variations with difficulty filters and expandable descriptions
- **Challenges**: weekly community challenge with leaderboard and join flow
- **Badges**: earned/locked achievement system (10 badge types)
- **Profile**: edit name/level, view stats, safety disclaimer, reset

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` after editing any `lib/*` schema — leaf packages read from compiled `.d.ts` declarations
- After codegen (`pnpm --filter @workspace/api-spec run codegen`), restart the frontend workflow for HMR to pick up new hooks
- Variations library is seeded at runtime (not in DB) — first GET to `/api/variations` populates the in-memory store
- The `date` field in WorkoutInput is typed as `Date | undefined` by Orval (format: date) — convert with `.toISOString().split("T")[0]` before DB insert
- Camera detection requires HTTPS or localhost; in production, users on HTTP will get camera errors

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
