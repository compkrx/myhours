# Portable formats

Full backups use `format: "project-life-backup"`, `version: 1`, a UTC ISO `generatedAt`, validated `preferences` and an array of complete record envelopes. An envelope has UUID `id`, `kind`, typed `data`, ISO creation/modification instants, positive integer `revision`, finite `sortOrder`, explicit `provenance` and optional `deletedAt` tombstone. Date-only fields stay `YYYY-MM-DD`; instants require an offset. The preferences hold an IANA timezone.

Restore validates the whole file and duplicate IDs before any write, then replaces the local database in one transaction. Restore is restricted to local-only mode. Read-only snapshots cannot be imported as full backups. File limit: 20 MB / 50,000 records.

Read-only sharing uses `format: "project-life-readonly-snapshot"`, `version: 1`, generation timestamp, timezone, schema description, selected categories, redacted field list, provenance per record, unresolved questions and an explicit stale-data warning. Markdown represents the same approved subset. Snapshot records may lack redacted fields and must not be treated as a lossless backup.

`examples/fake-backup.json` is a clearly labeled test fixture and is never loaded automatically. Keep personal imports outside the repository.
