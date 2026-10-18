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

3. Generate the Prisma client and create the database tables:

   ```bash
   npm run db:generate
   npm run db:migrate -- --name init
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000), create an account and a farm workspace, then add a land holding, plot, crop type and crop cycle.

The first account registered for a farm becomes its owner. A farm owner can add an existing Shamba account as a manager from **Farm settings**. Manager permissions are checked in server actions; managers cannot change financial or farm configuration.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the local development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve a production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests for crop economics calculations and exports |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate -- --name <name>` | Create/apply a local development migration |
| `npm run db:studio` | Open Prisma Studio |

## Current V1 scope

- Farm accounts, workspaces, owner/manager roles, English and Kiswahili
- Land holdings, plots and tenure records
- Nursery/direct-sown crop types, stage and care templates, crop cycles
- Nursery batches, checks, transplants, tasks, reminders and activity notes
- Worker records, hours, expenses, basic stock and suppliers/lots
- Crop plans, scenario assumptions, harvest/sales actuals, plan-vs-actual calculations, CSV spreadsheet export and browser print-to-PDF
- Installable PWA metadata and local IndexedDB queueing for field notes

The offline queue is for field notes only; other forms require a connection. Files are not yet uploaded to object storage. SMS/WhatsApp, weather feeds, investor agreements, in-app signing and subscription billing are future work. Generated legal templates are not available for signing in the app.

## Data and privacy notes

- Farm records are queried by `farmId`; investors and agreements are not enabled in V1.
- Passwords are stored as bcrypt hashes. Session tokens are random, HTTP-only cookies; only token digests are stored in PostgreSQL.
- Manager-facing dashboard data omits financial values. Review role boundaries before adding new actions or data fields.
- Optional anonymised-benchmark consent is recorded, but benchmark sharing is not currently used to publish or derive reference data.
- Data exports are farm-owner-scoped JSON. Deletion is recorded as a review request and does not immediately delete data.
- Configure regular PostgreSQL backups and production-grade secrets, TLS, monitoring and file storage before deploying real farm data.
