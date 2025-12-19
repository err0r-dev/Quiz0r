# Quiz0r

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![Node](https://img.shields.io/badge/Node-%E2%89%A518.17-339933?logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-010101?logo=socketdotio&logoColor=white)
![Prisma](https://img.shields.io/badge/DB-Prisma%20%2B%20SQLite-2D3748?logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Ready-Docker-2496ED?logo=docker&logoColor=white)
[![Vibe coded with Claude](https://img.shields.io/badge/Vibe%20coded-Anthropic%20Claude-8A63F9?logo=anthropic&logoColor=BD653E)](https://claude.ai)
[![Vibe coded with OpenAI](https://img.shields.io/badge/Vibe%20coded-OpenAI-00A67E?logo=openai&logoColor=white)](https://openai.com)
[![License](https://img.shields.io/badge/License-Custom-orange?logo=open-source-initiative&logoColor=white)](https://github.com/err0r-dev/.github/blob/main/profile/license.md)

If you want a beginner-friendly walkthrough, start with [Non Techie Readme.md](/Non%20Techie%20Readme.md). This README is for people who are comfortable running commands and want details on how the app works.

## Overview
- Real-time multiplayer quiz game built with Next.js 14 (App Router), Socket.io, Prisma, and Tailwind.
- Admin builds quizzes (with AI assist, themes, media, translations), hosts games, and shares a QR/join link.
- Players join via code/QR, answer in real time, and see live leaderboards; certificates can be generated and downloaded.
- Built-in ngrok support to expose player routes publicly while keeping admin/host routes local-only.

## Features
- Quiz editing: create/import/export quizzes (ZIP with media), reorder questions, rich media, power-ups, host notes, theme presets/JSON editing.
- AI helpers: AI quiz generator (OpenAI) and Unsplash image sourcing.
- Translations: translation status indicators; copy English answers into translations.
- Game flow: real-time scoreboard, host display + control panel, QR/join links, admission controls, delete previous games.
- Certificates: host/player certificate generation and download.
- Safety: middleware blocks admin/host APIs from ngrok/public; player routes stay open.

## Stack
- Next.js 14, React 18, TypeScript
- Socket.io for realtime play
- Prisma + SQLite (local file database)
- Tailwind + shadcn/ui for UI
- ngrok for tunneling

## Prerequisites
- Node.js 18.17+ and npm
- SQLite (bundled via Prisma; no external DB needed)
- Docker (optional) for containerized runs

## Quick Start
```bash
npm run setup   # installs deps, creates .env, sets up database
npm run dev     # starts the app at http://localhost:3000
```

<details>
<summary>Manual setup steps (if you prefer)</summary>

```bash
# 1) Install dependencies
npm install

# 2) Create .env with the SQLite URL if it does not exist
echo 'DATABASE_URL="file:./data/quiz.db"' > .env   # only if .env is missing

# 3) Apply schema (repo ships without migrations)
npx prisma db push

# 4) Start the dev server
npm run dev
# App: http://localhost:3000
```
</details>

## Running with Docker
```bash
docker compose up -d --build
docker compose logs -f   # wait for "Ready on http://localhost:3000"
```
- The image entrypoint runs `npx prisma migrate deploy`; if you see migration errors, replace that with `npx prisma db push` for a migration-less setup.
- For persistent data, align the DB path with the mounted volume. Easiest: set `DATABASE_URL=file:./prisma/data/quiz.db` in `docker-compose.yml` to match the `/app/prisma/data` volume.
- App URL: http://localhost:3000

## Environment variables
- `DATABASE_URL` (required): e.g., `file:./data/quiz.db` or `file:./prisma/data/quiz.db` when matching the Docker volume.
- Optional (used in admin/settings):
  - `OPENAI_API_KEY` (AI quiz generator)
  - `UNSPLASH_API_KEY` (image sourcing)
  - `NGROK_AUTHTOKEN` can also be saved via the UI.

### Desktop app signing (Electron)
- macOS notarization/signing (used when the required variables are set for `npm --prefix electron run build` on macOS or `--mac` targets):
  - `APPLEID` — Apple ID email used for notarization.
  - `APPLEIDPASS` or `AC_PASSWORD` — app-specific password or keychain reference (e.g., `@keychain:AC_PASSWORD`).
  - `APPLE_TEAM_ID` — Developer Team ID for the notarization ticket.
- Windows signing for NSIS output (when the signing variables are set):
  - `CSC_LINK` — path/URL to the `.p12` certificate (can be a base64 data URL).
  - `CSC_KEY_PASSWORD` — password for the signing certificate.

If these variables are missing for a platform you are targeting, the Electron build script will warn and continue, producing unsigned artifacts for that OS.

## ngrok (external access)
- Add your authtoken in the admin UI: `http://localhost:3000/admin/settings`.
- The server auto-starts a tunnel when a token is saved or present at boot (`src/lib/tunnel.ts`).
- QR/join links use the tunnel URL for players. Admin/host routes remain local-only (`src/middleware.ts`).
- Players may see ngrok’s one-time warning page; after clicking through, the cookie suppresses it.

## Key scripts
- `npm run dev` — start Next.js + Socket.io server (tsx `server.ts`).
- `npm run build` — Next build.
- `npm run start` — production start (uses `NODE_ENV=production tsx server.ts`).
- `npm run db:push` — apply Prisma schema to SQLite.
- `npm run db:studio` — Prisma Studio.
- `npm run lint` — Next lint.
- `node scripts/cleanup-old-games.ts` — delete sessions older than 1 hour (manual/cron).

## Project structure
```
.
├─ src/
│  ├─ app/                                  # Next.js App Router pages + API routes
│  │  ├─ page.tsx                           # Landing page
│  │  ├─ menu/                              # Menu selection screen
│  │  ├─ play/[gameCode]/page.tsx           # Player join/answer view (public)
│  │  ├─ host/[gameCode]/{display,control,playermonitor}/page.tsx # Host display + control panels
│  │  ├─ admin/                             # Admin dashboard and tools
│  │  │  ├─ page.tsx                        # Admin home
│  │  │  ├─ games/page.tsx                  # Game history/controls
│  │  │  ├─ quiz/new/page.tsx               # New quiz creation
│  │  │  ├─ themes/[themeId]/page.tsx       # Theme editor
│  │  │  └─ settings/page.tsx               # App settings (API keys, tunnel, etc.)
│  │  ├─ api/                               # Route handlers for admin/host/player APIs
│  │  │  ├─ quizzes/(route.ts, ai-generate, import, [quizId])     # CRUD + AI generation
│  │  │  ├─ games/(route.ts, [gameCode])    # Game lifecycle endpoints
│  │  │  ├─ themes/(route.ts, generate, [themeId]) # Theme CRUD + AI generate
│  │  │  ├─ settings/(route.ts, tunnel)     # Settings and tunnel start/stop
│  │  │  ├─ tunnel/route.ts                 # ngrok status
│  │  │  ├─ shorten/route.ts                # URL shortener
│  │  │  └─ upload/route.ts                 # Media upload
│  │  └─ uploads/[...path]/route.ts         # Serves uploaded assets
│  ├─ components/                           # UI primitives + domain components
│  │  ├─ ui/                                # shadcn-based primitives (buttons, dialog, tabs, etc.)
│  │  ├─ landing/                           # Marketing/landing sections
│  │  ├─ quiz/                              # Quiz editing + player inputs
│  │  │  ├─ editor/                         # Question/section modals
│  │  │  ├─ questions/                      # Question list and stats
│  │  │  └─ settings/                       # Admission/power-up controls
│  │  ├─ admin/                             # Admin cards, pagination, side panels
│  │  ├─ certificate/                       # Certificate status/download/regeneration
│  │  ├─ theme/                             # Theme provider and background effects
│  │  └─ display/AspectRatioHelper.tsx      # Host display scaling helper
│  ├─ contexts/                             # React contexts (dark mode)
│  ├─ hooks/                                # Client hooks (Socket.io connection, quiz preloading)
│  ├─ lib/                                  # Services and utilities
│  │  ├─ openai-*.ts                        # AI quiz/theme/translation helpers
│  │  ├─ certificate-*                      # Certificate generation and helpers
│  │  ├─ theme-*.ts                         # Theme presets, contrast, color utilities
│  │  ├─ tunnel.ts                          # ngrok tunnel control
│  │  ├─ scoring.ts                         # Game scoring logic
│  │  ├─ db.ts                              # Prisma client helper
│  │  └─ utils.ts                           # Shared client/server helpers
│  ├─ middleware.ts                         # Blocks admin/host routes from ngrok/public traffic
│  ├─ server/game-manager.ts                # Socket.io game state manager
│  └─ types/                                # Shared TypeScript types (quizzes, settings, certificates, themes)
├─ public/                                  # Static assets; upload root kept under version control via .gitkeep
├─ prisma/schema.prisma                     # Database schema
├─ data/                                    # SQLite database location (gitignored)
├─ scripts/                                 # Setup/maintenance scripts (setup, cleanup-old-games, contrast checks)
├─ server.ts                                # Custom Next.js + Socket.io entrypoint
├─ list-players.ts                          # Utility to list currently connected players from the socket server
├─ docker-compose.yml, Dockerfile           # Container build/run setup
├─ components.json, tailwind.config.ts, postcss.config.mjs, next.config.mjs, tsconfig.json # Tooling/config
└─ package.json, package-lock.json          # Dependencies and npm scripts
```

## Data and storage
- Default SQLite file: `data/quiz.db` (ignored by git).
- Uploaded media lives under `public/uploads`; compose mounts `quiz-uploads` volume there.
- When changing DB paths, update both `DATABASE_URL` and any Docker volume mappings.

## Security and routing
- Player-facing routes (`/play`, `/play/[gameCode]` and related APIs) stay accessible over ngrok.
- Admin/host routes (`/admin`, `/host`, `/api/quizzes`, `/api/settings`, `/api/tunnel`) are blocked from external/ngrok traffic by middleware (`src/middleware.ts`).

## License
This project is licensed under the [ERROR.DEV OPEN USE LICENSE](https://github.com/err0r-dev/.github/blob/main/profile/license.md)
