# Security

No real user records, credentials, school details or private plan files belong in this repository, `public`, test fixtures, screenshots or deployed assets. The build scanner detects known secret patterns and selected private-plan markers; it is an additional check, not a proof that arbitrary sensitive text can never be committed.

The static app is public code. IndexedDB is private to the browser origin/profile but is **not encrypted by this app**. A person or extension with access to the profile can access records. Exported backup files are also unencrypted. Use an appropriate device account, private storage and backups.

GitHub project sites under the same `username.github.io` hostname share a browser origin. Repository subpaths are not separate security boundaries. Keep all code served from that hostname trusted; a separate dedicated origin is preferable when unrelated or untrusted sites also use the account.

Cloud isolation is enforced by RLS on every personal table (`life_records`, `ai_usage`), authenticated UID predicates, revoked direct mutation grants, and version-checked security-definer RPCs whose user identity comes from `auth.uid()`. Security-definer functions use an empty search path. AI quota reservations are service-role-only. The service role is confined to the server runtime and is used only for quota reservation. Data retrieval uses the caller's authenticated client and RLS.

Automated local PostgreSQL tests exercise two accounts, cross-account negative reads, independent writes, stale updates, forbidden direct writes, anonymous reads, quota permissions and scoped account deletion. Their Auth claims are mocked. Run the supplied pgTAP suite and real two-account hosted tests before trusting a new deployment with personal records. Hosted Auth delivery, redirect configuration, JWT enforcement and live RLS have not been certified by the local tests.

The model never receives a browser-supplied database dump. The server validates input, verifies authentication, reloads explicitly approved IDs with RLS, checks selected kinds, trims note context, enforces quotas and limits output. Citations must point to approved IDs. Notes are untrusted text, and model instructions explicitly forbid following commands within records. No model tool can perform a write. Semantic correctness still requires user review; an existing cited ID alone cannot prove every sentence is true.

Raw Markdown HTML is disabled. React escapes plain text; source links accept HTTP(S) only. Calendar file size and occurrence counts are bounded. Import is parsed and previewed before a transaction. Attachments are links only; private file upload, signed URLs and malware scanning are not implemented and should not be added as public uploads.

The HTML meta CSP disallows objects and unsafe scripts, permits only self-hosted assets and the explicitly used Google authorization script, and limits connections to configured Supabase and Google endpoints. GitHub Pages cannot provide every custom response security header. A meta CSP cannot enforce `frame-ancestors`; do not claim full anti-framing protection. Revisit CSP if endpoints change. OAuth access tokens live only in page memory. Supabase Auth persists a session in browser storage; never treat a shared browser profile as a secure vault.

Back up before deletion or restore. Local delete uses undoable tombstones; account deletion is explicit and irreversible on the backend, but other devices and external export copies can remain. There is no automatic backup deletion in other services.

Dependency updates: use the lockfile, `npm audit`, build and regression tests. Current dependency overrides update build-time glob/minimatch to patched releases; verify PWA output after changes. Report a suspected exposure privately to the repository owner rather than posting records or keys in a public issue.
