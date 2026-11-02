# Decisions already made

Do not reopen these without asking. Add new decisions at the bottom with the date.

| Topic | Decision |
| --- | --- |
| Product shape | Standalone web app, installable as a PWA, multi-tenant from day one. Not built on ERPNext |
| Stack | Next.js, TypeScript, PostgreSQL, Prisma (see `CLAUDE.md`) |
| Currency | TZS is the default, switchable to USD per farm |
| Payment methods | Mobile money, bank and cash are recorded with a reference number. Only recorded, never processed |
| Worker logins | None. The owner or a manager logs work and hours. Workers are names with rates |
| Nursery | An optional stage of a crop cycle. Nursery crops and direct-sown crops share one engine |
| Documents | Version 1 stores uploads only. Later, documents are generated from system data, approved once as templates by a lawyer, signed on paper or as the lawyer advises, then the signed copy is uploaded. No in-app signing in version 1 |
| Region and first crop | Not fixed. Each farm sets its own region, crops, calendar, units and price source. The first real farm drives the first crop templates. Bell pepper is the first template because the founder has a model for it |
| Lending | A lawyer confirms interest, penalty and licensing rules before any loan agreement exists (version 2). The platform never lends or holds funds |
| Pricing (recommended, not final) | Subscription per farm in tiers, limited by acreage or crop cycles per season; unlimited workers; free tier for small farms; no percentage on deals. Not built in version 1 |
| Plan vs actual placement | A report that reads the plan, the forecast and the recorded actuals. It needs harvest records, so it ships in version 1b, not 1a |
| Release split | Version 1a is daily operations; version 1b adds harvest, produce lots, simple sales and plan vs actual. Customer orders and invoices are version 2 |
| Crop SOP | One versioned SOP per crop replaces separate stage and care templates. Plants per acre are calculated from spacing, never typed |
| Harvest | The harvest and the harvest log are one record. Expected harvest is a forecast. Summaries are calculated |
| Expenses | One ledger. Each entry is crop cost (allocated to cycles) or overhead. The business section reads it, nobody re-enters it |
| Assets | One asset register with usage and maintenance logs replaces the machinery module |
| Pesticides | Application targets are farm, plot or cycle. Produce lots inherit the applications of their cycle. Product batch numbers are also recorded |
| Animal farming | A second division beside crops, sharing land, labour, expenses, stock, assets, sales and reports. Built after 1b in steps A1 to A3. Vaccination schedules and nutrient values are never shipped as facts; they are templates with a source label, placeholder until a vet confirms |
| Capital investments | Money the owner spends on land, buildings and technology. Separate from the investor and contract farming module |

## Log

(Add new decisions here: date, topic, decision, who decided.)
