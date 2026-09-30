# FXT Employee ID Card System

Web application for **Fast Express Transport Limited (FXT)** to create, manage, print and verify employee ID cards.

- Staff records with photos, departments and job titles
- Professionally designed **CR80 cards in portrait (53.98 × 85.6 mm) and landscape (85.6 × 53.98 mm)**, front and back, in FXT branding
- Secure **QR verification**: anyone scanning a card sees a live VALID / EXPIRED / INVALID result
- Print (card printer or A4), **vector PDF** and **600 DPI PNG** export
- Card history, reissue / renewal / lost-card workflow, expiry tracking
- Role-based administration, audit log, CSV bulk import, configurable settings

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS v4, custom shadcn-style components, lucide icons, sonner toasts, light / dark / system themes |
| Database | PostgreSQL 14+ via Drizzle ORM (SQL migrations in `db/migrations`) |
| Auth | Server-side sessions (hashed tokens in Postgres, `HttpOnly` cookies), scrypt password hashing, role permissions |
| Card rendering | One SVG source (mm units) → inline preview, browser print, PNG (resvg), vector PDF (pdfkit) |
| Validation | Zod (shared by forms and server actions) |
| Images | sharp (validation, crop, resize, metadata stripping) |
| Tests | Vitest (unit + integration against real Postgres-in-WASM) |

### Architecture for Vercel + Supabase

- **Database:** Supabase PostgreSQL through Drizzle ORM. The app connects **server-side only**, through the Supabase *transaction pooler*, with a small pool per serverless instance. Migrations are an explicit step (`pnpm db:migrate`) and never run during a build or a request.
- **Auth:** the app's own server-side sessions and roles (not Supabase Auth). The browser never talks to the database or storage.
- **Photos:** a **private Supabase Storage bucket**. The server reads and writes it with the secret key and streams photos to authorised admins, or to the verification page for a valid token only. Photos are served with `Cache-Control: private, no-store`, and no public or signed URLs are created.
- **Rate limiting and lockout:** stored in Postgres, so limits hold across all serverless instances.
- **Security:** Row Level Security is enabled on every table with no policies (deny-by-default), and all privileges are revoked from Supabase's `anon`/`authenticated` roles, so the auto-generated Data API exposes nothing.
- **Portability:** the same code runs on Docker, Coolify or Dokploy with plain Postgres and a local storage volume (`STORAGE_DRIVER=local`). Local development needs no services at all: it uses embedded PGlite and a local `./storage` folder.

---

## Requirements

- Node.js 20.9+ (tested on Node 24)
- pnpm 10+ (`corepack enable`)
- PostgreSQL 14+ for production (not needed for local development)

## Local development

```bash
cd id-system
pnpm install
cp .env.example .env.local        # then edit - see below
pnpm db:migrate                   # applies SQL migrations
pnpm db:seed                      # departments, positions, card templates, default settings
pnpm admin:create --email you@company.co.uk --name "Your Name"   # prompts for a password
pnpm dev                          # http://localhost:3000
```

With `DATABASE_URL` left empty in development, an embedded Postgres (PGlite) database is stored in `./.data/pglite`. Stop `pnpm dev` before running `db:*` or `admin:create` scripts against the embedded database (it is single-process).

Optional demo data (clearly-marked fictional people, with a **DEMO** watermark on their cards):

```bash
pnpm db:seed:demo
```

Demo records are flagged `is_demo`, labelled DEMO everywhere, and their cards and verification pages say "DEMO · NOT VALID". The demo seeder refuses to run when `NODE_ENV=production`.

## Environment variables

See [.env.example](.env.example). **All variables are server-only.** There are no `NEXT_PUBLIC_*` variables, and a test enforces that.

| Variable | Vercel Production | Vercel Preview | Local dev | Purpose |
| --- | --- | --- | --- | --- |
| `APP_URL` | `https://id.fxt-ltd.co.uk` | *unset* (uses the preview URL) | optional | Base URL printed in QR codes |
| `FXT_DATA_ENVIRONMENT` | `production` | `preview` | *unset* / `development` | Data-set interlock (see below) |
| `DATABASE_URL` | prod **transaction pooler** (port 6543) | **separate** preview DB pooler URL | *unset* → PGlite | Runtime database |
| `DATABASE_SSL` | `require` | `require` | – | TLS to Supabase |
| `DB_POOL_MAX` | optional (default 3) | optional | – | Connections per instance |
| `STORAGE_DRIVER` | `supabase` | `supabase` | `local` (default) | Photo storage adapter |
| `SUPABASE_URL` | prod project URL | preview project URL | – | Storage API base |
| `SUPABASE_SECRET_KEY` | prod **secret** key | preview secret key | – | Server-side Storage access (bypasses RLS) |
| `SUPABASE_STORAGE_BUCKET` | `employee-photos` | `employee-photos` | – | Private bucket name |
| `SESSION_TTL_HOURS` | optional (12) | optional | optional | Admin session lifetime |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` | `1` | – | Vercel uses the pinned pnpm version |
| `DATABASE_MIGRATION_URL` | **do not set in Vercel** | – | where you run migrations | Direct / session-pooler URL (port 5432) for `db:migrate` and admin scripts |

**Data-environment interlock.** On Vercel the app refuses to start if:

- production isn't `FXT_DATA_ENVIRONMENT=production`;
- a preview uses `production`, or has an `APP_URL` on `id.fxt-ltd.co.uk`;
- `DATABASE_URL` is missing, or the storage driver isn't Supabase.

Vercel scopes variables per environment, so accidentally giving a preview the production credentials also gives it the production marker, and the deployment fails safe. PGlite is never used on Vercel or when `FXT_DATA_ENVIRONMENT=production`.

## Database

- Schema: [src/lib/db/schema.ts](src/lib/db/schema.ts)
- Migrations: [db/migrations](db/migrations). `0003_serverless_hardening.sql` adds the shared rate-limit table and revokes Supabase API-role privileges. `0000_initial_schema.sql` holds the tables, constraints and indexes. `0001_security_and_triggers.sql` holds the `updated_at` triggers, card-identity immutability, the append-only audit log and RLS. `0002_card_orientation.sql` adds the `card_orientation` enum and the persisted `layout`/`orientation` columns (existing cards default to portrait), with a CHECK that each layout matches its orientation.
- Apply: `pnpm db:migrate` (idempotent). To change the schema, edit `schema.ts`, run `pnpm db:generate` and commit the generated SQL.

Tables: `users`, `sessions`, `departments`, `positions`, `employees`, `employee_cards`, `card_templates`, `system_settings`, `audit_logs`, `verification_events`, plus the `employee_number_seq` sequence.

Key integrity rules enforced by the database itself:

- employee numbers are unique (case-insensitive) and come from a sequence, so a number is never reused, even after deletion;
- one **active** card per employee at most (partial unique index);
- card number, verification token, version, issue date and printed details of an issued card can never be changed;
- replaced, lost, revoked and expired cards can never become active again;
- audit log rows cannot be updated;
- cards and employees cannot be deleted while history references them.

## Deploying to Vercel + Supabase (production: `id.fxt-ltd.co.uk`)

The repository root is this `id-system` folder.

### 1. Create and configure Supabase
1. Create a project at supabase.com (region **London, eu-west-2**, to match `vercel.json` → `lhr1`), and record the database password in your password manager.
2. **Project Settings → Data API:** remove `public` from *Exposed schemas*, or disable the Data API entirely. The app doesn't use it; the migrations also revoke all API-role privileges as defence in depth.
3. **Connect** (top bar) → copy:
   - **Transaction pooler** URI (port **6543**) → `DATABASE_URL` for Vercel.
   - **Session pooler** URI (port **5432**) or the direct connection → `DATABASE_MIGRATION_URL`, used only on your machine.
4. **Project Settings → API Keys:** create or copy a **secret key** (`sb_secret_…`; the legacy `service_role` key also works) → `SUPABASE_SECRET_KEY`. Copy the project URL → `SUPABASE_URL`. Never use the publishable/anon key for this, and never expose the secret key to the browser.
5. For previews, create a **second Supabase project** (or at least a separate database and bucket) so previews never touch production data.

### 2. Create the private storage bucket (no policies needed)
From your machine, with the production values in your shell (not committed):
```bash
FXT_DATA_ENVIRONMENT=production pnpm storage:setup --confirm-production
```
This creates `employee-photos` as a **private** bucket (JPEG/WebP only, 10 MB cap), or verifies that an existing one is private. Alternatively, run [supabase/storage-bucket.sql](supabase/storage-bucket.sql) in the SQL Editor.

**Required Storage policies: none.** `storage.objects` has RLS enabled, and with no policies neither the anon nor the authenticated role can list, read, write or delete photos. Only the server (secret key) can. Do not add policies that grant `anon`/`authenticated` access.

### 3. Apply migrations (explicit step)
```bash
FXT_DATA_ENVIRONMENT=production pnpm db:migrate --confirm-production   # uses DATABASE_MIGRATION_URL
FXT_DATA_ENVIRONMENT=production pnpm db:seed --confirm-production      # departments, positions, templates, settings (no demo data)
```
Then run [supabase/verify-security.sql](supabase/verify-security.sql) in the SQL Editor: every check should return zero rows, and the bucket should show `public = false`. Migrations are never run by `pnpm build` or at request time. Re-run `pnpm db:migrate` whenever a release adds a migration, **before** promoting that release.

### 4. Create the first administrator
```bash
FXT_DATA_ENVIRONMENT=production pnpm admin:create --email you@fxt-ltd.co.uk --name "Your Name" --confirm-production
```
The password is prompted (hidden). There are no default accounts. `SEED_ADMIN_*` and demo data are refused for production.

### 5. Import the repository into Vercel
1. Push this repository to GitHub (see *Git* below), then Vercel → **Add New… → Project** → import it.
2. **Root Directory:** leave as the repository root (`./`), because this `id-system` folder *is* the repository. If you instead push the parent `FastEx` folder, set Root Directory to `id-system`.
3. The framework preset is Next.js; install and build come from `vercel.json` (`pnpm install --frozen-lockfile`, `pnpm build`).
4. **Settings → General → Node.js Version:** 22.x or 24.x.

### 6. Set environment variables
In **Settings → Environment Variables**, add the table above: **Production** values scoped to *Production* only, and separate **Preview** values scoped to *Preview*. Don't add `DATABASE_MIGRATION_URL`. Consider enabling **Deployment Protection** for previews.

### 7. Connect `id.fxt-ltd.co.uk`
Vercel → Project → **Settings → Domains** → add `id.fxt-ltd.co.uk`. Vercel then shows the DNS record to create at your DNS provider, typically a **CNAME** for `id` pointing at the target Vercel displays. Use exactly the value Vercel shows, and any TXT verification record it asks for. Wait for the certificate to be issued before printing cards.

### 8. Test production
1. Visit `https://id.fxt-ltd.co.uk/login` and sign in with the admin from step 4.
2. Add an employee, upload a photo (JPG/PNG/WEBP; it's cropped in the browser and re-validated on the server), and confirm the photo shows.
3. Issue a card. Open the preview, download the PDF and the PNG (300 and 600 DPI), and open the print page.
4. Scan the QR code with a phone: it should open `https://id.fxt-ltd.co.uk/verify/…` and show **VALID** with the photo.
5. Disable the card and scan again: it should show **INVALID** immediately (verification is never cached).
6. Sign out, then check that an admin photo URL (`/api/employees/<id>/photo`) returns 401.
7. Check **Audit log** for the actions above.

### Cards issued before the production domain
The QR URL is built from `APP_URL` when artwork is rendered; tokens are never rewritten. Cards **printed** from a local or test system encode `http://localhost…` and can't be verified in production. Production starts with its own database, so those tokens don't exist there anyway. **Reissue** any such card in production (reason *Other* or *Details changed*) and destroy the old print; don't try to edit tokens or snapshots.

### Migrating photos from a local/Docker install
If you move an existing self-hosted database to Supabase, restore it with `pg_dump`/`pg_restore`, then copy the photos:
```bash
STORAGE_DIR=./storage FXT_DATA_ENVIRONMENT=production pnpm storage:migrate-local --confirm-production
```
This uploads `photos/*.jpg` and `*-thumb.webp` under the **same keys** the database references. Existing objects are skipped, and **local files are never deleted**; keep them until you've verified production.

## Creating the first administrator

There are **no default accounts or passwords**. Create the first Super Admin from the command line:

```bash
pnpm admin:create --email you@company.co.uk --name "Your Name" --role super_admin
# add --confirm-production when FXT_DATA_ENVIRONMENT=production
# password is prompted (hidden) or read from ADMIN_PASSWORD
```

After that, Super Admins can add other administrators in **Settings → Administrators**.

| Role | Can do |
| --- | --- |
| Super Admin | Everything, including administrators and settings |
| Admin | Employees, cards (issue/disable), departments, positions, templates, audit log |
| HR / Employee Manager | Add/edit employees, upload photos, import CSV, issue cards |
| Viewer | Read-only access to employees and cards |

Permissions are checked on the server in every page, server action and API route ([src/lib/permissions.ts](src/lib/permissions.ts)); hiding buttons is only cosmetic.

## How QR verification works

1. When a card is issued, a **128-bit cryptographically random token** is generated (26 characters, base32). It contains no personal data and is unrelated to database IDs.
2. The QR code encodes `APP_URL/VERIFY/<token>` in upper case, so the QR can use its compact *alphanumeric* mode. That gives a smaller, more robust code; `/VERIFY` is rewritten to `/verify`.
3. Scanning opens `/verify/<token>`, which **always reads the database live** (no caching; `Cache-Control: no-store`) and evaluates:
   - card status (`disabled`, `lost`, `revoked` and `replaced` show **INVALID**),
   - expiry date in UK time (an active card past its expiry date shows **EXPIRED**, whatever its stored status),
   - employee status (left, suspended or archived shows **INVALID**).
4. Valid results show only photo, name, job title, department, employee ID, card number and dates. Expired results show no photo. Invalid results show only the card number. Phone, email, notes and other personal data are never shown.
5. Each check shows a ticking live clock, the check time and a unique reference, and is logged in `verification_events`. That makes screenshots easy to tell apart from a live result, and lets admins review scans in **Verification**.

Reissuing a card (lost, damaged, renewal, role change and so on) atomically marks the old card and creates a new card and token. The old QR code stops validating immediately.

## Card design, printing and export

### Layouts and templates

Two levels keep the design system expandable without renderer rewrites:

| Level | Where | Example |
| --- | --- | --- |
| **Layout**: a physical design and orientation, implemented by a renderer | `src/lib/cards/layouts/*.ts`, registered in [render.ts](src/lib/cards/render.ts) and [templates.ts](src/lib/cards/templates.ts) | `fxt-portrait-v1`, `fxt-landscape-v1` |
| **Template**: a database row = layout + options (role label, accent, title, QR on front…) | `card_templates` table, managed in **Card Templates** | "Driver / Landscape", "Management / Portrait" |

Every design family (Standard, Driver, Management, Temporary, Contractor) is seeded in both orientations. Adding, for example, "Contractor Landscape v2" means adding a template row, or registering a new layout key (which must contain `portrait` or `landscape`, enforced by a database CHECK) plus its renderer file. Shared SVG primitives live in `src/lib/cards/svg.ts`.

- **Portrait** `fxt-portrait-v1` (53.98 × 85.6 mm): the original design, byte-for-byte unchanged (a regression fixture test guarantees it). 3.6 mm safe margin, 3:4 photo, name fitted to two lines, front QR ~15 mm, back QR 22 mm with scan brackets.
- **Landscape** `fxt-landscape-v1` (85.6 × 53.98 mm): purpose-built horizontal composition, not a rotated portrait.
  - *Front:* the logo, a divider and the card title across the top. A 21 × 28 mm (3:4) photo on the left. In the centre, name (up to 2 lines), red rule, job title (up to 2 lines) and department; the text block is optically centred, and long values shrink, then wrap, never overlapping the photo or QR. Employee ID is baseline-aligned with the photo's bottom edge. On the right, a 19 mm QR code in a hairline frame, with "SCAN TO VERIFY" and VALID UNTIL. A navy footer band has a slanted red FXT block, the card number and the tagline.
  - *Back:* the same header and footer family. A details panel (card no., employee no., issued, expires), then the return-card text, the contact details configured in Settings (blank fields are omitted), a property statement and a signature line. On the right, a 21 mm QR code with red scan brackets.
- Both orientations use the unmodified vector logo, FXT navy `#02214F` and red `#D11E25`, 3 mm+ edge safety, and full QR quiet zones with no graphics over QR modules.
- Card numbers are separate from employee numbers: employee `FXT-00127` → cards `CARD-00127-01`, `CARD-00127-02`, …
- **Snapshotting:** each issued card stores its `layout`, `orientation` and template options (columns `employee_cards.layout` / `orientation`, plus `snapshot.templateConfig`). These fields are immutable at database level (trigger), so reprints are identical even if the template is edited later. Reissuing without choosing a template keeps the previous card's design, so a landscape card is reissued as landscape.
- **Backward compatibility:** migration `0002_card_orientation.sql` adds the columns with defaults `fxt-portrait-v1` / `portrait`, so every card issued before landscape support stays portrait. Unknown or legacy layout values also fall back to portrait in code.
- Card artwork always uses fixed brand colours, so dashboard dark mode never affects it. Non-valid cards and demo records are exported with a **VOID** or **DEMO** watermark.

**Printing** (Card preview → Print). The print page has no dashboard UI and uses physical sizes:

- *Card printer (CR80)*: one card side per page at 53.98 × 85.6 mm. Choose the CR80 media size, **Scale 100%**, **Margins: None**, **Background graphics on**, and duplex for both sides.
- *A4 sheet*: cards at exact size with cut guides, for printing on an office printer.

**PDF**: vector PDF, one page per side, page size exactly CR80 **in the card's own orientation** (landscape cards get 85.6 × 53.98 mm pages). Text is converted to outlines, so no fonts are needed on the printing PC. **PNG**: 600 DPI by default, or add `&dpi=300`. Both contain only the card artwork.

| Orientation | Physical | 300 DPI | 600 DPI |
| --- | --- | --- | --- |
| Portrait | 53.98 × 85.6 mm | 638 × 1012 px | 1275 × 2022 px |
| Landscape | 85.6 × 53.98 mm | 1011 × 638 px | 2022 × 1275 px |

The export pipeline reads each SVG's mm `viewBox`, so every layout shares the same PNG, PDF and print code. The print page uses named `@page` sizes per orientation and renders landscape artwork natively; nothing is rotated with CSS.

## Building and running in production

```bash
pnpm build
node .next/standalone/server.js   # after copying .next/static and public into .next/standalone (the Dockerfile does this)
```

### Docker / Coolify / Dokploy (self-hosted alternative)

`Dockerfile` (multi-stage, non-root, Next standalone output) and `docker-compose.yml` (Postgres 17 + app + one-shot migrator) are included:

```bash
cp .env.example .env          # set APP_URL and POSTGRES_PASSWORD
docker compose up -d db
docker compose run --rm migrate                         # migrations + reference data
docker compose run --rm migrate pnpm admin:create --email you@company.co.uk --name "Your Name"
docker compose up -d app
```

Put the app behind HTTPS (Coolify and Dokploy provide Traefik; otherwise use Caddy or Nginx). HTTPS is required in production because session cookies are `Secure` / `__Host-`.

In Coolify or Dokploy, deploy the repository with the Dockerfile (target `runner`), attach a persistent volume at `/data/storage` (`STORAGE_DRIVER=local`) or use Supabase Storage (`STORAGE_DRIVER=supabase`), add a PostgreSQL resource and set `DATABASE_URL` and `APP_URL`. Run `pnpm db:migrate && pnpm db:seed` once, using the `migrator` target or the platform's one-off command.

### Vercel
See **Deploying to Vercel + Supabase** above. Vercel-specific details:

- **Runtime:** card export (sharp, resvg, pdfkit) runs in the Node.js runtime.
- **Bundling:** `next.config.ts` includes the Inter fonts and pdfkit metrics in the export function, and excludes PGlite from all functions.
- **Photo uploads:** Vercel caps request bodies at 4.5 MB. The browser crops and downsizes photos before upload, and the server still re-validates and re-encodes them.
- **Persistence:** nothing persistent is written to the function filesystem.

## Backups

Back up **both** the database and the photo bucket. Store copies off-site and encrypted, and test a restore regularly.

**PostgreSQL** (employees, cards, tokens, audit log, settings, administrators):
- Supabase takes daily backups on paid plans; enable **Point-in-Time Recovery** for tighter RPO.
- Independent logical backup, from a trusted machine:
  ```bash
  pg_dump "$DATABASE_MIGRATION_URL" -Fc --no-owner --no-acl -f fxt-id-$(date +%F).dump
  ```
- Restore into an empty database or project:
  ```bash
  pg_restore --no-owner --no-acl -d "$TARGET_DATABASE_URL" fxt-id-YYYY-MM-DD.dump
  ```
  Then run `pnpm db:migrate` (a no-op if already current) and `supabase/verify-security.sql`.

**Photos** (Supabase Storage bucket `employee-photos`): the database *references* them. Losing them means reprints and verification lose the photo.
- Copy the bucket regularly with the Supabase CLI (`supabase storage cp -r ss:///employee-photos ./photo-backup --experimental`), or with any S3-compatible tool using Supabase's S3 access keys (Storage → Settings).
- Restore by uploading the files back under the **same keys** (`photos/<uuid>.jpg`, `photos/<uuid>-thumb.webp`). `pnpm storage:migrate-local` with `STORAGE_DIR` pointing at the backup folder does this, skipping existing objects.

Also keep: your Vercel environment variables (in a password manager, never in git) and the brand assets in `public/brand`. Never keep irreplaceable data only on a server or container filesystem.

## Security summary

- Server-side authorisation on every page, server action and API route; roles are read from the database, never from the client
- Sessions: 256-bit random tokens, stored hashed (SHA-256); `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefix; sessions revoked on role change, deactivation or password reset
- Passwords: scrypt (N=2¹⁵) with per-user salt; login rate limited per IP and per email **in Postgres, so limits hold across all serverless instances** (keys are hashed; no raw IPs or emails are stored); atomic failed-login counter and account lock after 5 failures; constant-time comparison with a dummy hash for unknown users; generic error messages
- CSRF: server actions only accept same-origin POSTs (Origin/Host check); cookies are `SameSite=Lax`
- XSS: React escaping, a strict nonce-based CSP for scripts, and XML-escaping of every value inserted into card SVGs
- SQL injection: parameterised queries only (Drizzle); `LIKE` wildcards escaped
- IDOR: every object access is checked against the caller's permissions; public access is limited to token-gated verification
- Uploads: MIME allow-list plus real decoding by sharp, size and dimension limits, animated images rejected, re-encoded to JPEG (strips EXIF/GPS and any embedded payload), server-generated object keys, stored in a private bucket, served only through authorised routes with `private, no-store` and `nosniff`; a failed upload or database update never replaces or deletes the existing photo
- Deployments: the production/preview data interlock, no PGlite or local-disk fallback on Vercel, secrets server-only, CI with no secrets in scope
- Security headers: CSP, HSTS (production), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, strict `Referrer-Policy`, `Permissions-Policy`, `noindex`
- Database: constraints, triggers, deny-all RLS, privileges revoked from Supabase API roles, append-only audit log

## Testing

```bash
pnpm lint
pnpm typecheck
pnpm test        # 74 tests: unit + integration (runs real migrations on in-memory Postgres; never a real database)
pnpm build
```

The tests cover: date and expiry logic, token entropy and format, permission matrix, validation, XSS-safe SVG output, **QR codes decoded from rendered front and back cards at 300 DPI**, employee-number allocation (no reuse, manual override, duplicates), the full card lifecycle (issue → lost-replacement → old QR invalid → new QR valid), disable and reactivate, expiry evaluation, leaving and archiving invalidating cards, database-level immutability, all-or-nothing CSV import, photo validation (malicious and disguised files rejected, EXIF stripped), the storage adapters (Supabase REST driver with a mocked API, local driver, key validation), photo rollback on failed uploads or database updates, Postgres-backed rate limiting (limits, window reset, concurrency, hashed keys), and the Vercel/preview configuration interlock.

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, typecheck, tests and the production build on every push and pull request, with no secrets in scope. `tests/setup.ts` aborts if any database or Supabase credential is present.

`pnpm tsx scripts/render-sample.ts <outDir>` renders a specimen card to SVG and PNG for design review.

## Project structure

```
db/migrations/            SQL migrations (generated + hand-written security migration)
scripts/                  migrate, seed, create-admin, storage setup/migration, brand/metric generators, sample renderer
supabase/                 private bucket SQL + post-migration security checks
.github/workflows/ci.yml  lint, typecheck, tests, build (no secrets)
public/brand/             official FXT logo (unmodified)
public/fonts/             Inter (used by UI, PNG and PDF rendering)
src/proxy.ts              CSP nonce + optimistic auth redirect
src/app/(auth)/login      sign-in
src/app/(admin)/…         dashboard, employees, cards, departments, positions, templates,
                          verification, audit, settings, account (all server-protected)
src/app/print/cards/[id]  print surface (no dashboard chrome)
src/app/verify/[token]    public verification page + token-gated photo
src/app/api/…             authenticated photo and export routes
src/components/           ui/ (primitives), admin/, employees/, cards/
src/lib/auth              sessions, passwords
src/lib/cards             renderer, templates, status, tokens, text fitting, exports
src/lib/db                schema, client, error helpers
src/lib/storage           photo storage adapters (Supabase private bucket, local disk)
src/lib/env.ts            server-only config + deployment interlock
src/lib/services          domain logic (employees, cards, verification, import, dashboard…)
src/lib/validation        Zod schemas
tests/                    Vitest suites
```

## Git

This `id-system` folder is the Git repository root. Secrets, local databases (`.data/`), uploaded photos (`storage/`), exports and logs are excluded by `.gitignore`; only `.env.example` is committed.

```bash
git add -A
git status            # review: no .env.local, .data/, storage/ or *.pdf
git commit -m "FXT ID card system"
git branch -M main
git remote add origin <your GitHub repository URL>
git push -u origin main
```
