# MYHOURS — CODEX MASTER BUILD DIRECTIVE (V2)

> **Attach `MyHours.build-spec.v2.ts` to this request.** It is the authoritative full product specification. Preserve and integrate any functional code already in the repository. The goal is a real, maintainable application, not a one-shot design prototype.

## 1. Who you are and what to deliver

Act as the principal full-stack engineer, product designer, UX researcher, security reviewer, quality engineer and documentation author for **MyHours**. You are building a personal daily operating system for a student: routines that explain what to do in the morning and evening, actual school assignments and grades, a calendar, notes, math and learning tools, projects, meaningful goals, leisure and fitness, and optionally a genuinely native built-in AI.

The owner wants it accessible from desktop, iPhone and a managed school Chromebook using a `*.github.io` site. **Produce a functioning web application with source code, tests and deployment instructions. Do not respond with only a pitch, screenshots, static HTML mockup or progress report.**

Read the entire attached TypeScript specification, including `pages`, `detailedModules`, `planningIntelligence`, `modelAndStorage`, `cloudAndIdentity`, `nativeAI`, `personalizedLifeSystem`, `visualSystemV2`, `engineeringContract`, `implementationPhases`, `testMatrix` and `codexExecutionRules`.

The spec is longer than a single coding task. Do **not** try to implement all optional features simultaneously. Build it as an evolving product, with a fully usable release at the end of every phase and honest tracking of unfinished capabilities. Do not describe a future feature as implemented.

## 2. Critical product definition

A student opens MyHours and gets the answer to four questions:

1. **What should I do right now?** A concrete next action with a checklist, not a motivational quote.
2. **What does the rest of today look like?** Real commitments, manageable work and genuinely unscheduled free time.
3. **What's happening with school?** Classes, actual due assignments, missing work, tests and grade snapshots with source dates.
4. **How does today connect to my future?** One manageable project, skill or goal, with an editable next step.

The day planner must include real-life actions—wake up, bathroom, brush teeth, wash up/shower if desired, dress, breakfast, pack bag, leave, school/transit, return home, snack, decompress, do real homework, train if scheduled, dinner, clean up, games/social/free time, prepare for next day, brush teeth, wind down, sleep opportunity. It must show **distinct editable Monday-through-Sunday routines**, not identical generic cards repeated 1,000 times. Special templates include practice day, heavy homework, exam preparation, weekend, school break, sick/low energy and disrupted day.

The user’s future plans may change, so no fixed personal graduation date, school hours, teacher names, grades, household address or private evaluations belong in public repo data. Everything personal is entered or privately imported into a user's workspace. Use synthetic fixtures only.

## 3. Non-negotiable architecture and safety

- **Static host:** GitHub Pages for built HTML/JS/CSS/PWA only. Support both user-root sites and `/repository/` sites. No server-side code runs on GitHub Pages itself.
- **Front end:** React + TypeScript strict + Vite; route-driven layout with a clean component system; accessible, mobile-first. Avoid adding unneeded dependencies.
- **Offline-first:** IndexedDB (Dexie or equivalent) is the default database for local tasks, courses, notes, routines and schedule. The shell must remain usable offline after initial installation. Provide robust export/import and storage quota/error recovery.
- **Account mode:** Optional Supabase authentication, cloud tables with RLS and multi-user isolation, a durable sync outbox, and explicit conflict resolution. Use only current browser-safe publishable keys and never expose Supabase secrets or service-role keys.
- **AI:** **Built into the app UI**, not a ChatGPT iframe or a vendor-embedded site. Hosted model calls need a protected authenticated function/API, secret stored server-side, quota/budget controls and strict consent-based context scope. No secretly transmitting the user's whole database.
- **AI actions:** Read only scoped records, return record IDs/source evidence, show a diff/preview for changes and require explicit approval before any mutation. Invalid/unauthenticated operations must fail safely.
- **Student privacy:** Minimal collection, no ad-tech, no public profile, no school portal credential scraping, age-eligibility awareness, no fake grades or academic deadlines. No automatic streaming of private records to third-party services without consent.
- **Health:** Include balanced movement, recovery and sleep support, never restrictive eating, weight/body ranking, unsafe training challenges or punishment for missed habits.
- **Backup and ChatGPT collaboration:** Offer versioned JSON backup and an optional **explicitly user-created redacted read-only ChatGPT snapshot**. This app cannot magically expose browser local IndexedDB to ChatGPT; the owner can upload the snapshot or authorize a legitimate connected destination. No public secret URLs to access private data.

## 4. Design is as important as functionality, but comes second

The owner actively dislikes the generic “AI SaaS dashboard” look: endless gradient cards, nested rounded rectangles, fake statistics and clutter. Build an **editorial, precise, modern interface**. Typography, spacing, thin dividers and intentional alignment should create hierarchy. Use cards only when content warrants them. Good mobile interaction is mandatory.

Offer a clean default light/dark system with restrained accents. Optional theme choices: studio minimal, low-glare dark, subtle cyberpunk, frost/glass, soft-raised surfaces. Optional rain/snow, cursor afterimages and an original roaming companion are **off by default**, configurable independently and disable entirely under reduced motion or battery-conscious mode. Use original visual assets, not copied proprietary screens, logos or music.

Build the functional shell and core flows first. Treat animations, companion, music and knowledge graph as later optional modules.

## 5. Recommended implementation stack

You may refine these choices for sound technical reasons, but write the reason in `ARCHITECTURE.md`.

- React, TypeScript, Vite, React Router.
- IndexedDB through Dexie, with versioned migrations.
- Zod for validation at imports, storage and API boundaries.
- A tested date/time utility; carefully distinguish date-only deadlines from timestamped events.
- A minimal accessible design system with semantic components and CSS tokens.
- Vitest and React Testing Library for logic/component tests; Playwright for critical browser flows.
- Optional Supabase Auth/Postgres/Edge Functions/Storage and migrations, with RLS tests.
- GitHub Actions for static build/deployment, with correct Vite base and deep route behavior.
- Lazy loading of math graphing, knowledge graph and visual effects so the everyday app stays fast on a Chromebook.

Do not assume external keys or providers are connected. Build the local app so it works with **zero** cloud/AI configuration.

## 6. Start with these actual usable flows

**Flow A: My first day.** Open app → choose “Continue locally” → optional set wake/departure/school return/sleep and day types → add a course → add real assignment → edit morning routine → open Today → see next actual action → complete a step → refresh → data remains.

**Flow B: School recovery.** Add a course and grade snapshot → indicate missing/late/unknown work → show correct priority list without claiming grade math is known → create a draft teacher contact message → schedule a focused review task → verify source information.

**Flow C: Normal weekday.** Morning routine → school/transit blocks → after-school snack and downtime → 1–2 actionable school tasks → training if a real practice event exists → dinner, shower and recreation → prepare bag → wind down.

**Flow D: Reschedule reality.** User reports being home late or having unexpected homework → algorithm checks actual calendar and buffers → suggests moving optional project work → leaves essential events unchanged → user approves the draft → changes persist.

**Flow E: Notes & learning.** Create a Markdown note → link it to Algebra → write a worked example → add one flashcard or mistake log entry → get a scheduled review → search and reopen notes offline.

**Flow F: MyHour AI.** User signs in and explicitly enables protected model backend → selects task/calendar/notes scope → asks “What should I do now?” → grounded answer references allowed records → draft a new task → review and approve → action shows in the local task list and optional sync.

**Flow G: Data ownership.** Export entire local workspace → clear test workspace → restore backup → compare counts and essential records → produce user-controlled redacted summary for ChatGPT.

**Flow H: Optional sync.** User opts in to connected account → sign in with legal/eligible provider → upload only owned records → edit on another device → sync states and conflict resolution work → user A cannot read user B.

## 7. Build phases, in this exact priority order

### P0 — Architecture and safe shell
Inspect all repo files. Preserve relevant code, assess current functionality and fix broken build setup. Create data types, storage adapter, route shell, design tokens, GitHub Actions and test scripts. Write a short plan. Make a real running app.

### P1 — Daily local MVP (highest priority)
Implement Today, 7 day-specific routines, Inbox/Tasks, Calendar, Courses/Assignments, Notes, basic Projects, Settings, offline persistence, backup/restore and mobile navigation. **Make these end-to-end usable before spending time on hosted AI or visual effects.**

### P2 — Academic and scheduling intelligence
Implement grade snapshots and known-weight calculator, assignment recovery, time-conflict detection, scheduling draft/approval, exams, study sessions, weekly reviews and basic CSV/ICS/JSON import. All uncertain grades/dates stay uncertain.

### P3 — Cloud accounts and sync
Implement eligible optional auth, RLS-secured schema, private files, two-device sync, conflicts, account deletion/export and multi-user negative tests. Document required setup with no fake “connected” states.

### P4 — First-party hosted AI
Implement protected server function, consent scopes, native assistant chat, grounded record citations, safe action drafting, quota/rate limits, error handling and optional compliant image uploads.

### P5 — Education, careers and life modules
Add skills, lesson library, math lab, graduation horizon, personal finance ledger, fitness/recovery, career pathway comparisons, opportunity tracking, portfolio and character exercises. Use real data, no phantom progress.

### P6 — Optional integrations and polish
Add Google Calendar/Drive exports with permissions where feasible, music provider links, original companion, theme studio, lightweight effects and performance/accessibility polish.

At each phase, update `PROJECT_STATUS.md` with implemented, tested, partially implemented, not started and blocked. **Do not silently skip a requirement or add a dead-end navigation route.** If time is limited, complete a smaller real usable scope and identify remaining work.

## 8. Database, calculations and scheduling rules

Follow `modelAndStorage` entity definitions. Every record has stable ID, schema version, creation/update timestamps, an owner in cloud mode, source provenance and optional verification status. Build transactional repositories and migrations; test round-trip import/export and durability.

- A task is **one record**; School, Today and Calendar are views/links, not copies.
- A grade from a portal is a snapshot and must retain term, source and timestamp.
- Unknown grading weights mean **unknown** calculated grade. Passing grades need not be numeric.
- Date-only due dates and time-zone-aware event timestamps are separate.
- Scheduled blocks must fit in 24-hour reality alongside transit, meals, recovery and preferred sleep.
- Never silently move fixed events, extend a day or turn unverified future school calendar dates into facts.
- User-chosen priorities beat arbitrary automated scoring; explain why suggestions are made.
- Special academic routines use different actions by subject (math practice, science concept review, writing revision, Spanish recall, etc.), not “study” repeated everywhere.

## 9. Test gates and quality bar

**Before calling P1 finished:** offline create/edit/complete task; distinct Monday/Sunday routine; local note autosave; conflict-free manual calendar; add course/assignment; backup/restore; mobile navigation; typecheck/lint/build and browser smoke tests.

**Before calling P2 finished:** exact grade calculations with complete data, honest unknown results for incomplete data, recurring task exception, imported schedule preview, calendar conflict display, and feasible replanning tests.

**Before calling P3 finished:** verified multi-user RLS deny tests, no client secrets, successful/failed sync states, two-device conflict and account/data deletion flow.

**Before calling P4 finished:** actual guarded model call with credentials in a protected environment, zero unapproved record exposure, real cited record IDs, approval of all writes, and strong failure behavior.

**Before calling release finished:** smartphone and desktop E2E tests, keyboard navigation, reduced-motion, signed-out mode, no dummy percentages, no fake working buttons, security review, deployment URL test and source bundle secret scan.

## 10. Repository files to produce

```
README.md
ARCHITECTURE.md
SECURITY.md
PRIVACY.md
DATA_MODEL.md
AI_DESIGN.md
PROJECT_STATUS.md
BUILD_CHECKLIST.md
CHANGELOG.md
.env.example                     # browser-safe vars only
src/...                          # features, domain, UI, data, integrations
public/manifest.webmanifest       # app icons and PWA config
supabase/migrations/...           # optional cloud schema and RLS
supabase/functions/...            # optional protected hosted AI
supabase/tests/...                # authorization verification
.github/workflows/deploy.yml      # GitHub Pages deployment
```

Acknowledge optional dependencies honestly. The owner may need to configure Supabase, the AI provider and consent-based Google integrations; do not invent credentials, deploy status or successful sync.

## 11. The response format after each coding session

Provide a concise plain-English report with:

1. **Built:** precisely working routes and flows.
2. **Verified:** commands executed, tests run and whether they passed.
3. **Still not working:** missing features, requirements, blockers, and real limitations.
4. **Run it:** exact local commands and if available the *actual* GitHub Pages URL.
5. **Next:** the 3–6 specific next implementation tasks.

Do not call it done because it looks impressive. An app that stores real data reliably and tells the student what to do today is worth far more than ten decorative modules.

**Now inspect the project, read the specification, and start implementing P0 and P1. Keep working through code and tests, not just a proposal.**
