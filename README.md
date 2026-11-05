# AdAstra

A local-first accountability workspace. Small promises, shared ambition, and a little friendly pressure.

## Run locally with Docker

```sh
docker compose up --build -d
```

Open **http://localhost:3000**. Choose **Clay** (owner) or **Eames** (member) in the **original** organization. Both are local demo profiles; no external account or email setup is needed.

The container binds to `127.0.0.1` only. SQLite and the generated session secret live in the persistent `adastra-data` Docker volume. Normal restarts and rebuilds preserve data.

```sh
docker compose logs -f
docker compose stop
docker compose start
```

The application and a small scheduler run in one container. The scheduler evaluates today's commitments every minute after each person's local check-in time, and generates a weekly reset on Sunday. It updates the same message when progress changes, rather than creating duplicates. A stopped computer/container does not run jobs; restart reconciles today's evaluation without flooding old messages.

## What works

- Responsive daily dashboard, goals, weekly calendar, groups, organization administration, inbox and settings.
- Organization → groups → members; owner/admin/member permission boundaries.
- Create organizations and groups, join groups, generate single-use seven-day invitation codes, and accept invitations.
- Binary, quantity and target-range goals, selected weekdays, daily deadlines and private/shared labels.
- Persistent check-ins, partial credit, range scoring and clear missing-check-in handling.
- Peer views expose only the chosen shared label and completion status, and only within a mutually joined group. Private titles and amounts never appear in peer API payloads.
- Daily accountability, supportive weekly summaries, selectable tone, pause controls and local email previews.
- Google OAuth provider and sign-in UI, enabled only when credentials are configured.
- Locally bundled fonts: no third-party font requests at runtime.

All initial activity/history is sample data. The profile switcher is a deliberate local development convenience, not production authentication. Do not expose this demo to the internet. Google-authenticated users get a separate empty workspace and are never automatically merged into a local demo identity.

## Optional Google sign-in

Nothing is connected by default. The Google button honestly shows **Not connected** until configured.

When you are ready, create a Google Cloud Web OAuth client and register:

```text
Authorized JavaScript origin: http://localhost:3000
Authorized redirect URI: http://localhost:3000/api/auth/callback/google
```

For Docker, copy `.env.example` to `.env` and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a random `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`). Then recreate the container with `docker compose up -d`. Docker Compose reads these values from `.env`. Never commit credentials.

Google sign-in requests basic identity only. It does not connect Gmail, Google Calendar or any fitness account. No OAuth flow has been tested against a live Google account in this prototype.

## Develop without Docker

Use Node 22 (recommended) and npm:

```sh
npm ci
npm run dev
```

The development app runs at http://localhost:3000 and stores data in `./data/adastra.sqlite`. Development allows local demo profiles by default. Optional environment values belong in `.env.local`. Start `npm run worker` in another terminal to exercise automatic scheduling; the Inbox preview buttons also work without the worker.

For a direct production build with local profiles:

```sh
npm run build
LOCAL_DEMO_AUTH=true NEXTAUTH_URL=http://localhost:3000 npm start
```

## Checks

```sh
npm test
npm run typecheck
npm run build
npm run smoke   # requires the local application running on port 3000
```

Service tests use isolated temporary SQLite databases, not your workspace data. The smoke check verifies actual local authentication, organization access and origin protections without modifying goals.

## Structure

| Location             | Responsibility                                                       |
| -------------------- | -------------------------------------------------------------------- |
| `src/components`     | Local sign-in and responsive workspace UI                            |
| `src/lib/domain.ts`  | Measurement types, dates and pure scoring rules                      |
| `src/lib/db.ts`      | SQLite schema, fixture initialization and starter-data migration     |
| `src/lib/service.ts` | Authorization, privacy-filtered reads, writes and message generation |
| `src/lib/auth.ts`    | Google and explicit local-development authentication                 |
| `src/app/api`        | Authenticated HTTP boundary and request validation                   |
| `scripts`            | Startup initialization, scheduler and HTTP smoke checks              |
| `tests`              | Meaningful service/privacy/scoring checks                            |
| `.ui-foundry`        | Design brief and verification evidence                               |

## Deliberately later

Real email delivery/aliases, Google and Apple calendar synchronization, tracker imports, native HealthKit, public hosting, PostgreSQL, durable distributed queues, richer goal editing and membership lifecycle controls.

Current goal retirement removes the goal from active-plan historical summaries; original check-in rows remain stored. Immutable historical reporting needs lifecycle dates or commitment snapshots before a shared production pilot. The weekly preview describes the current week so far and can be refreshed.

Google credentials, email-provider credentials and account connections are not required to explore this local release. Architecture can grow by replacing the SQLite repository and local worker without changing the product's core scoring rules.
