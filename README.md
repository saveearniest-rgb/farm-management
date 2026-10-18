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
- Worker records, hours, recent pay summary, expenses, basic stock and suppliers/lots
- Optional national farmer ID and subsidised-input receipts, with an owner-visible audit log
- Crop plans, scenario assumptions, harvest/sales actuals, plan-vs-actual calculations, CSV spreadsheet export and browser print-to-PDF
- Installable PWA metadata and local IndexedDB queueing for field notes

The offline queue is for field notes only; other forms require a connection. Files are not yet uploaded to object storage. SMS/WhatsApp, weather feeds, investor agreements, in-app signing and subscription billing are future work. Generated legal templates are not available for signing in the app.

## Data and privacy notes

- Farm records are queried by `farmId`; investors and agreements are not enabled in V1.
- Farm-owned reads and writes use a tenant-scoped Prisma data layer that takes the active farm from the authenticated membership. Mutations create metadata-only audit entries.
- Passwords are stored as bcrypt hashes and authentication/session cookies are handled by Auth.js. The optional selected-workspace cookie is checked against the authenticated user's memberships.
- Manager-facing dashboard data omits financial values. Review role boundaries before adding new actions or data fields.
- Optional anonymised-benchmark consent is recorded, but benchmark sharing is not currently used to publish or derive reference data.
- Data exports are farm-owner-scoped JSON snapshots of farm records and audit metadata. Deletion is recorded as a review request and does not immediately delete data.
- Configure regular PostgreSQL backups and production-grade secrets, TLS, monitoring and file storage before deploying real farm data.

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
4. Add or update care tasks and record daily work. Field notes can be saved offline; other records currently need a connection.
5. Add observed rainfall/temperature, scouting findings or spray records. When a cycle has a known expected harvest date, a recorded pre-harvest interval is checked against it.
6. Record workers, hours, expenses, stock usage, harvests and sales, then review the cycle report and export or print it.
