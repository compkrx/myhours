# MyHours: daily routine planner

A private, local-first life workspace built with React, TypeScript, Vite and IndexedDB. Tasks, notes, school, calendar, projects and the other local modules work without an account. Nothing is populated automatically.

**Release status:** usable local release. Cloud sync, hosted AI and Google integration source is included, but a live backend and OAuth client have not been provisioned. Local PostgreSQL isolation tests are not a claim that a hosted account has been tested.

The current product brief and reusable Codex build prompt are in [`docs/`](docs/). The shipped and pending scope is tracked in [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Run it

Install Node.js 24 LTS and Git, then open a terminal in this folder:

```powershell
npm ci
npm run dev
```

Open the printed localhost URL. Skip onboarding or enter a few actual classes and commitments. There is no password in local mode. Real data stays in this browser profile, not in the repository.

To try the production build and offline shell:

```powershell
npm run build
npm run preview
```

The service worker is enabled in production builds. Visit once online, wait for **Offline shell ready**, then core views work offline. On iPhone Safari, use Share → Add to Home Screen. On a supporting desktop browser, use its installation control. A physical iPhone installation has not been verified in this build session.

## Use your own plan

Settings → Back up and restore → Restore backup accepts the versioned JSON format. Preview the record count before confirming. Restore **replaces** the current local workspace; make a full backup first. Keep personal import files outside this repository and its `public` directory. A read-only sharing snapshot is intentionally not a restorable backup.

Long horizon holds editable monthly checkpoints and date-specific daily logs. A checkpoint is a proposal, not a deadline. Use **Draft a next action** to review a task before saving it. School supports separately labeled dated grade snapshots; its weighted calculation requires actual category weights and denominators. It does not reverse-engineer missing assignments from a percentage.

## GitHub Pages

1. Push this source to the repository's `main` branch. Include `.github/workflows/pages.yml` and `package-lock.json`. Never include personal backups, local database dumps or real credentials.
2. Repository Settings → Pages → Source → **GitHub Actions**.
3. The workflow tests the app and builds a base path matching the repository name. A `username.github.io` repository uses `/`; other repositories use `/repo-name/`.
4. Wait for the workflow's Pages deployment URL. Opening the URL on a second device does **not** copy this device's local data; use a private backup or configure cloud sync.

For a manual subpath build on PowerShell:

```powershell
$env:VITE_BASE_PATH='/myhours/'
npm run build
$env:TEST_BASE_PATH='/myhours/'
npm run test:e2e
```

Hash routing avoids deep-link 404s on Pages. Root and repository subpaths are supported. GitHub Pages serves public static source and assets; its URL is not an authentication boundary for your local data.

## Optional private Supabase backend

Read [SECURITY.md](SECURITY.md) before connecting real information.

1. Use an eligible Supabase account, with guardian help if required by the provider. Create a project. Configure Auth → URL Configuration with the actual app URL and email redirect URL.
2. Install the official Supabase CLI, then run:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

3. For local Supabase testing, install Docker, then run `supabase start` and `supabase test db`. The supplied pgTAP suite is in `supabase/tests/isolation.sql`.
4. Put only `VITE_SUPABASE_URL` and the public anon/publishable key in a local `.env.local`, using `.env.example`. For Pages, add those same values as repository **Variables**, then rebuild. Never put the service-role key in a `VITE_` variable.
5. Sign in from Settings. Account data uses a separate local workspace keyed by authenticated user ID. Export local-only records before switching. Preferences remain per-device. Click **Sync now** on each device. Concurrent edits produce a two-version preview and require a choice. Sync errors leave pending local edits intact.
6. Run two real test accounts through signup, sync, expired sessions and concurrent edits before trusting hosted sync with your records. These hosted checks require the project's credentials and have not been run here.

The service deliberately exposes one RLS-protected record table with typed entity payloads and ID references. All browser mutation passes through a compare-and-swap RPC. Tombstones synchronize deletions. There is no background sync or automatic conflict winner.

## Optional hosted AI

The first-party assistant has working deterministic local tools. **Local tools are not a language model.** For hosted tutoring and contextual drafts:

1. Deploy the database migration first and set a model provider's project-level spending cap.
2. Configure the edge function's runtime secrets `APP_ORIGIN` (origin only), `MODEL_API_URL` (HTTPS OpenAI-compatible chat-completions endpoint), `MODEL_API_KEY`, and `MODEL_ID`. Use the CLI's `supabase secrets set --env-file` with a private, ignored file. Supabase supplies its own runtime project credentials; never copy those into frontend variables.
3. Run `supabase functions deploy life-ai`. Keep JWT verification enabled.
4. Set the public `VITE_AI_FUNCTION_URL` to the deployed function URL and rebuild.
5. Sign in, sync selected records, choose categories in MyHours AI, inspect the approved record list, and explicitly consent before sending. Unknown or unsynced IDs are rejected. Suggestions open a review form; saving needs your confirmation.

Limits: 20 reserved requests per UTC day, at least 10 seconds apart, 40 record IDs, 45,000 context characters, 1,800 output tokens, and request timeouts. Failed provider calls may consume a request reservation. Monetary cost is shown as unknown; consult the provider dashboard. See [AI_DESIGN.md](AI_DESIGN.md).

## Optional Google connections

Configure an eligible Google Cloud web OAuth client, the exact origin, and required API access. Set its public ID as `VITE_GOOGLE_CLIENT_ID`. Consent-screen verification may be required before general use.

- Calendar read requests only `calendar.events.readonly`. The next 30 days are previewed, then imported locally after confirmation. Imported IDs prevent duplicates. Remote changes are not silently applied.
- Calendar creation requests `calendar.events` separately, only after an event preview. It creates a copy; the UI warns that repeating it can duplicate an event. There is no background calendar editing.
- Drive export requests only `drive.file`. Choose a folder created/accessed by this app or explicitly create one. Preview and confirm the selected Markdown and JSON uploads. With this minimum scope the app does not browse arbitrary existing folders. Tokens are kept in page memory; expired authorization requires reconnection. No refresh token is persisted.
- Drive files become readable to ChatGPT only if you separately connect that Drive account to ChatGPT and ask it to read the file. This app promises no automatic awareness.

These API flows require an actual configured client and have not been verified against a live Google account.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run check:bundle
npx playwright install chromium
npm run test:e2e
npm audit
```

Unit/integration tests cover IndexedDB, calculations, scheduling, exports, local tools, sync reconciliation, and actual PostgreSQL RLS in PGlite with mocked authenticated claims. Browser tests run against the production build in desktop Chromium and an iPhone-sized Chromium viewport, including offline reload, accessibility and reduced motion. They do not replace real Safari, hosted Auth, provider or two-device testing.

## Troubleshooting

- **Blank deployment:** check Vite base path, Pages Actions result and browser console. Do not upload the source folder as a built site.
- **Old version:** finish editing, export a backup and use the update banner's reload. Do not clear website data without exporting it.
- **Missing local records on another device/account:** local storage is per browser origin and profile. Account workspaces are separate. Restore privately or connect sync.
- **Storage unavailable/private browsing:** use a profile that allows IndexedDB. Request persistent storage in Settings and keep private backups.
- **Cloud conflict:** inspect both versions, choose, then sync again. Do not assume the newest timestamp is necessarily correct.
- **AI unavailable:** use core features and local tools. Check authentication, synced context, function logs, rate limits and runtime configuration. Never paste secrets into chat or a public issue.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the complete limits, [ARCHITECTURE.md](ARCHITECTURE.md) for the design, and [PRIVACY.md](PRIVACY.md) for data handling.
