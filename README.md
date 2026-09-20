# College Timetable Management System

A collision-free timetable system for colleges running multiple streams
(BSCIT, BSCCS, BSC/BCOM, BCOM, BCOM(MS), 5-Year LLB), built on
**Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL**.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    Edit .env — at minimum set JWT_SECRET to a long random string:
#    openssl rand -base64 48

# 3. Start PostgreSQL (or point DATABASE_URL at your own server)
docker compose up -d

# 4. Create the schema and seed demo data
npm run setup

# 5. Run it
npm run dev
```

Open <http://localhost:3000>. The seed script prints the login credentials it
created — by default `admin@college.edu` / `Admin@12345`.

Then open **Timetable → Timetable Builder** and press **Auto-Generate**.

### Without Docker

Create a database and user yourself, put the connection string in
`DATABASE_URL`, and run `npm run setup`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run setup` | `prisma generate` + migrate + seed (first-time setup) |
| `npm run db:migrate` | Create/apply a migration after editing the schema |
| `npm run db:seed` | Re-run the seed (idempotent) |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:reset` | **Drops and recreates everything** |
| `npm run test:engine` | Run the scheduling engine test suite |
| `npm run typecheck` | `tsc --noEmit` |

---

## The one architectural rule

```
Teacher ─┐
Subject ─┼─► SubjectAllocation ─► TimetableEntry
Class  ──┘
```

A timetable cell **cannot** reference a teacher and a subject directly. It can
only reference a `SubjectAllocation` — a row that already says *"this teacher
teaches this subject to this class, N times a week."*

That is why arbitrary combinations are impossible: there is no code path that
accepts a loose teacher + subject pair, because the database column does not
exist. The unique constraint `@@unique([day, timeSlotId, allocationId])` adds a
final guard at the storage layer.

---

## The collision engine

`src/lib/collision.ts` is the single source of truth for what is legal. Manual
drag-and-drop, click-to-place and the auto-generator all call the same
`checkPlacement` function, so they cannot disagree.

Hard constraints, all enforced:

| # | Constraint |
|---|---|
| 1 | A teacher cannot be in two places at once |
| 2 | A class cannot sit two lectures at once |
| 3 | A room cannot host two classes at once |
| 4 | Part-time teachers only within their availability windows (day *and* time) |
| 5 | Nothing on a break or lunch slot |
| 6 | Nothing on an inactive slot |
| 7 | Nothing on a non-working day |
| 8 | Daily period limit per teacher |
| 9 | Weekly period limit per teacher |
| 10 | Room type — a practical requires a lab |
| 11 | Multi-period lectures need an unbroken run of periods |

Constraint 11 is the subtle one. A 100-minute practical occupies two
consecutive 50-minute periods, and it may not straddle the morning break or
lunch. With the seeded slot layout (3 periods, break, 2 periods, lunch,
2 periods) that yields exactly four legal two-period windows — the engine
computes these rather than assuming any two adjacent rows will do.

### Where validation actually runs

Drop targets shown in the builder are computed **by the server** and returned
with the grid, so the green cells are the cells the server will genuinely
accept. Then every mutation is re-validated **inside the database transaction**
against rows read in that transaction — otherwise two admins dragging lectures
simultaneously could each pass a check against stale data and both write.

### Auto-generation

`src/lib/scheduler.ts` runs two passes:

1. **Most-constrained-first greedy.** Ordering matters more than anything else
   here: placing flexible full-time theory lectures first fragments the grid and
   strands the hard ones. Multi-period practicals and part-time staff go first.
2. **Bounded backtracking repair.** For anything still unplaced, find a window
   blocked by exactly one existing lecture, relocate that lecture if it can live
   elsewhere, and take its place.

Timetabling is NP-hard, so this is a heuristic, not an exhaustive solver. What
it will *never* do is relax a hard constraint to reach 100%. If a requirement
genuinely cannot fit — a part-time teacher allocated more lectures than their
availability window can physically hold — it reports the shortfall and the
reason instead of producing a conflicted schedule. **A refusal to schedule is
usually correct data telling you something, not a bug.**

---

## Project structure

```
prisma/
  schema.prisma          Full data model
  seed.ts                Idempotent seed (admin + optional demo data)

src/lib/
  domain.ts              Engine types, context builder, time helpers
  collision.ts           ★ The collision engine — all hard constraints
  scheduler.ts           Auto-generation (greedy + backtracking repair)
  validation.ts          8-point pre-publish validation, workload derivation
  timetable-service.ts   DB ↔ engine bridge, transactional place/move
  crud.ts                Generic CRUD route factory
  schemas.ts             Zod request validation
  auth.ts                JWT sessions (jose — Edge-compatible)
  api.ts                 Auth guards, error shaping
  audit.ts               Audit trail
  colors.ts              Subject colours (screen, PDF, Excel)
  export-data.ts         Shared export shaping

src/app/api/             34 route handlers
src/app/(app)/           Authenticated pages
src/components/          UI primitives, timetable grid, resource pages
scripts/engine.test.ts   66 assertions against the real engine
```

### Why a CRUD factory

Ten resources (streams, rooms, subjects, …) behave identically: list, create,
update, delete — admin-guarded and audited. Writing that ten times invites the
copies to drift, and a missing auth check in one of ten near-identical files is
exactly the kind of bug that hides. `src/lib/crud.ts` implements it once;
each resource is a declaration. The same reasoning drives
`src/components/ResourcePage.tsx` on the front end.

---

## Roles

**Admin** — everything: master data, the builder, publishing, reports, audit.

**Teacher** — dashboard, their own timetable, their own work allotment, and the
published timetable views. They see a class timetable only once it has been
**published**.

Route middleware redirects unauthenticated traffic, but it is *not* the security
boundary — every API route re-checks the session and role independently, so the
JSON endpoints are not exposed to anyone who skips the HTML.

---

## Workflow

1. **Settings** — college name, working days, college hours
2. **Streams** → **Academic Years** → **Classes & Divisions**
3. **Teachers** (set availability; required for part-time staff)
4. **Time Slots** and **Rooms**
5. **Subject Master** (+ optional **Syllabus**)
6. **Subject Allocation** — teacher + subject + class
7. **Timetable Builder** — drag, or Auto-Generate
8. **Validate** → **Publish**

Pre-publish validation runs eight checks: subjects allocated, lectures complete,
no collisions, availability respected, slot legality, room requirements,
workload ceilings, and structural data integrity. Publishing is blocked until
all eight pass; moving back to Draft or Archived is always allowed.

---

## Exports

PDF (jsPDF) and Excel (ExcelJS) exports preserve subject colours, because a
colourless printed timetable is much harder to read at a glance. Both are
generated from one shared description in `export-data.ts` so the two formats
cannot drift apart. Print stylesheets force background colours through, which
browsers strip by default.

---

## What has and has not been verified

**Verified.** The scheduling engine has a test suite of **66 assertions, all
passing**, run against the real `src/lib` modules — not mocks:

```bash
npm run test:engine
```

It covers slot geometry, all three collision types in isolation from each other,
break/lunch/inactive/closed-day rejection, part-time availability (wrong day,
before the window, after the window, and the allowed case), workload ceilings,
room-type matching, multi-period contiguity, move self-exclusion, drop-target
consistency in *both* directions (no false positives and no omissions),
auto-generation completeness and determinism, behaviour under deliberate
over-subscription, the validation report, and workload derivation.

The suite needs no `node_modules` — it runs on Node's built-in TypeScript
stripping, so it works in CI before `npm install`.

**Not verified.** This project was assembled in an environment with no network
access, so `npm install`, `tsc --noEmit`, `prisma generate` and `next build`
could not be run. That means:

- **TypeScript compilation is unchecked.** Import paths and named exports were
  verified statically, and the engine executes correctly, but a type error
  elsewhere is possible. Run `npm run typecheck` after installing.
- **The Next.js build is unchecked.** Expect to fix the occasional small thing.
- **Prisma Client types are unchecked** — they don't exist until
  `prisma generate` runs, which is why `npm run setup` does it first.

If `npm run build` reports an error, it will almost certainly be a narrow type
mismatch rather than a structural problem — the business logic underneath is the
part that has been tested.

---

## Production notes

- Set a strong `JWT_SECRET`. The app refuses to start signing sessions with a
  secret shorter than 16 characters rather than doing it quietly.
- Change the seeded admin password immediately.
- Use `npm run db:deploy` (not `db:migrate`) in production.
- Set `SEED_DEMO_DATA=false` to seed only the admin and settings.
- Sessions are httpOnly cookies, `secure` in production, 8-hour expiry.
