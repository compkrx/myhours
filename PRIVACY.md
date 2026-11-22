# Privacy and ownership

Local mode sends no personal records to a server. It uses browser IndexedDB and a service worker for the application shell. The app does not include tracking, ads, public leaderboards, third-party analytics or remote fonts. Nothing is preloaded as if it were your history.

You choose what to enter. Real identity, exact home location, medical history, school credentials and financial account information are not required. Money is a manual educational ledger. Health entries are optional qualitative reflections; there is no weight, calorie, body ranking or punitive streak tracker.

Cloud sync, when configured and explicitly used, sends account records to your selected protected backend. Local-only and signed-in account workspaces are separate. The UI reports actual sync outcomes, errors and unresolved conflicts. It does not claim background synchronization. Device preferences currently stay on that device.

Hosted AI requires a protected account and per-request category approval plus consent. Selected contents go to your configured inference provider through the authenticated backend. Prompts and full conversations are not stored by this app by default. Conversations exist in memory until leaving the screen. Optional retained activity holds categories, references and approval state, without prompt contents. Provider-side retention is governed by that provider's actual terms and configuration; this app cannot promise zero retention there.

Read-only snapshots exclude money, private notes and personal reflections by default. Teacher and generic notes fields are redacted. Selected note excerpts are capped at 500 characters. Other fields can still contain information you typed, so inspect the preview. A snapshot does not grant ChatGPT live access. Full backups include private information and tombstones and should be handled separately from sharing reports.

Optional Drive export uses `drive.file`, memory-only OAuth tokens and a chosen app-accessible folder. Optional Calendar read and write permissions are requested separately. No contacts are notified and no email is sent. Google tokens are not saved for background refresh. Reconnect after expiry or reload.

Use only service accounts for which you meet the provider's age and consent rules, with parent/guardian assistance where required. The app does not bypass those rules or verify eligibility for you.

You can export or restore a complete local backup. Local clearing deletes this workspace's browser records after a typed confirmation. Cloud account deletion removes its authentication row and owned cloud records. Exported files, copies on other devices and files uploaded to external services must be deleted in those destinations separately.
