# Local accountability verification

## Result

Ready for local prototype use. The initial organization is **original**, with **Clay (owner)** and **Eames (member)**. A one-time migration updates the earlier demo roster while preserving locally created goals/check-ins and retaining retired fixture records on disk. No external accounts were connected and no emails were sent.

The repository originally contained only a README. There was no prior UI, screenshot, dependency bundle, or performance baseline to compare. The selected native editorial direction centers daily commitments, backed by real SQLite state. No personal taste profile was supplied or written.

## Verification evidence

- `npm test`: 7/7 service tests passed after the roster update. Tests cover tenant boundaries, role restrictions, invitation acceptance, group sharing, numeric/range scoring, clearing check-ins, unknown versus missed data, refreshing messages without duplicates, time-zone cutoffs and pause controls.
- `npm run typecheck`: passed on final source.
- Docker production build: passed on final source.
- `npm run smoke`: passed against the running container. Authenticated Clay/Eames sessions, correct original roster, 401 for anonymous requests, 403 for unauthorized organizations, member administration and invalid origins.
- Docker container is healthy and binds to `127.0.0.1:3000`. Goal/check-in/message persistence was observed across rebuilds.
- Independent backend review identified an initialization race, eager secret generation, group-scoping issue and stale message previews. All were corrected. Independent retest of initialized fresh databases: 18/18 concurrent opens passed.
- Browser: local owner login, goal creation, persisted binary check-in and score update, private daily-message generation, owner/member organization views and the updated profile picker verified.
- Desktop viewport: 1440 × 1000. No horizontal document overflow, one h1, no unlabeled controls in the focused DOM audit.
- Mobile viewport: 390 × 844. Document width 390; no horizontal overflow. Off-canvas navigation excluded from focus/accessibility while closed. Navigation and inbox interaction verified.
- Keyboard: Enter opens goal dialog; Escape closes it and returns focus to the New goal trigger. Dialog is named and uses native modal focus containment.
- Reduced motion: CSS removes transitions/animations when requested; no JS animation loop or specialist renderer exists. This is source verification, not a browser-emulated motion audit.
- A focused computed-style contrast audit found weak secondary labels; their colors were darkened and decorative symbols hidden from assistive technology. This was not a complete WCAG certification or screen-reader audit.

## Images

- `../evidence/dashboard-desktop.jpg`
- `../evidence/dashboard-mobile.jpg`
- `../evidence/organization-desktop.jpg`
- `../evidence/login-desktop.jpg`
- `../evidence/dom-audit.json`
- `../evidence/mobile-audit.json`

## Cost and maintainability

Final container static JS: 11 chunks, 661,162 raw bytes / 201,762 gzip bytes in aggregate. This is all emitted static JS, not one route's transferred payload or a measured first-load performance score. No previous bundle exists for a delta. Icons and fonts are bundled locally; no animation/charting framework or hosted database is required.

One repository, one local container, one SQLite volume. Domain scoring, database access, authentication, service authorization and UI are separated. The large workspace component is a prototype orchestration surface and can be split into route-level components as the flows stabilize.

## Review attribution and limits

UI and interaction review: primary agent self-review. Backend review: independent subagent. No independent aesthetic approval is claimed.

Google OAuth is configured in code but cannot be verified end-to-end without user-provided credentials. Real email, calendar sync and fitness providers remain future integrations. Authentication via local profile switching intentionally trusts the local operator. This is not an internet-ready deployment.

Retiring a goal changes active-plan historical summaries; stored check-ins are retained. Immutable history, member removal/role editing and production multi-user administration need further lifecycle work before a shared hosted pilot. A stopped container cannot run scheduled work.

## Rollback

`docker compose stop` stops the local deployment while preserving the volume. Product source additions and the README edit are uncommitted and can be reviewed normally in Git. Preserve/export the SQLite volume before intentionally removing data. `.ui-foundry` can be removed independently without affecting runtime behavior. No remote resources or global settings were created.
