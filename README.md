# PushUp Pro

> Camera-powered AI push-up tracker — counts every rep, tracks your streaks, sets goals, and ranks you on a weekly leaderboard.

![PushUp Pro](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20PostgreSQL-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Features

- **Camera rep counting** — uses pixel luminance diff on a 32×32 canvas sample to detect push-up motion in real time, no ML library required
- **Manual override** — tap to add reps if the camera misses one
- **Streaks & personal bests** — daily streak tracking and PR detection on every workout save
- **AI coach messages** — personalized motivational messages on the Dashboard
- **Goals** — AI-recommended and custom goals with live progress bars
- **Push-up library** — 19 variations with difficulty filters and expandable technique descriptions
- **Weekly challenges** — community challenges with a live leaderboard and join flow
- **Badges** — 10 achievement types, evaluated server-side on every workout
- **Progress score** — total reps + streak bonus (10/day) + personal bests + daily challenge completions
- **Clerk authentication** — Google OAuth + email login; progress is permanently linked to your account
- **Guest mode** — skip login and save progress locally on the device

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 |
| Frontend | React + Vite, Tailwind CSS v4, wouter, TanStack Query |
| Backend | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk (Google OAuth + email) |
| Validation | Zod (`zod/v4`), drizzle-zod |
| API codegen | Orval (from OpenAPI spec) |
| Build | esbuild (CJS bundle) |

---

## Project Structure

```
.
├── artifacts/
│   ├── api-server/          # Express 5 API (proxied at /api)
│   │   └── src/routes/      # All route handlers
│   └── pushup-pro/          # React + Vite frontend (proxied at /)
│       └── src/
│           ├── pages/       # One file per screen
│           ├── components/  # Shared UI components
│           └── lib/         # Auth helpers, utilities
├── lib/
│   ├── api-spec/            # OpenAPI spec (source of truth)
│   ├── api-zod/             # Generated Zod schemas (do not edit)
│   ├── api-client-react/    # Generated React Query hooks (do not edit)
│   └── db/                  # Drizzle ORM schema + migrations
└── scripts/                 # Utility scripts
```

---

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL database

### Environment Variables

Create a `.env` file (or set these in your environment):

```env
DATABASE_URL=postgres://user:password@host:5432/dbname
SESSION_SECRET=your-session-secret
VITE_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

### Install & Run

```bash
# Install all workspace dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start the frontend (port 5173)
pnpm --filter @workspace/pushup-pro run dev
```

### Codegen (after editing the OpenAPI spec)

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates the Zod schemas and React Query hooks from `lib/api-spec/openapi.yaml`.

### Typecheck

```bash
# Full check across all packages
pnpm run typecheck

# Libs only (faster, run after editing lib/*)
pnpm run typecheck:libs
```

---

## Architecture

### Contract-First API

All API contracts are defined in `lib/api-spec/openapi.yaml`. From that single source, Orval generates:

- **Zod schemas** (`lib/api-zod/`) — used by the server to validate request/response bodies
- **React Query hooks** (`lib/api-client-react/`) — used by the frontend to fetch and mutate data

Never edit the generated files directly. Edit the spec and run codegen.

### Authentication

Clerk handles identity (Google OAuth + email). On every app open:

1. Clerk session is checked — if no valid session, the login screen is shown
2. The Clerk user ID is looked up in the database (`GET /api/users/by-clerk/:clerkId`)
3. Returning users are sent straight to the Dashboard
4. New users are sent to Onboarding to create a profile, which gets permanently linked to their Clerk account

Guest mode stores progress in `localStorage` only (`pushupProUserId` key).

### Camera Rep Detection

The Workout page samples the camera feed at 10 fps onto a 32×32 canvas and computes the average luminance diff between frames. A rep is counted when the diff crosses a threshold (down phase) and then recovers (up phase). This works without any ML library or WebAssembly.

> **Note:** Camera access requires HTTPS or localhost. Users on plain HTTP in production will receive a camera permission error.

---

## Screens

| Route | Screen |
|---|---|
| `/` | Redirects to Dashboard (or login if unauthenticated) |
| `/onboarding` | 3-step profile setup (name, fitness level, goal) |
| `/dashboard` | Today/weekly stats, AI coach message, start workout CTA |
| `/workout` | Camera rep counter + manual override + summary/save |
| `/goals` | AI-recommended and custom goals with progress bars |
| `/library` | 19 push-up variations with difficulty filters |
| `/challenges` | Weekly community challenge + leaderboard |
| `/badges` | Earned/locked achievement grid |
| `/profile` | Edit profile, view stats, reset account |
| `/records` | Personal records and workout history |

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | Profile, fitness level, goal; linked to Clerk via `clerk_id` |
| `workouts` | Individual workout sessions with rep counts and date |
| `goals` | User-defined rep targets with deadlines |
| `challenges` | Weekly community challenges |
| `challengeParticipants` | Join records linking users to challenges |

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Edit the OpenAPI spec first if your change touches an API contract
4. Run codegen and typecheck before committing
5. Open a pull request

---

## License

MIT
