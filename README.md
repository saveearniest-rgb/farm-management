# Shamba

Shamba is a farm-operations tracker for crop cycles, land, nursery work, daily tasks, labour, costs, stock and crop economics. It is being built mobile-first for Tanzanian farms, with English and Kiswahili support.

The crop cycle is the cost and yield backbone. Reference prices, yields and weather are not pre-filled: assumptions entered by a farm are clearly marked as placeholders until verified. Investment agreements and payment processing are not part of this V1 application.

## Requirements

- Node.js 20.9 or newer
- npm
- PostgreSQL 14 or newer

## Local setup

1. Install packages:

   ```bash
   npm install
   ```

2. Create a PostgreSQL database, then copy `.env.example` to `.env` and set `DATABASE_URL` to your local PostgreSQL connection string.

   To use the included local database, start Docker Desktop and run:

   ```bash
   docker compose up -d postgres
   ```

   Generate an `AUTH_SECRET` for local use (PowerShell):

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Replace the example value in `.env`. The compose database credentials are for local development only.

3. Generate the Prisma client and create the database tables:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. Optionally create the demo owner and manager accounts. Set their passwords in your shell first; each must be at least 10 characters:

   ```powershell
   $env:DEMO_OWNER_PASSWORD = "replace-with-a-local-password"
   $env:DEMO_MANAGER_PASSWORD = "replace-with-another-local-password"
   npm run db:seed
   ```

   The demo seed creates one farm and two users, but does not add crop prices, yields, or weather assumptions.

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000), create an account and a farm workspace, then add a land holding, plot, crop type and crop cycle.

The first account registered for a farm becomes its owner. A farm owner can create a seven-day manager invitation link from **Farm settings**. The invitee must sign in or create an account with the invited email address, then accept the link. Manager permissions are checked in server actions; managers cannot change financial or farm configuration.

### Sign in, demo accounts, and restarting locally

- **Create your own account:** On the sign-in screen, choose **Create account**, enter your name, email, password (at least 10 characters), farm name, and optionally the farm size in acres or hectares. Account creation signs you in and opens the new farm workspace.
- **Local demo logins:** If the demo seed was run with the example local passwords, use `owner@example.test` / `DemoFarm!2026Local` or `manager@example.test` / `DemoManager!2026Local`. These are development-only credentials. The seed script uses the passwords supplied through `DEMO_OWNER_PASSWORD` and `DEMO_MANAGER_PASSWORD`; if they were set differently, use those values or create your own account.
- **Start or reopen the app:** Open PowerShell in the repository, start PostgreSQL with `docker compose up -d postgres`, then run `npm run dev` and visit `http://localhost:3000`. Keep that terminal open while using the app. After stopping it with `Ctrl+C` or closing the terminal, run the same commands again. Farm data remains in the PostgreSQL Docker volume.
- **Expired sign-in:** Auth.js sessions last up to 30 days. If redirected to sign-in, enter your email and password again; you do not need to recreate the farm. Keep the same `AUTH_SECRET` in `.env` between starts, because changing it invalidates existing sessions. If the password is unknown, create a separate account or reset the demo user's password by reseeding with new local demo-password environment values.
- **Appearance:** Use the moon/sun button to switch between light mode and the foliage-green dark mode. The preference is saved in this browser.

The Crop cycles section includes farm-owned disease and pesticide reference entries. Add them manually or download the CSV template, edit it in Excel, save it as UTF-8 CSV, then import it for a selected crop. The template contains no prefilled agricultural guidance; only add information verified for your farm.

### Animal farming A1 walkthrough

1. As the farm owner, open **Farm settings**, enable **Animal farming**, and save. Use the **Crop farming / Animal farming** switch in the left navigation to open the animal workspace.
2. Register a group with its starting head count, and register individually tagged animals where the farm uses tags.
3. Record group births, purchases, deaths, sales or culls; the current group count is calculated from the starting count and event history.
4. In **Inputs & stock**, create a stock item with category **FEED**, then record an actual priced purchase. No feed items or nutrient assumptions are seeded.
5. In **Animal farming**, set a feed ration per head per day for a group. The feed planner compares that farm-entered ration with current FEED stock; it is not a nutrition recommendation.
6. Record a daily feeding entry against an animal or group. It saves offline when disconnected and, on sync, reduces the shared feed stock. Water, milk, egg and health-check notes can also be recorded; health checks are records only and are not diagnoses.
7. In **Labour & costs**, select a group or tagged animal to allocate an expense directly. Purchase prices and seller details are retained on the animal/event record; enter expenses separately when they should be included in the cost ledger.

### Animal farming A2 walkthrough

1. In **Inputs & stock**, add any veterinary medicine stock item and record an actual priced purchase. Register the farm's own vaccine/medicine batches, optionally linking each product to its stock item. No products or veterinary guidance are preloaded.
2. Create vaccination schedules using the farm vet's verified dates or age intervals. Age-based reminders require birth dates; group schedules require a first due date.
3. Record health cases, treatments or vaccinations against an animal or group. Enter the amount used for a linked product; the health record and stock deduction are saved together, with cost calculated from recorded purchases. Health cases and health records can be queued offline and sync when connected.
4. Review open cases, active withdrawal periods, and milk/egg records collected inside a withdrawal period. Sales warnings will be connected when livestock sales are implemented.
5. Record individual or group weights, milk and eggs. The app calculates daily weight gain only when comparable individual weights use one consistent unit. Birth and weaning continue to be recorded as animal events.

Animal reference assumptions and veterinary schedules are not preloaded. Confirm health, vaccination, feed and legal guidance with the farm's livestock professional or relevant local authority. Shamba records information and flags dates; it does not diagnose, prescribe, or replace a vet.

### Animal farming A3: genetics and breeding

1. Register species gestation days only when the farm has a source to record; enter the source label, date and note. No gestation values are preloaded.
2. Register breeds and their production purpose. Add benchmark traits only with a source label, date and note; benchmarks are displayed as references, not promises.
3. Link a tagged animal to a registered breed and, when known, its dam and sire. When the offspring came from a recorded mating, link that breeding record too. Record birth weight, colour, horn status, temperament or conformation observations; trait entries can queue offline.
4. Record natural service or artificial insemination against a tagged dam. A sire or semen batch is required; any expected birth date uses only the farm-entered species gestation period.
5. Add pregnancy-check and birth outcomes to the breeding record. The system warns when known pedigrees show close relatives; consult a livestock professional when reviewing breeding decisions.

This first A3 increment covers breed/species references, pedigree, traits and breeding records. Product-line income, capital investment tracking, and the animal dashboard/planning view are still pending. Shamba records information and does not provide genetics, veterinary or breeding recommendations.

Uploaded JPEG, PNG, WebP and PDF files are stored privately and encrypted on local disk. The encryption key is derived from `AUTH_SECRET`, so keep that secret stable and configure persistent storage; see [docs/operations.md](./docs/operations.md).

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the local development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve a production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests for crop economics calculations and exports |
| `npm run test:integration` | Run the farm-tenant isolation test against `TEST_DATABASE_URL` |
| `npm run db:seed` | Create the development demo farm and owner/manager accounts |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate -- --name <name>` | Create/apply a local development migration |
| `npm run db:studio` | Open Prisma Studio |

## Current V1 scope

- Farm accounts, workspaces, owner/manager roles, English and Kiswahili
- Land holdings, plots, tenure disputes, archive controls and renewal alerts
- Nursery/direct-sown crop types, stage and care templates, crop cycles
- Nursery batches, checks, transplants, tasks, reminders and activity notes
- Weather observations, pest/disease scouting, spray records and pre-harvest interval warnings
- Worker records, hours, recent pay summary, split expenses, an asset register with usage and maintenance costs, and basic stock and suppliers/lots
- Animal farming A1: tagged animal and group registers, event timelines with calculated group counts, daily animal records, farm-entered feed rations, feed planning against the shared stock ledger, and expense allocations to animals or groups
- Animal farming A2: farm-managed vaccine/medicine batches and vaccination schedules, health cases and treatment records, atomic veterinary stock deductions with cost from recorded purchases, withdrawal-period and collection warnings, and offline-capable weight, milk and egg records
- Animal farming A3 (first increment): farm-sourced breed and gestation references, pedigree links, offline trait and breeding records, projected birth dates from configured gestation periods, pregnancy/birth outcomes, and close-relative warnings
- Farm size stored separately from the default plot area unit; crop-specific disease and pesticide catalog with manual entry and Excel-compatible CSV import
- Optional national farmer ID and subsidised-input receipts, with an owner-visible audit log
- Crop plans with editable expected, low-price and low-yield scenarios; harvest/sales actuals; plan-vs-actual reports with a profit-variance driver; formula-driven Excel workbook, CSV and browser print-to-PDF exports; farm JSON/CSV export
- Installable PWA metadata and local IndexedDB queueing for field notes, task updates, nursery checks, labour, expenses, weather, scouting, spray, and animal daily, health and performance records

Supported offline form entries sync when signal returns; file uploads require a connection. Attachments use private local disk, not object storage. Crop-plan cost lines for harvest, packaging and transport are entered per yield unit; other cost lines are total costs. Saving an expected plan initializes low-price (30% lower price) and low-yield (40% lower yield) scenarios when they do not already exist. All plan assumptions are placeholders until the farm verifies them. SMS/WhatsApp, weather feeds, investor agreements, in-app signing and subscription billing are future work. Generated legal templates are not available for signing in the app.

## Data and privacy notes

- Farm records are queried by `farmId`; investors and agreements are not enabled in V1.
- Farm-owned reads and writes use a tenant-scoped Prisma data layer that takes the active farm from the authenticated membership. Mutations create metadata-only audit entries.
- Passwords are stored as bcrypt hashes and authentication/session cookies are handled by Auth.js. The optional selected-workspace cookie is checked against the authenticated user's memberships.
- Manager-facing dashboard data omits financial values. Review role boundaries before adding new actions or data fields.
- Optional anonymised-benchmark consent is recorded, but benchmark sharing is not currently used to publish or derive reference data.
- Data exports are farm-owner-scoped JSON or CSV snapshots of farm records and audit metadata. Deletion is recorded as a review request and does not immediately delete data; see [docs/operations.md](./docs/operations.md) for retention and recovery rules.
- Configure regular PostgreSQL and attachment backups, production-grade secrets, TLS, monitoring and persistent file storage before deploying real farm data.

## Slice 1 demo and test notes

1. Sign up with an email and a password of at least 10 characters; confirm a farm workspace is created.
2. Change the interface language in the header and confirm the choice persists after refresh.
3. As owner, create a manager invitation using the manager's email.
4. Open the link in a second browser session, register or sign in using that exact email, and accept the invitation.
5. Confirm the manager can switch to the shared workspace but cannot edit owner-only settings.
6. Run `npm test` for unit tests. To execute the database tenant-isolation test, point `TEST_DATABASE_URL` at a disposable PostgreSQL database with the Prisma schema applied, then run `npm run test:integration`. The test is skipped when that dedicated variable is not set; never point it at production data.

## Field workflow walkthrough

Use a clearly labelled test farm and test records for a pretend cycle; do not treat demo values as agricultural guidance.

1. Add an owned or rented holding, then add a plot with its area unit, soil, water source and tenure details.
2. Create a nursery or direct-sown crop type. Leave yield, spacing and cycle assumptions blank unless you have verified farm-specific figures.
3. Start a crop cycle on the plot. For nursery crops, record a seed batch, survival check and transplant count.
4. Add or update care tasks and record daily work. Supported forms queue offline and sync when signal returns; check the sync status before closing the browser.
5. Add observed rainfall/temperature, scouting findings or spray records. When a cycle has a known expected harvest date, a recorded pre-harvest interval is checked against it.
6. Record workers and hours, split expenses, register assets and log their cycle-linked usage or maintenance, record stock usage, harvests and sales, then review the cycle report and export or print it. Asset running costs are fuel and maintenance records; purchase cost is not depreciated into cycle costs.
7. Upload a document or photo while online, create an export request in Farm settings, then download JSON or CSV. Exports include attachment metadata, not the files themselves.
8. In Cycle economics, save an expected plan with verified values and cost lines. Review the generated downside cases, edit the monthly harvest shares in the Excel workbook if needed, and compare the plan with recorded results.
