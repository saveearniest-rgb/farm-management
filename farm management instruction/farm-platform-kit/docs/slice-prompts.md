# Slice prompts

Slices 1 to 6 and 9 make up version 1a; slices 7 and 8 make up version 1b. Build in this order: 1 to 6, then 7 and 8, then 9. (Offline hardening comes last so it covers every entry screen.) Animal farming is not part of these slices; see the end of this file.

Give the agent one slice at a time, in order. Paste the prompt, let the agent write its plan, approve or correct the plan, then let it build. After each slice, click through the demo yourself before starting the next.

Every slice follows the rules in `CLAUDE.md`.

## Kickoff (use once, before slice 1)

```
Read CLAUDE.md, docs/v1-scope.md, docs/decisions.md and prisma/schema.prisma.
Do not write any code yet. Reply with:
1. Your understanding of the product in five sentences.
2. The project structure you propose.
3. The tooling you will set up, with the commands for dev, test, lint, typecheck, migrate and seed.
4. Any contradictions, gaps or risks you see in the documents.
5. Questions you need answered before starting.
Wait for my approval.
```

## Slice 1: Setup, login, farm workspaces

```
Build slice 1 from docs/slice-prompts.md. First write a plan and wait for approval.

Goal: a running app where a user can sign up, create a farm, and switch language.

Build:
- Project scaffold with the stack in CLAUDE.md, Prisma connected to PostgreSQL, a docker-compose file for local Postgres.
- Login and sign-up with Auth.js (email or phone number plus password).
- Create a farm (name, region, district, currency TZS or USD, area unit, timezone). The creator becomes OWNER.
- OWNER can add a MANAGER by invite code or link.
- The tenant-scoped data layer described in CLAUDE.md rule 1. Every later slice must use it.
- An audit log writer used by the data layer.
- Mobile-first app shell with navigation, and an English/Swahili language switch with both message files.
- Seed script with one demo farm and two users.

Acceptance:
- A test proves user A in farm A cannot read or change anything in farm B.
- Typecheck, lint and tests pass; the app starts from a clean clone using the README.
- Demo steps are written in the README: sign up, create farm, invite manager, switch language.
Out of scope: everything else in docs/v1-scope.md.
```

## Slice 2: Land and plots

```
Build slice 2. First write a plan and wait for approval.

Goal: record land holdings and plots.

Build:
- Land holdings: owned or rented, purchase price or rent, rent period, start and end dates, owner name, notes.
- Tenure fields on a holding: type (title, customary certificate, lease, informal, other), document status, renewal date. A tenure dispute log (date, description, status).
- Plots belong to a holding: name, area with unit, soil type, water source, GPS point, notes. Archive instead of delete.
- File attachments on holdings and plots (lease papers, photos) using a storage adapter with local disk now and an S3-compatible option later.
- List and detail screens, mobile first, English and Swahili.
- A lease or tenure renewal reminder shown on the dashboard when a date is within 60 days.

Acceptance:
- All records scoped by farm; tests cover the tenant rule for these tables.
- Seed data includes one owned and one rented holding with two plots.
- Demo steps in the README.
```

## Slice 3: Crop types, Crop SOP, crop cycles

```
Build slice 3. First write a plan and wait for approval.

Goal: define crops and run crop cycles for both nursery and direct-sown crops.

Build:
- Crop types: name (en and sw), mode (NURSERY or DIRECT), default cycle length, default plants per acre, expected yield per plant and unit, source label (BENCHMARK, LOCAL_QUOTE, FARM_ACTUAL), source date and note.
- The Crop SOP per crop type, as described in the Crop SOP section of docs/spec.md: site and climate, planting requirements, spacing, gap filling, nutrition, water, pests, crop care, harvest, post-harvest, records required, expected performance. The schedule part holds ordered stages with expected days and care tasks (task type, repeat interval, start offset, linked stage). SOPs are versioned, farms copy and adapt a platform SOP, and a field shows whether an agronomist reviewed it.
- Plants per acre are calculated from row spacing, plant spacing and usable area share (4046.86 x usable share / (row spacing x plant spacing)), never typed.
- Platform-level defaults (farmId null) that farms can copy and edit. Seed only one default: bell pepper, taken from fixtures/bell_pepper_1acre_model_tzs.xlsx and labelled BENCHMARK with the note "placeholder, verify". Do not invent other crops or numbers.
- Crop cycles: plot, crop type, variety, area planted, SOP version followed, planned start, actual start, status that follows the SOP stages, expected and actual harvest dates.
- A timeline view of a cycle showing stages and expected dates from the template.

Acceptance:
- A nursery crop shows the nursery stages; a direct-sown crop does not.
- Every reference value on screen shows its source label.
- Tests for stage date calculation, the plants per acre formula and tenant scoping. A mobile-friendly SOP page readable in the field.
- Demo steps in the README.
```

## Slice 4: Nursery

```
Build slice 4. First write a plan and wait for approval.

Goal: track nursery batches from seed to transplant.

Build:
- Suppliers and input lots (seed lots first): supplier, lot number, purchase date, quantity, cost.
- Nursery batches for nursery-mode cycles: seed lot, sow date, quantity sown, location.
- Nursery checks: date, germinated, surviving, condition notes, photos.
- Transplants: date, quantity moved, quantity discarded, reason.
- Survival rate per batch, per seed lot and per supplier, shown on screen.
- Offline entry for nursery checks.

Acceptance:
- Survival rate matches hand calculation in tests.
- Checks entered offline sync correctly when signal returns.
- Demo steps in the README.
```

## Slice 5: Daily work, scouting, weather

```
Build slice 5. First write a plan and wait for approval.

Goal: a daily task list and the daily records a farmer needs.

Build:
- Tasks generated from care templates when a cycle is created or changes stage. A Today screen with done, skipped or delayed, a note and a photo.
- In-app reminders for due and overdue tasks (no SMS in version 1).
- Daily activity log: free text, weather note, photos.
- Weather log: rain gauge and temperature entries per plot.
- Pest and disease scouting log: pest or disease, severity, photos, plot and cycle.
- Pesticides: a product register copied from the label (active ingredient, dose rate, pre-harvest interval, re-entry interval, stock). Application records with target farm, plot or cycle, product batch, dose, date and who applied. Checks: dose above label rate, repeated active ingredient on one cycle, re-entry interval marks the plot as not to be entered, quantity deducted from stock. Store a computed harvest hold date per cycle. The warning for a harvest or sale inside the interval is wired up in slice 7.
- All of these work offline.

Acceptance:
- Changing a cycle's stage regenerates only the future tasks, and never touches tasks already done.
- Tests for task generation and the pre-harvest and re-entry date calculations.
- Demo steps in the README.
```

## Slice 6: Labour, expenses, stock, reports

```
Build slice 6. First write a plan and wait for approval.

Goal: record every cost against a cycle and report on it.

Build:
- Workers: name, phone, default hourly rate. No logins.
- Work entries: worker, cycle or plot, task, start and end time, rate, amount. Entered by owner or manager, offline capable.
- Weekly pay summary with paid or unpaid, payment method (mobile money, bank, cash) and a reference number.
- One expenses ledger: category, amount, date, and either allocation to one or more cycles or plots (splits must add up to the total) or marked as overhead (farm level, not in any cycle). Design the allocation target as a type plus id so animals, groups and product lines can be added later without changing the table.
- Assets: register (type, purchase date and cost, expected life, status), usage log (asset, date, hours or distance, cycle, operator, fuel), maintenance log with next service due. Running cost is allocated to cycles. This replaces the old machinery module.
- Items and stock movements (purchase, usage linked to a task and cycle, adjustment) with supplier and lot. Low-stock flag.
- Reports: daily summary, cycle cost breakdown (crop cost only), overhead report, labour report, nursery survival report, asset cost report, pesticide history by plot and cycle. Export to CSV and PDF.

Acceptance:
- Cost per cycle equals the sum of its labour, expenses and stock usage in tests.
- Split allocations that do not sum are rejected.
- Demo steps in the README.
```

## Slice 7: Harvest, produce lots, simple sales

```
Build slice 7. Read the Harvest and produce lots section and the Business section of docs/spec.md first. Write a plan and wait for approval.

Goal: record what was picked, keep it in lots, and record simple sales.

Build:
- Harvest log: the single record of what was picked (date, cycle and plot, quantity and unit, grade, picking team and hours, condition, weather, notes, photos). Offline capable. Harvest totals by cycle, crop, week and grade are calculated from the log, never typed.
- Expected harvest: a forecast of quantity by week per cycle, kept as dated versions so earlier forecasts stay visible. It starts from the cycle's expected yield and can be revised.
- Produce lots: each harvest entry adds to a lot with a readable code (for example BP-2026-10-20-A). A lot tracks harvested, sold, lost (with stage and reason) and in stock.
- Pre-harvest interval warning: a harvest entry or sale inside the interval from slice 5 shows a warning, and the lot shows the pesticide applications of its cycle.
- Simple sales: customer name, delivery from a lot, quantity, price, payment (method and reference). No orders against forecast and no invoices.
- Reports: harvest log by cycle, lot stock, sales by crop and customer, profit per cycle (sales minus crop cost).

Acceptance:
- Lot quantities always equal harvested minus sold minus lost, in tests.
- A sale cannot exceed lot stock.
- Tests for the interval warning and tenant scoping.
- Demo steps in the README.
```

## Slice 8: Plan, forecast and actual

```
Build slice 8. Read the Plan, forecast and actual section of docs/spec.md and docs/plan-vs-actual.md first. Write a plan and wait for approval.

Goal: generate a plan like the bell pepper workbook, then compare it with forecast and recorded actuals.

Build:
- A plan model holding the assumptions in docs/plan-vs-actual.md, with a source label on each, created from a crop type SOP for a chosen area and region. The plan is frozen when the cycle is approved.
- The calculation engine for the formulas and monthly timing in the document, with an editable harvest curve.
- Scenarios: base, low price, low yield, all editable.
- Plan document generation: a spreadsheet with the same three sheets as the fixture, using live formulas, and a PDF summary.
- The plan, forecast and actual report. It only reads existing records (labour, expenses, harvest log, sales) and the latest forecast. Nobody types actuals into it. It shows variance and the main driver of the profit difference.

Acceptance:
- A test feeds the fixture assumptions into the engine and matches every expected output in docs/plan-vs-actual.md to the cent.
- The generated spreadsheet recalculates correctly when an input is changed.
- Demo steps in the README.
```

## Slice 9: Offline hardening and privacy

```
Build slice 9. First write a plan and wait for approval.

Goal: make field use reliable and meet the privacy rules.

Build:
- PWA install, offline queue review, conflict handling for shared records (never silent overwrite), sync status shown to the user.
- Consent ledger: a record of what data a person agreed to share, with whom, and until when. Only the data model and screens; no sharing yet.
- Data export: a farm owner can download all farm data as CSV and JSON.
- Data deletion: owner can request deletion of the farm or of a person's data, with documented retention rules for the audit log.
- Optional national farmer ID field on the farm, and a record of subsidised inputs received.
- Owner view of the audit log.
- A docs/operations.md with hosting options, backups, and the environment variables needed.

Acceptance:
- Include the new entry screens (harvest log, pesticide applications, asset usage) in the offline queue.
- End-to-end test: create entries offline, reconnect, and verify nothing is lost or duplicated.
- Export contains every farm-owned table.
- Demo steps in the README.
```

## Animal farming (not part of version 1)

The animal division is specified in docs/spec.md under Animal farming. Do not start it until the founder asks. When asked, build it in three steps: A1 register, groups, daily tracker, feed planner and stock, expense allocation to animals and groups; A2 vaccination and health with withdrawal warnings, performance records; A3 genetics and breeding, income by product line, capital investments, dashboard and planning view. Use the same rules as every other slice: plan first, one step at a time, tenant scoping, offline entry, source labels on every reference value, and no vaccination schedule shipped as a fact.
