# Farm Management & Investment Platform

A multi-tenant web app for running a farm: land and plots, crop cycles (with an optional nursery stage and a crop SOP), daily tasks and reminders, labour, one expenses ledger, assets, pesticide records, harvest and produce lots, simple sales, and plan, forecast and actual economics. It ships as version 1a (daily operations) then 1b (harvest, sales, plan vs actual). Later versions add investor and contract-farming agreements and an animal farming division. The first user is the founder's own farm in Tanzania. It will later be sold to other farms.

- Full product spec: `docs/spec.md`. This is reference only. Read the section you need, not the whole file.
- What to build now: `docs/v1-scope.md`.
- Decisions already made: `docs/decisions.md`. Do not reopen them.
- How to work through the build: `docs/slice-prompts.md`.
- Database starting point: `prisma/schema.prisma`.
- Test data for the economics model: `docs/plan-vs-actual.md` and `fixtures/`.

## Stack

- Next.js (App Router), TypeScript in strict mode
- PostgreSQL with Prisma. Current Prisma keeps the connection URL in `prisma.config.ts`, not in the schema file. `prisma.config.example.ts` shows the shape; check it against the docs for the installed version.
- Tailwind and shadcn/ui, Zod for validation, next-intl for translations (English `en`, Swahili `sw`)
- Installable PWA with a service worker, and Dexie (IndexedDB) for the offline queue
- Auth.js for login. Do not write your own password or session handling.
- Vitest for unit and integration tests, Playwright for end-to-end tests

Do not swap any of these without asking. Write any stack choice you make in `docs/decisions.md`.

## Rules that must never be broken

1. **Tenancy.** Every farm-owned table has `farmId`. All reads and writes go through one tenant-scoped data layer that takes `farmId` from the session. A test must prove that a user in farm A cannot read or change farm B's records.
2. **Money and quantities.** Money is `Decimal` with a currency code (default `TZS`, switchable to `USD` per farm). Never use floats. Quantities are `Decimal` with a unit. Areas store their unit (acre by default).
3. **Cost attribution.** Labour, expenses, stock usage and asset usage reference a `cycleId` wherever they apply, so cost per crop cycle is always a simple sum. Costs that belong to no cycle are marked overhead. Allocation targets are a type plus an id, so animal groups and product lines can be added later.
4. **Offline first.** Field entry screens (daily log, tasks, labour hours, expenses, nursery checks, scouting) must work without signal, queue locally, and sync later. Never silently overwrite a shared record on conflict.
5. **Translations.** Every visible string goes through next-intl, with `en` and `sw` files. No hard-coded text in components.
6. **Soft delete and audit.** Archive instead of deleting. Write an audit log entry for changes to money, access, consents and documents.
7. **Data provenance.** Reference data (prices, yields, weather, crop defaults) carries a source label, `BENCHMARK`, `LOCAL_QUOTE` or `FARM_ACTUAL`, plus a date and a source note. Never present an invented number as a fact. Seed placeholders must be labelled `BENCHMARK` with the note "placeholder, verify".
8. **Personal data.** Tanzania's Personal Data Protection Act applies. Collect the minimum, do not store ID numbers or ID images unless the spec says so, and add no third-party analytics.
9. **Version 1 roles.** Only `OWNER` and `MANAGER`. No worker logins. Do not build investor accounts, agreements, advisors, farmer groups, customer orders, invoices, SMS, or in-app signing yet. See `docs/v1-scope.md`.
10. **No financial services.** The platform never lends, holds, or moves money. It only records.
11. **Secrets** live in environment variables and are never committed.
12. **Record once.** A fact is entered in one place. Harvest totals, plan vs actual and lot stock are calculated from records, never typed. Plan vs actual is a report.
13. **No animal code yet.** The animal farming division is specified in the spec but is not built until asked. Do not add animal tables or screens early.

## How to work

- Read the relevant slice in `docs/slice-prompts.md` first. Write a short plan with your assumptions, then wait for approval before coding.
- Work on one slice at a time, on its own branch, with small commits.
- Before saying a slice is done: typecheck, lint and tests pass, the app runs, seed data loads, and the demo steps are written down so a non-developer can click through them.
- If the spec is ambiguous or contradicts itself, ask. Do not guess. Record the answer in `docs/decisions.md`.
- Keep the interface simple, mobile first, with large touch targets and low data use. Assume basic phones and weak signal.

## Commands

Fill this section in as you set the project up: install, dev server, test, lint, typecheck, migrate, seed.
