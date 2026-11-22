# MyHours data model

MyHours stores user-owned records in IndexedDB through Dexie. Every record has a UUID, kind, validated data payload, created/updated timestamps, revision number, sort order and provenance. Tasks, assignments, calendar views and Today link to the same record rather than making copies.

## Main record groups

- **Planning:** tasks, routines, dated routine checks, events, projects, reviews, checkpoints and daily logs.
- **School:** courses, assignments, grade snapshots and gradebook assessments. A reported grade keeps its source and date; a weighted result stays unknown unless the actual weights and points are present.
- **Learning:** notes, reading and writing records, focus areas, practice, evidence, mistakes, lessons, quiz attempts and flashcards.
- **Life:** qualitative check-ins, money ledger entries, goals, careers, opportunities and music links.
- **Privacy and operations:** school portal links, import/export history and optional AI activity metadata.

The schema is defined in `src/domain/model.ts`. Zod validates create/edit, import, restore, migration and hosted-AI boundaries. `src/data/repository.ts` owns transactions, reference checks, revisions, tombstones and local persistence.

## Dates and provenance

Deadlines without a time use `YYYY-MM-DD`. Timed events use an offset-aware ISO timestamp plus an IANA timezone. Imported grade and school data are marked as unverified unless the user explicitly verifies them. A proposal is not automatically a deadline or a calendar event.

## Storage and account mode

Local data stays in this browser profile and is not encrypted by MyHours. Users can export and restore a versioned JSON backup. Optional account workspaces use a separate local database; manual sync is available after a Supabase project is configured. Cloud rows are scoped by authenticated user and guarded by RLS and compare-and-swap writes. Preferences remain local to each device.

See [EXPORT_FORMAT.md](EXPORT_FORMAT.md), [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) before importing personal school records.
