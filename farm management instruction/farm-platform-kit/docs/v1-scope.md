# Version 1 scope

Version 1 is a working crop-farm tracker for one farm, built to be multi-tenant underneath. It ships in two releases, 1a and 1b. Agreements and investors come in version 2, and the animal farming division comes after 1b in three steps (A1 to A3). Each depends on crop cycles, costs and harvests being reliable first.

The full detail of every area is in `docs/spec.md`. Where the spec sections on the crop SOP, harvest and produce lots, business, assets and pesticides disagree with the older module table, the newer sections win.

## Version 1a: daily operations

| Area | What to build |
| --- | --- |
| Accounts | Login, farm workspaces, roles `OWNER` and `MANAGER`, English and Swahili. Farm has a division switch (crops on, animals off in 1a) |
| Land and plots | Owned or rented holdings, cost or rent, period, owner; tenure type, document status, renewal date, dispute log; plots with area, soil type, water source, GPS point |
| Crop types and Crop SOP | Crop types with mode (nursery or direct). The SOP replaces separate stage and care templates: site, planting requirements, spacing (plants per acre calculated), gap filling, nutrition, water, pests, care, harvest, post-harvest, records, expected performance. Versioned, each cycle records the SOP version. Every value labelled with its source |
| Crop cycles | Crop, variety, plot, area planted, planned and actual dates, status, SOP version, expected and actual yield |
| Nursery | Seed lots (supplier and lot number), sowing, germination and survival checks with condition notes and photos, transplants, losses with reason |
| Daily work | Tasks generated from the SOP schedule, done / skipped / delayed with note and photo, in-app reminders, daily activity log |
| Scouting and weather | Pest and disease scouting log; rain gauge and temperature entries per plot |
| Pesticides | Product register (copied from the label), application record (farm, plot or cycle target, product batch, dose, date), pre-harvest and re-entry interval checks, repeated active ingredient flag, stock deduction |
| Labour | Casual workers as names with hourly rates, work entries, weekly pay summary, paid or unpaid, payment method (mobile money, bank, cash) with reference number. Entered by the owner or manager |
| Expenses and stock | One expenses ledger: crop cost allocated to cycles (splittable) or overhead; items and stock movements with supplier and lot |
| Assets | Asset register, usage log, maintenance log, running cost allocated to cycles. Replaces the old machinery module |
| Documents | Upload and tag files (leases, receipts, photos). No document generation yet |
| Reports | Daily summary, cycle cost breakdown, labour report, nursery survival report, pesticide history by plot and cycle |
| Offline and privacy | Installable PWA with offline entry and sync, consent ledger, data export, data deletion, optional national farmer ID field |

## Version 1b: harvest, simple sales, plan vs actual

| Area | What to build |
| --- | --- |
| Harvest | Expected harvest (forecast by week, kept as versions), harvest log (the single record of what was picked), harvest summary calculated from the log |
| Produce lots | Each harvest entry adds to a lot; lots track harvested, sold, lost and in stock; lots show the pesticide applications of their cycle and whether the interval has cleared |
| Simple sales | Customer name, delivery from a lot, quantity, price, payment. No orders against forecast and no invoices yet |
| Economics | Plan from a crop template (the bell pepper model first), saved scenarios, plan document in the same layout as `fixtures/bell_pepper_1acre_model_tzs.xlsx` |
| Plan, forecast and actual | A report that reads the records: plan (frozen when the cycle is approved), forecast, actual, with variance and the main driver |

Plan vs actual is a report. Nobody types actuals into it.

## After 1b: animal farming division (steps A1 to A3, not yet built)

Specified in the spec under Animal farming. Do not build it until asked. Order: A1 register, groups, daily tracker, feed planner and stock, expense allocation to animals. A2 vaccination and health with withdrawal warnings, performance records. A3 genetics and breeding, income by product line, capital investments, dashboard and planning view.

## Not in version 1

- Investor accounts, agreements of any kind, repayment tracking, buyer obligation records
- Customer orders against forecast, invoices, receipts, receivables ageing (version 2)
- Asset depreciation allocation, traceability reports by produce lot and product batch (version 2)
- Advisor role, farmer groups and cooperatives
- SMS, WhatsApp or USSD, live weather feeds, satellite data
- Generated legal documents, in-app signing, e-signature
- Labour planner, SMS call-outs, wage benchmarks
- Outbreak alerts between farms, market price network, group selling
- Billing, subscriptions, pricing tiers
- Mobile money or bank integrations (payment methods are only recorded as text and a reference)
- Everything in the animal farming division

If a task seems to need anything on this list, stop and ask.
