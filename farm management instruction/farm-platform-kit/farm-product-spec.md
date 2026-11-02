# Farm Management & Investment Platform — Product Spec

Oct 18, 2026 · @yunzu

## Overview

This is a web platform where a farmer runs the farm day to day and an investor funds and monitors crop deals, both working from the same agreement records. It is built as a multi-tenant product to be sold later, with the first user being the founder's own farm.

**Users**

- Farmer or farm owner: plans crops, logs daily work, tracks costs, labour and harvest.
- Farm manager or supervisor: records daily activities and hours for the owner.
- Investor: funds crop cycles through loans, input advances or contract farming, and tracks repayment and returns.

**Goals**

1. Record every cost, hour and input against a plot and a crop cycle, so profit per crop is always known.
2. Turn care routines (watering, fertilizing, weeding, spraying) into a daily task list with reminders.
3. Support both nursery-based crops and direct-sown crops in one system.
4. Let investors and farmers share one confirmed record of each deal, including repayment in crop.
5. Store and generate the documents a farm and its deals need, in English and Swahili.

**Out of scope for now:** payment processing, marketplace for selling produce, IoT sensors, and satellite imagery.

## Design principles

- **The crop cycle is the backbone.** Labour, machinery, inputs, expenses, tasks and harvests all point to a crop cycle, so cost and profit per cycle are simple sums.
- **Nursery is an optional stage.** Each crop type has a stage template. Nursery crops run seed purchase, nursery, transplant, growing, harvest. Direct-sown crops run land preparation, sowing, growing, harvest. Care reminders attach to stages, so one engine serves both.
- **Log once, link everywhere.** An entry such as "weeding, Plot B, 4 workers, 5 hours" updates the daily log, labour cost and cycle cost together.
- **Mobile and offline first.** Field entries are saved on the phone and synced when signal returns. Photos and voice notes are supported.
- **Multi-tenant from day one.** Every record carries a farm id, and an investor sees a farm only through an agreement.
- **Units everywhere.** Quantities store their unit (kg, bags, litres, acres), because farmers mix units.
- **English and Swahili** in the interface and documents from the start.

## Farm operations modules

Thirteen modules cover the farm; the first eight make up the core of version 1. Harvest, sales, machinery and pesticide use are specified in more detail in the sections that follow, which take precedence. These modules describe the crop division; livestock is specified in the Animal farming section, which shares land, labour, expenses, stock, assets, sales and reports with them.

| Module | What it records | Main outputs |
| --- | --- | --- |
| Land and plots | Owned or rented land, purchase price or rent, lease period, owner, documents; plots with area, soil type, water source, GPS location, soil tests | Land cost per plot, lease expiry alerts |
| Crop cycles | Crop, variety, plot, area planted, planting date and time, status (planned, nursery, transplanted, growing, harvesting, closed), expected vs actual yield | Cycle timeline, cost and yield per cycle |
| Nursery | Seed lots bought (variety, supplier, quantity, cost), sowing date, germination and survival checks, condition notes and photos, transplant date and quantity, losses with reason | Survival rate, seed-to-field conversion |
| Daily care and reminders | Recurring tasks per crop and stage: watering, fertilizing, weeding, spraying, pruning, staking, thinning, scouting; done, skipped or delayed with photo and note | Daily task list, overdue tasks |
| Daily activity log | Free-text diary, weather, photos, who worked on what | Daily update and report |
| Labour | Casual workers, task, plot, start and end time, hourly rate, amount owed, paid status | Weekly pay summary, labour cost per task |
| Machinery | Moved to the Assets section below. Hired equipment stays an expense | Machinery cost per acre |
| Expenses | Category, amount, date, allocation to plot or cycle (splittable) | Cost breakdown by cycle |
| Inputs and stock | Seeds, fertilizer, chemicals, fuel; purchases, usage per task and plot, stock levels | Low-stock alerts, application history |
| Irrigation | Water source, pump hours, electricity or fuel cost | Water cost per cycle |
| Harvest and sales | Moved to the Harvest and Business sections below | Yield, revenue, receivables |
| Planning and budgets | Season plan, crop calendar, budget vs actual, rotation history | Next-season plan |
| Issues and learning | Pests and diseases with photos, treatment and outcome, lessons per cycle | Issue history per crop |

**Reports:** daily summary, weekly and monthly summary, cycle report, cost breakdown, labour report, nursery survival report, yield comparison across plots, season summary. A dashboard shows today's tasks, overdue tasks, stock alerts and cash position.

**Reminders** are generated from care templates (for example, weed every 14 days after transplant) and can be sent in the app and by SMS or WhatsApp. Weather-aware rules, such as skipping watering after rain, come in version 2.

## Plan, forecast and actual: how the sections fit

Each fact is recorded once, where it happens, and plan vs actual becomes a report that reads those records instead of a place to type data. The sections below on crop SOPs, harvest, business, assets and pesticides follow this rule.

| View | What it is | Where it lives | When it changes |
| --- | --- | --- | --- |
| Plan | Assumptions frozen when the cycle is approved, with scenarios | A plan attached to the crop cycle, built from the crop SOP and reference data | Only by a deliberate re-plan, which creates a new version |
| Forecast (expected harvest) | The current best estimate of harvest by week | Harvest section, under the crop cycle | Updated during the cycle from nursery survival, plant counts, scouting and weather |
| Actual | What happened | Harvest log, sales, expenses, labour, stock and pesticide records | With every entry |

The report compares plan, forecast and actual for each cycle, shows the variance, and names the driver. Customer orders are matched against the forecast, so the farm can see how much of the expected harvest is already promised.

**How the records connect**

1. The crop SOP and regional reference data produce a plan for a cycle: plants from spacing, costs, expected yield.
2. The cycle runs. Nursery counts and plant counts refine the forecast.
3. Pesticide applications and each product's pre-harvest interval set the earliest safe harvest and sale date.
4. Each entry in the harvest log adds to a produce lot.
5. Customer orders are promised against the forecast and delivered from produce lots as sales.
6. Payments settle orders. Expenses, labour and asset use flow to cycles and to the farm.
7. The plan, forecast and actual report reads all of the above.

**Recommended navigation, replacing the flat module list**

| Group | Contains |
| --- | --- |
| Farm | Land and plots, assets, workers |
| Crops | Crop SOPs, crop cycles, nursery |
| Daily work | Tasks, activity log, scouting, pesticide applications, weather |
| Inputs and stock | Items, input lots, stock movements |
| Harvest | Expected harvest, harvest log, produce lots, losses |
| Business | Customers, orders, sales, payments, expenses |
| Plan and reports | Plans, scenarios, plan vs forecast vs actual, reports |
| Investment | Agreements and investors (version 2) |

## Crop SOP (standard operating procedure)

A crop SOP is the written standard for growing one crop. It drives the plan, the task list and the checks. Stage templates and care templates become the schedule part of an SOP, so there is one source for how a crop is grown.

| SOP section | What it holds |
| --- | --- |
| Site and climate | Suitable soils and pH range, water need, altitude and temperature range, rainfall pattern, planting window by region |
| Planting requirements | Seed or seedling type, seed rate, nursery protocol for nursery crops, planting depth and method |
| Spacing and plant density | Row spacing, plant spacing, bed layout, usable area percentage, plants per acre (calculated) |
| Gap filling | Days after planting to replace dead or missing plants, accepted gap percentage, reserve seedlings to hold |
| Nutrition | Fertilizer schedule by stage, with rates |
| Water | Irrigation method and frequency by stage |
| Weeds, pests and diseases | Scouting schedule, action thresholds, approved products with their pre-harvest intervals, non-chemical options |
| Crop care | Pruning, staking, thinning |
| Harvest | Maturity signs, picking frequency, grades and sizes, handling and packaging |
| Post-harvest | Cooling, storage, shelf life, transport |
| Records required | What must be logged at each stage |
| Expected performance | Yield per plant, cycle length, typical losses, each with a source label |

Plants per acre are calculated from spacing, not typed:

```latex
\text{plants per acre} = \frac{4046.86 \times \text{usable area share}}{\text{row spacing (m)} \times \text{plant spacing (m)}}
```

**Behaviour**

- SOPs are versioned. Each crop cycle records the SOP version it followed.
- A platform SOP is a starting point. A farm copies it, adapts it, and keeps a change log. A field shows whether an agronomist has reviewed it.
- The SOP generates the plan inputs (plants, expected yield, costs) and the tasks in the daily list.
- The cycle records deviations, such as a spray outside the schedule. A compliance view shows which SOP steps were done on time, and those deviations feed back into SOP updates.
- The SOP page for a crop is readable on a phone in the field, so a manager or supervisor can check spacing, gap filling or maturity signs on the spot.

Gap filling means replacing dead or missing plants within a set number of days. Spacing means the distance between rows and between plants.

## Harvest and produce lots

Three things are kept separate, and each has one record.

| Item | Meaning | How it is recorded |
| --- | --- | --- |
| Expected harvest | A forecast of quantity by week for each cycle, with the date it was made and what it was based on | `harvest_forecasts`, kept as versions so earlier forecasts stay visible |
| Harvest log | Every harvest event: date, cycle and plot, quantity, unit, grade, picking team and hours, condition, weather, notes, photos | `harvest_entries`, the single record of what was picked |
| Harvest summary | Totals by cycle, crop, week and grade | Calculated from the log, never typed |

The harvest log and the harvest are the same data. The log is the record, and the summary is a report over it.

**Produce lots.** Each harvest entry adds to a produce lot with a code such as BP-2026-10-20-A, giving crop, cycle, plot, date and grade. A lot tracks quantity harvested, quantity reserved by orders, sold, lost (spoilage, buyer rejection) and still in stock, with its storage place and condition. Sales draw from lots.

**Forecast.** The expected harvest starts from the plan and is revised as nursery survival, plant counts, scouting findings and weather become known. A forecast accuracy report compares forecast with actual by week, so SOP yield figures can be corrected with real farm data.

**Traceability.** Every lot shows the pesticide applications on its cycle, whether the pre-harvest interval has cleared, the inputs used, and the labour hours. A harvest entry or a sale inside the interval triggers a warning.

**Losses** are recorded by stage (field, handling, storage, transport) with a reason, and buyer rejections feed the buyer record in version 2.

## Business: customers, orders, sales and expenses

| Item | What it holds |
| --- | --- |
| Customers | Name, type (market retailer, wholesaler, supermarket, processor, exporter, individual), phone, location, payment terms, credit limit, notes, history. The same record serves as the buyer in version 2 contract farming agreements |
| Customer orders | Customer, order date, delivery date, lines (crop, grade, quantity, unit, agreed price), deposit, and a status: draft, confirmed, partly delivered, delivered, invoiced, paid or cancelled. Quantities are promised against the expected harvest |
| Sales (deliveries) | What was actually delivered, from which produce lots: quantity, price, delivery note, weighing slip, rejected quantity with reason, transport cost. A sale can exist without an order, such as a market or walk-in sale |
| Invoices, receipts and payments | Invoice or receipt per delivery, payments received by method (mobile money, bank, cash) with reference, receivables ageing, overdue list |
| Expenses | One ledger for the whole farm. Each entry is a crop cost, allocated to cycles or plots, or an overhead at farm level such as licences, insurance, interest and office costs. Category, amount, date, payment method, supplier, receipt photo, approver. Splits must add up to the total |

**Rules**

- Expenses already exist in the farm records, so there is one ledger, not a second one under Business. The Business section is where it is reviewed.
- Buying an asset is recorded in the asset register, not as an expense. Hired equipment is an expense.
- Available to promise equals forecast harvest minus quantities already committed on orders. The system warns when an order would over-commit the harvest.
- Price received on sales is the actual price used in plan vs actual and feeds the market price log.

**Reports:** sales by crop, customer and period; receivables ageing; margin per order; crop costs against overhead; profit per cycle, with an optional rule for sharing overhead by area or by time; cash position.

## Assets

The asset register covers what the farm owns or leases and uses to produce. It replaces the earlier machinery module.

| Item | What it holds |
| --- | --- |
| Asset register | Name, category (tractor, vehicle, pump, sprayer, irrigation system, tool, building, storage, other), serial or plate number, purchase date, cost, supplier, ownership (owned, leased, rented in), location or plot, condition, status (active, in repair, idle, sold, written off), expected life, residual value, photos, documents such as receipt, warranty and insurance |
| Usage log | Date, asset, hours or distance, task, plot, cycle, operator, fuel used |
| Maintenance log | Scheduled service (every set number of hours or months), repairs, cost, downtime, next due date |

**Costing.** Running cost per hour combines fuel, maintenance and operator time. Optional straight-line depreciation is added. Both are allocated to cycles by recorded use, so a cycle's cost includes the tractor and the pump that served it. Hired equipment is not an asset. It is an expense with a machine job entry.

**Alerts and reports:** service due, insurance or licence expiry, utilisation by asset, cost per hour and per acre, repair history, and replacement planning. A sprayer used in a pesticide application is linked to that application.

## Pesticide applications and traceability

Pesticide use is recorded in two parts: a register of products, and a record of each application.

| Record | What it holds |
| --- | --- |
| Product register | Name, type (insecticide, fungicide, herbicide, other), active ingredient, formulation, registration number if shown, supplier, label dose range, pre-harvest interval in days, re-entry interval in hours, hazard class, protective equipment required, storage notes. Values are copied from the product label, and a photo of the label is attached |
| Application | Date and time, target, product, input lot or batch number, dose rate, mix volume, total quantity used, target pest or disease (linked to a scouting entry), method and equipment (a sprayer from the asset register), applicator, protective equipment used, wind and rain, reason, cost |

**Target.** An application is made to the whole farm, to one or more plots, or to one or more crop cycles, with the area treated. Produce lots inherit the applications of their cycle, so every lot can show what it received and when.

**Checks**

- A dose above the label maximum triggers a warning.
- The pre-harvest interval gives each cycle an earliest safe harvest date. A harvest entry or sale before that date triggers a warning.
- The re-entry interval marks a plot as not to be entered by workers until it has passed.
- Quantity used is deducted from stock, with a low-stock flag.
- Repeated use of the same active ingredient on one cycle is flagged, because it raises the risk of resistance.

**Traceability reports**

- By produce lot: every application on its cycle, with dates and whether the interval has cleared.
- By plot or cycle: full spray history.
- By product batch: every plot and cycle it was used on, so a batch later found to be fake or faulty can be traced and its users informed.

## Animal farming (livestock division)

The platform has two divisions: **crop farming**, described in the sections above, and **animal farming**, described here. A farm switches on either one or both. Land, labour, the expenses ledger, stock, assets, documents, customers and sales, roles and reports are shared, so nothing is entered twice. A division switch at the top of the app changes the menu between the two.

**Tracking modes.** Large animals (cattle, goats, sheep) are tracked one by one, each with a tag. Small animals raised in numbers (chickens, fish, rabbits) are tracked as a group or batch with counts, because tagging each bird is not practical. Pigs can use either. A group can hold individual animals or a head count, set when the group is created.

**Animal register.** Each animal has a tag number, species, breed, sex, birth date, source (born on the farm or bought, with price and seller), dam and sire if known, group or pen, and status (active, sold, dead, culled). Every change is an event on its timeline: birth, purchase, weaning, move, treatment, weighing, breeding, sale or death with a cause. Groups have a start date, a starting count, and running counts of deaths, sales and births, so survival is always calculated, never typed.

### Features

| Feature | What it records | What it does |
| --- | --- | --- |
| Vaccination and health | Vaccine register (disease covered, dose, route, storage, batch, expiry, cost per dose). Vaccination schedule templates by species, breed and age. Vaccination records per animal or group. Health cases: symptoms, diagnosis, who diagnosed, treatment, medicine, cost, outcome. Deworming, dipping and tick control. Vet visits. | Turns a schedule into reminders per animal or group, flags overdue doses, and shows disease history per animal. Medicine records carry a withdrawal period, and a milk, egg or meat sale inside that period gets a warning, in the same way a pesticide pre-harvest interval does. Sick animals are flagged on the daily list. |
| Genetics and breeding | Breed register (species, purpose such as milk, meat, eggs or dual, benchmark traits with source labels). Traits per animal: birth weight, colour, horn status, temperament, conformation score, notes. Pedigree through dam and sire. Breeding records: service or insemination date, sire or semen batch, pregnancy check, birth outcome, offspring. | Calculates the expected birth date from the gestation period set for the species. Warns when a planned mating is between close relatives. Shows a family tree and lists the offspring of any sire or dam with their performance. |
| Performance | Milk per animal per milking or day. Weight by date. Meat: live weight, carcass weight at slaughter. Eggs per day. Births and weaning per animal and breed. Deaths and culls. | Calculates average daily weight gain, lactation curve and days in milk, laying rate (eggs divided by birds), calving or kidding interval, weaning rate, dressing percentage (carcass weight divided by live weight), mortality, and feed conversion. Ranks animals and breeds so weak performers can be reviewed. The system suggests, the farmer decides. |
| Feed | Feed items with nutrient content per kg (dry matter, crude protein, energy) and a source label. Rations per group and class of animal: kg per head per day. Feed stock with storage place, purchase date, best-before date and condition. Feed given per day. | Feed planner: number of animals times ration times days gives the quantity needed. Compared with stock it shows days of feed left and a shopping list. Checks the ration against the requirement for that class of animal and flags a shortfall. Calculates cost per kg of milk, gain or eggs for each feed. Warns when stock is near its best-before date. Home-grown crops from a harvest lot can be sent straight to feed stock. |
| Expenses | Uses the single expenses ledger. Categories: labour, feed, vaccines and medicine, vet, transport, utilities, housing repairs, animal purchases, and others the farm adds. | Each expense is allocated to an animal, a group or a product line (milk, meat, eggs, breeding, live sales), or kept as overhead. Gives cost per litre, per kg of gain, per egg, per animal and per group. |
| Income | Uses the sales section. Products: milk, meat, eggs, live animals, manure, hides, breeding services. | Records sales per product with customer, quantity, price and payment, drawn from produce lots for meat and eggs. Gives income per product line and margin after allocated costs. |
| Daily tracker | Daily worklist built from vaccination schedules, feeding and milking times, health checks and breeding dates. Daily entry: feed given against planned, feed taken from store, water, milk and eggs collected, sick animals seen, births, deaths. | Works offline, with fast entry for a whole group at once (apply to all animals in this pen). Done, skipped and delayed states as for crop tasks. Stock of feed and medicine is reduced as it is used. |
| Dashboard | Reads from all of the above. | Animal counts by species and group, births and deaths this month, milk and egg trend, vaccinations due, active withdrawal periods, feed days left, cost and income this month, and open health cases. The planning view shows planned breedings, expected births, planned sales and feed needs for the coming months, labelled as forecasts. |
| Capital investments | A register of land, buildings and technology bought for the farm: sheds, dairy room, coop, fencing, water, solar, milking machine, feeders, sensors, vehicles. Cost, date, funding source, expected life, and which division or product line it serves. | Spreads the cost over its life (straight line, editable), adds it to product-line cost, and compares it with the income of that line to show payback time and return. Shared with the crop division and linked to the asset register. |

**Capital investments and the investor module.** Capital investments here means money the farm owner spends on land, buildings and technology. It is separate from the investment and contract farming module, where an outside investor funds a deal. Livestock deals with outside investors are not in the first livestock release.

**Connections to crop farming.**

- Manure is recorded as a product and can be applied to a plot or crop cycle as fertiliser, with its cost and quantity.
- Crop residues and home-grown grain move from a produce lot into feed stock, with the value credited to the crop cycle and charged to the animal group.
- Labour, machinery and expenses are entered once and allocated to crop cycles, animal groups or overhead.

**Rules.**

- Quantities, money and units follow the same rules as the rest of the platform, and every reference value (gestation periods, feed nutrient values, requirements, benchmark yields) carries a source label and is placeholder until checked.
- The platform does not ship vaccination schedules as facts. Schedules are templates the farmer or the farm vet enters, and any seeded example is labelled placeholder, verify with a vet.
- The platform records health and breeding events. It does not diagnose and does not replace a vet.
- Rules about animal movement permits, notifiable diseases and slaughter are to be confirmed with the local livestock officer and the lawyer before the first livestock release. The system can only prompt the user to report; it makes no legal claim.
- Offline entry is required for the tracker, weights, milk and egg records, health cases and feed records.

## Reference data and crop economics (plan vs actual)

The platform ships with standard agricultural reference data and a crop economics model, so a farmer can generate a plan for any crop in a region, then compare it with what really happened. The template is the founder's 1-acre bell pepper model (TZS): seeds, survival, plants per acre, yield per plant, one-off and seasonal costs, per-kg harvest costs, price, monthly cash flow, break-even and profit.

**Reference data the platform holds**

| Data | Content | Used for |
| --- | --- | --- |
| Regions and districts | Tanzanian regions with districts, agro-ecological zone, altitude | Choosing defaults for a farm |
| Climate | Rainfall pattern (one or two rainy seasons), monthly rainfall and temperature normals, frost or heat risk | Planting windows, crop calendar, weather-aware reminders |
| Soils | Common soil types per region, with pH range and typical fertility notes | Suitability and fertilizer guidance |
| Crops | Master list of all crops: mode (nursery or direct), cycle length, spacing, plants per acre, expected yield per plant and its unit, stage templates, care templates | Crop cycles and reminders |
| Regional crop profile | Most-grown and dominant crops per region, with suitability rating | Suggesting what to plant |
| Crop economics template | Cost lines per acre from seed to market, per-kg harvest costs, expected price range, timing of each cost and of harvest | Plan generation |
| Weather | Monthly normals per region, plus a live forecast feed in version 2 | Reminders and season planning |
| Input and market prices | Fertilizer, seed, chemicals, labour day rate, land rent, transport, and crop farmgate prices, each by region and date | Costing and break-even |

**Three data layers, the farm's own value wins**

1. Platform defaults, curated by the platform owner.
2. Regional values, which override the default for that region.
3. Farm values entered by the user, which override both and are used in that farm's plans.

Every value stores its unit, region, date and source, and is labelled as one of: *benchmark* (converted or published figure), *local quote* (a price someone obtained locally), or *your actual* (recorded by the farm). The bell pepper file already works this way in its notes, where only the seed price was a local quote and other costs were converted from Kenyan benchmarks. Showing the label keeps weak numbers visible. Prices carry a date and are flagged as stale after a set period.

**From plan to actual**

1. Pick the crop, region, area and planting date. The system fills the template from the three layers.
2. Review and edit any assumption, then save it as the **plan** for a crop cycle. Several scenarios (expected, low price, low yield) can be saved side by side.
3. Generate the plan document: assumptions, monthly cash flow, income summary, break-even, in the same layout as the bell pepper workbook, as a spreadsheet and PDF.
4. As the cycle runs, the records already described in this spec fill in the actuals.
5. A **plan vs actual report** compares each line, shows the variance, and names the driver (survival, yield per plant, price, cost line, timing).
6. At close, the farm can update its own values from the actuals, so the next plan starts from its real results.

**How each line of the**** ****o****ne**** **** ****c****ro****p **** model maps to recorded data**

| Plan line | Actual comes from |
| --- | --- |
| Seed grams, seeds per gram, total seeds | Nursery batch: seed lot and quantity sown |
| Germination and survival rate | Nursery checks and transplant counts |
| Plants for transplant | Transplants: quantity moved |
| Seed, land preparation, nursery, transplanting, irrigation, fertilizer, weeding costs | Expenses, work entries, machine jobs and stock usage, allocated to the cycle by category |
| Yield per plant and total yield | Harvests: quantity by date, divided by plants transplanted |
| Harvest, packaging and transport cost per kg | Labour entries and expenses tagged to harvest |
| Farmgate price | Sales: price per unit received |
| Monthly cash flow | Expenses and sales grouped by month |
| Profit, cost per kg, break-even | Calculated from the actuals the same way as the plan |

**Scenarios and stress tests.** A plan holds a base case and the user can change price, yield, survival and any cost line to see profit and break-even. The bell pepper file notes that it is a best-case model with no downside case, so low-price and low-yield scenarios should be generated by default.

**Benchmarks from real farms (later).** With user consent, anonymised actuals such as yield per plant and cost per acre by crop and region can improve the platform defaults over time. This needs a clear consent and privacy policy before it is built.

**Data upkeep is real work.** Weather normals, prices and crop data need sources and regular updates. Version 1 should launch with a small set of crops and regions the founder can verify, with every figure labelled, and let users enter their own values from the start.

## Investment and contract farming

An agreement links an investor, a farmer and one or more crop cycles, and tracks money and crop owed until it closes. The investor can also be the farmer's own farm owner, so returns on your own cycles can be compared with returns on deals with others.

**Deal types**

| Type | How it works |
| --- | --- |
| Cash loan, cash repayment | Principal, interest and a repayment schedule |
| Loan repaid in crop | Investor advances money or inputs; farmer repays in kilograms or bags at harvest |
| Input advance with offtake | Investor supplies seed, fertilizer or labour money and has the right to buy the harvest at an agreed price, with the advance deducted |
| Profit or revenue share | Investor funds a cycle and receives an agreed percentage of sales or profit |
| Land or equipment lease | Owner leases an asset for rent or a share of the crop |

**Pricing rules for crop repayment.** Each agreement picks one, since this is where deals most often go wrong:

- Fixed price agreed upfront.
- Market price on delivery day, from a named reference market.
- Market price with a floor and a ceiling.
- Fixed quantity regardless of price.

Delivered crop is converted into a credit against what is owed, and the balance shows in both money and crop.

**Monitoring and alerts**

- Exposure dashboard: money out, expected return, crop owed, overdue items, risk by farmer and crop.
- Crop-linked monitoring: the investor sees the borrower's cycle progress, photos and cost summary within the access scopes the farmer allows.
- Alerts: delivery due soon, harvest finished but not delivered, late payment, forecast yield below the amount needed to repay.
- Yield-vs-obligation check before harvest, for example 10 bags expected against 15 owed.
- Side-selling check: harvest sales compared with deliveries to the investor.
- Return calculation: return on investment and annualised return per deal, including losses and defaults.
- Statements: a printable balance statement per agreement for both parties.

## Accounts, roles and permissions

Farmers and investors have separate logins, and the agreement is the only bridge between them.

- **One user, several roles.** A person can hold a farmer account (owns a farm workspace), an investor account (owns a portfolio), or both.
- **Farm data stays private to the farm.** An investor never gets general access, only what an agreement allows.
- **Invitation flow.** Either party creates a draft agreement and invites the other by phone or email. Once accepted, the agreement is a shared record.
- **Access scopes, set by the farmer per agreement:** cycle progress, photos, cost summary, harvest records. Wages, other crops and other investors' deals are never exposed.
- **Closing.** When an agreement closes, access becomes read-only history, and ends if the farmer wishes.
- **Audit log.** Who viewed or changed what is recorded for every shared agreement.

**Two-sided confirmation.** Money and crop movements need both sides to agree before they count:

1. The investor records an advance of 2,000,000 TZS, and the farmer confirms receipt.
2. The farmer records a delivery of 20 bags, and the investor confirms receipt and weight.

Unconfirmed entries show as pending and disputed entries are flagged with notes, so both sides always see the same balance.

| Role | Sees | Can do |
| --- | --- | --- |
| Farm owner | Whole farm workspace | Everything on the farm, create agreements, set access scopes |
| Farm manager | Assigned farm and plots | Log work, hours, inputs; no financial settings |
| Investor | Own portfolio, plus scoped farm data per agreement | Create agreements, record advances, confirm deliveries, download statements |

## Document system

The platform stores documents and generates new ones from data already entered.

**Documents generated from system data**

- Loan agreement, crop-repayment agreement, and input advance or offtake agreement
- Land and equipment lease agreements
- Receipts for advances given and payments received
- Delivery note and weighing slip
- Repayment statement and balance statement
- Reminder or demand letter for late repayment
- Casual labour pay sheet and worker engagement letter
- Farm reports (daily, cycle, season) and a farm profile for presenting to investors

**How generation works.** Templates hold placeholders such as the farmer's name, principal, pricing rule and delivery dates, filled from the agreement. A clause library lets users switch clauses on or off, for example late-delivery penalty, default terms, or force majeure for drought. Output is PDF, with Word for editing, in English and Swahili.

**Storage.** Users can upload and tag signed contracts, ID copies, land and lease papers, receipts, weighing slips and photos. Each file is linked to the agreement, party or cycle it belongs to and follows the agreement's access scopes. Sensitive files such as ID copies are restricted and encrypted.

**Versioning.** A signed document is locked. A change becomes an amendment with a new version, and a hash of each final file is stored so later alteration can be detected.

**Signing.** Version 1 does not sign inside the app. A document is generated marked "Draft, not legally reviewed", a lawyer approves the template once, the parties sign on paper or as the lawyer advises, and the signed scan is uploaded, marked Signed, locked, and its hash stored. Statuses are Draft, Sent for review, Approved, Signed and Superseded. A dedicated e-signature service can be integrated later.

**Templates are starting points.** Whether an in-app signature is enforceable in Tanzania, and whether the clauses are adequate, must be checked by a lawyer before real use. Generated documents should be labelled as templates until then.

## Data model

Every farm-owned table carries `farm_id`. Money fields store an amount and a currency, and quantities store a unit. This is a first draft to be turned into a Prisma or SQL schema.

| Area | Tables | Key fields and links |
| --- | --- | --- |
| Accounts | `users`, `accounts`, `account_roles`, `farms`, `farm_members`, `invitations` | A user has roles; a farm has members with a role (owner, manager) |
| Land | `land_holdings`, `plots` | Holding: owned or rented, cost or rent, period, owner. Plot: holding, area, soil type, water source, GPS |
| Crops | `crop_types`, `stage_templates`, `care_templates`, `crop_cycles` | Crop type has a mode (nursery or direct), stages and care rules. Cycle: plot, crop type, variety, area, dates, status, expected and actual yield |
| Nursery | `nursery_batches`, `nursery_checks`, `transplants` | Batch: cycle, seed lot, sow date, quantity. Check: germinated, surviving, condition, photo. Transplant: quantity moved and discarded, reason |
| Daily work | `tasks`, `activity_logs`, `issues` | Task: cycle or plot, type, due date, status (done, skipped, delayed), done by, photos. Generated from care templates |
| Labour and machinery | `workers`, `work_entries`, `payments`, `equipment`, `machine_jobs` | Work entry: worker, task, cycle, start, end, rate, amount, paid status. Machine job: owned or hired, hours, fuel, cost |
| Inputs and stock | `items`, `stock_movements`, `suppliers` | Movement: purchase, usage (linked to task, plot, cycle) or adjustment |
| Money | `expenses`, `harvests`, `sales`, `buyers`, `receipts` | Expense: category, amount, allocation to plot or cycle. Harvest: cycle, quantity, grade, loss |
| Planning | `season_plans`, `budgets`, `budget_lines` | Plan per season, with budget vs actual |
| Agreements | `parties`, `agreements`, `agreement_parties`, `agreement_access_scopes`, `agreement_advances`, `agreement_schedule`, `agreement_deliveries`, `agreement_payments`, `agreement_events` | Agreement: type, parties, linked cycles, principal, interest, pricing rule, default terms, status. Advances, deliveries and payments each carry a confirmation status for both sides |
| Documents | `document_templates`, `clauses`, `documents`, `document_versions`, `signatures`, `file_attachments` | Document: linked record, template, version, file hash, signed status |
| Platform | `audit_log`, `notifications`, `subscriptions` | Who did what and when; reminder delivery; plan and billing per account |

**Key relationships**

- Labour entries, machine jobs, stock usage and expenses all reference `cycle_id`.
- Harvests can be linked to agreements, showing how much of a harvest is already committed.
- Agreement deliveries reference a harvest and carry the weighing slip as an attachment.

**Tables added by the literature review**

- `suppliers` gain a lot and batch reference on `stock_movements`, so input quality can be compared by supplier.
- `advisors` and `advice_requests` (photo, question, answer, reviewer).
- `farmer_groups`, `group_members`, `group_agreements` (optional joint liability), `aggregation_lots`.
- `track_record_reports` and `consents` (who may see what, for how long, withdrawn or not), plus `data_requests` for export and deletion.
- `buyer_events`: agreed pickup date, actual pickup, quality grade agreed, grade given, rejection reason with photos, payment due and paid dates.
- `weather_logs` (rain gauge and temperature entries per plot) and `loss_events` (type, date, area affected, photos).
- `produce_lots`, `storage_checks` and `loss_records` by stage (field, handling, storage, transport).
- `price_log`: crop, market, grade, price, unit, date, source.

**Tables added by the second pass**

- `plots` gain tenure type, document status and renewal date, plus `tenure_disputes`.
- `scouting_logs` (pest, severity, photos) and `spray_records` (product, active ingredient, batch, dose, date, pre-harvest interval), plus `outbreak_alerts` shared with consent.
- `labour_plans` (person-days per week), `worker_pool`, `callouts` and `wage_benchmarks`, with a mobile money reference on `payments`.
- `lender_attestations` (licensing position, date, document) linked to `agreements`, and an agreement type tag (loan, input advance, sale).
- `farmers` gain an optional national farmer ID, plus `subsidy_receipts` (input, quantity, price, date).

**Tables added by the harvest, business, SOP, assets and pesticide review**

- `crop_sops`, `sop_versions`, `sop_sections` and `sop_deviations`. Each `crop_cycles` row stores its `sop_version_id`, and stage and care templates become children of an SOP version.
- `plans`, `plan_versions` and `plan_scenarios` per cycle.
- `harvest_forecasts` (versioned), `harvest_entries`, `produce_lots` and `lot_movements` (harvested, reserved, sold, lost).
- `customers`, `customer_orders`, `order_lines`, `deliveries`, `delivery_lines`, `invoices` and `payments_received`. Expenses gain a type: crop cost or overhead.
- `assets`, `asset_usage`, `asset_maintenance` and `asset_documents`, with depreciation settings.
- `pesticide_products`, `pesticide_applications`, `application_targets` (farm, plot or cycle) and `application_lots`, plus a computed harvest hold date per cycle.

**Tables added by the animal farming division**

- `farm_divisions` (crops, animals) to switch each division on per farm.
- `animals`, `animal_groups`, `animal_events` (birth, purchase, move, sale, death with cause) and `animal_traits`.
- `breeds` with benchmark traits and source labels, and `breeding_records` (service, pregnancy check, expected and actual birth, offspring).
- `vaccine_products`, `vaccination_schedule_templates`, `vaccination_records`, `health_cases` and `treatments`, with a withdrawal period on each medicine record.
- `weight_records`, `milk_records`, `egg_records` and `slaughter_records`.
- `feed_items` with nutrient values, `feed_rations` and `ration_lines`, `feeding_logs`, and `nutrient_requirements` per class of animal. Feed stock reuses the existing items and stock movements, with item categories for feed and veterinary medicine.
- `product_lines` (milk, meat, eggs, breeding, live sales, crop lines). The expense allocation table gains animal, group and product line as allocation targets, next to cycle and plot.
- `capital_investments` with category (land, building, technology, equipment), cost, funding source, expected life and division, linked to the asset register.

## Technical architecture

A standalone web application, installable as a progressive web app (PWA) on phones.

- **Front end:** PWA with local storage (IndexedDB) and a sync queue, so entries made without signal are uploaded later. Conflicts on shared agreement records are resolved by the confirmation workflow, not silently overwritten.
- **Back end:** an API server with role-based access control on every request.
- **Database:** PostgreSQL. Tenant isolation through a `farm_id` filter, ideally enforced with row-level security. Agreement data is readable by both parties through scoped queries.
- **File storage:** object storage for photos, signed documents and ID copies, with encryption and access checks tied to agreement scopes.
- **Document generation:** server-side rendering of templates to PDF and Word, with a stored hash of each final file.
- **Reminders and notifications:** a scheduled job generates daily tasks from care templates and sends in-app notifications, with SMS or WhatsApp in version 2.
- **Internationalisation:** English and Swahili strings, local units, and TZS as the default currency with multi-currency fields.
- **Security:** audit log, encrypted sensitive files, backups, and per-agreement access scopes.
- **Billing (version 3):** subscription plans per account, with limits by farms, plots or users.

## Challenges and evidence from the literature

The sources below point to risk, trust, input quality and weak enforcement as the binding constraints, more than a lack of apps. The platform's lasting value is therefore verified records and fair, evidence-backed agreements. The first pass added twelve features and the second pass added six, each listed in a table below.

| Challenge | What the evidence shows | Response in this platform |
| --- | --- | --- |
| Low input use and poor input quality | Tanzania uses about 19 kg/ha of fertilizer against a continental target of 50, and improved seed on about 20% of planted area ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)). In Uganda, tested fertilizer was missing 30% of its nutrient, and only 20% of samples applied to locally bought hybrid seed were profitable ([VoxEU](https://cepr.org/voxeu/columns/sub-standard-quality-fertilisers-and-hybrid-seeds-makes-adoption-modern-inputs)) | Record supplier and lot on every input, then compare survival and yield by supplier |
| Thin extension services | Only 7% of Tanzanian farming households received extension in 2020, down from 67% in 2008, with a gap of about 5,000 crop extension workers ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)) | An advisor role, photo-based advice requests, and agronomist-reviewed care templates |
| Finance gap | 3.8% of Tanzanian agricultural households received credit in 2019/20, mostly informal ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)). A review of African farm lending found banks meet under 3% of an estimated USD 450 billion smallholder demand, calls perceived risk the largest barrier, and reports One Acre Fund repayment near 99% using bundled inputs, training and group liability ([One Acre Fund brief](https://oneacrefund.org/sites/default/files/2023-09/Scaling_Up_Agricultural_Credit_In_Africa_Farm_Finance.pdf)). Apollo Agriculture relies on field-officer data plus satellite imagery, and says free imagery is inadequate for farms under two acres ([GSMA](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/blog/ai-driven-smallholder-farmer-lending-in-africa-insights-from-apollo-agriculture/)) | A consent-based farmer track-record report, farmer groups, and field agents who collect and verify data |
| Contract farming fails on both sides | Farmers side-sell when prices rise, and buyers avoid paying when prices fall by applying strict quality standards; most contracts are not legally enforceable ([review](https://openagriculturejournal.com/VOLUME/14/PAGE/59/FULLTEXT/)). In Ghana's pineapple scheme, 56% of farmers who ever joined had exited by 2009, firms sometimes did not return to collect fruit, and the farmer's alternative was a local price roughly half as high ([Barrett et al.](https://marcfbellemare.com/wordpress/wp-content/uploads/2011/09/BarrettetalSmallholderParticipationFinalVersion.pdf)). One study cited in the review found conditional bonuses reduced contract breaches | Track buyer obligations as closely as farmer obligations, agree quality grades in advance, require evidence for rejections, and offer compliance bonuses |
| Climate stress | Agricultural productivity growth in Africa is estimated to be 34% lower since 1961 than without climate change, and warming above 2°C is projected to cut staple crop yields across most of Africa, with medium confidence ([IPCC AR6, chapter 9](https://www.ipcc.ch/report/ar6/wg2/chapter/chapter-9/)). Under business as usual, Tanzania's maize, beans and cassava move into deficit by 2030 ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)) | Climate stress scenarios, a farm weather log, and a diversification view across plots |
| Insurance does not scale easily | Index insurance uptake is around 16% at full price and 38% with a 50% subsidy, with distrust and basis risk named as causes ([ATAI](https://www.atai-research.org/wp-content/uploads/2016/02/ATAI-Emerging-Insights-Risks-3-page-7.14.16-1.pdf)) | Do not build revenue on insurance. Keep a loss-event log and evidence pack for partners |
| Post-harvest loss, and conflicting estimates | FAO figures cited by the World Bank put losses at up to 37% of food from production to consumption, 8% in handling and storage, while farmer-reported maize losses in Malawi, Tanzania and Uganda were 1.4 to 5.9% of the national harvest. Use of improved storage ranges from 0.6% in Uganda to 12% in Tanzania ([World Bank](https://www.worldbank.org/en/programs/africa-myths-and-facts/publication/is-post-harvest-loss-significant-in-sub-saharan-africa)). Tanzanian fruit and vegetable growers market about 60% of produce because of perishability ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)) | Measure losses by stage on your own farm, and track produce lots and storage condition |
| Markets and prices | Over 80% of Tanzanian farmers name low prices as their main challenge and under 10% name market access; over 95% farm under 2 ha and market about 20% of their food ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)) | A price log, group selling, and a buyer history |
| Digital adoption | A review of smallholder digitization, mainly in South Africa, names poor infrastructure, limited finance, low digital literacy, device and data costs, unreliable connectivity and distrust as barriers, and finds most tools address planning, production and market access, with fewer covering storage, transport and post-harvest ([Frontiers, 2025](https://www.frontiersin.org/journals/sustainable-food-systems/articles/10.3389/fsufs.2025.1583224/full)) | Field agents, SMS reminders, a low-data mode, and a post-harvest module |
| Data protection law | Tanzania's Personal Data Protection Act took effect on 1 May 2023 and requires anyone collecting or processing data in Tanzania to register with the Commission ([ALN](https://aln.africa/insight/tanzanias-personal-data-protection-act-comes-into-effect/)). Its sensitive data definition includes an individual's financial transactions, transfers abroad are restricted, and corporate fines reach TZS 5 billion ([Clyde & Co](https://www.clydeco.com/en/insights/2023/02/tanzania-personal-data-protection-act-of-2022)) | A consent ledger, retention rules, data export and deletion, a hosting decision, and company registration |

**Features added from this review**

| Feature | Addresses | Version |
| --- | --- | --- |
| Supplier and input-lot capture on every purchase and usage entry | Input quality | V1 capture, V2 scorecards |
| Advisor role: an agronomist with scoped access, photo-based advice requests, and review of care templates | Thin extension | V2 |
| Farmer track-record report: verified cycles, yields, costs and repayments, shared only with consent | Finance gap | V2 |
| Farmer groups and cooperatives: group membership, group agreements, optional joint liability, produce aggregation | Finance, markets | V2 start, V3 full |
| Field agent mode: one trained agent enters and verifies data for several farms, plus SMS and low-data screens | Digital adoption | V1 supervisor entry, V2 agents and SMS |
| Buyer obligations and performance record: pickup dates, agreed quality grades, rejection with photos, payment delays | Contract failures | V2 |
| Agreement fairness checks: warning when repayment is high against expected income, compliance bonus clause, written agreement required before a deal activates | Debt risk, side-selling | V2 |
| Farm weather log (rain gauge entries) and climate stress scenarios on plans | Climate | V1 log, V2 scenarios |
| Loss-event log and claim evidence pack: dated photos, weather log, affected area | Insurance, disputes | V2 |
| Produce lots and storage tracking, with loss recorded by stage (field, handling, storage, transport) | Post-harvest loss | V2 |
| Market price log and group selling | Markets | V2 log, V3 group selling |
| Consent ledger, retention rules, export and deletion of personal data, hosting decision and company registration | Data protection | V1 |

**Second pass: land, pests, labour, lending law and farmer registry**

| Challenge | What the evidence shows | Response in this platform |
| --- | --- | --- |
| Land tenure | As of 2021, 864,000 customary right certificates had been issued against about six million rural households, roughly 14% by simple division. A 2017 survey found 55% of rural respondents had no documents proving their land rights. The project document says secure tenure makes smallholders more likely to invest long term ([World Bank project document, 2021](https://documents1.worldbank.org/curated/en/466181641925880285/pdf/Tanzania-Land-Tenure-Improvement-Project.pdf)) | A tenure record per plot, with document status and renewal dates, shown to the investor before funding |
| Pests and disease | Farmers reported fall armyworm yield losses of 26% in Ghana and 35% in Zambia, but recall-based figures tend to overstate losses, and a second method in Ghana gave up to 17%. No control was used by 14.7% of Ghanaian and 36.5% of Zambian farmers. The note flags misuse and fake pesticides, recommends integrated pest management, and reports intercropping cut damage by 21 to 31% and push-pull by 86.7% in trials. Tanzania's annual maize loss is a modelled mean of USD 399 million, not a survey result ([CABI, 2018](https://www.cabi.org/wp-content/uploads/FAW-Evidence-Note-October-2018.pdf)) | Scouting log, spray records with batch and dose, and guidance on non-chemical options reviewed by an agronomist |
| Casual labour and youth | In Kilimanjaro and Manyara in 2017, about half of farmers hired daily workers for two to three day jobs at USD 1.20 to 6.50 a day, and rarely hired outside their own village. An SMS job-posting app cut pay dispersion by 16 to 40% but did not raise average wages or the number of jobs ([CEGA](https://cega.berkeley.edu/collection/facilitating-agricultural-labor-markets-in-rural-tanzania/)). Rural youth participation in the agrifood system rose from 60 to 63%, off-farm agrifood enterprises doubled from 10 to 20%, and farming participation fell ([IFAD, 2019](https://www.ifad.org/en/web/latest/-/blog/measuring-youth-participation-in-agriculture-in-tanzania-and-malawi)) | A labour planner that turns the crop plan into person-days per week, a casual worker pool with one-way SMS call-outs, and wage benchmarks from recorded pay |
| Lending licensing | The Bank of Tanzania states that lending without a valid licence is an offence under section 16(1) of the Microfinance Act 2018, including loans made through platforms. It advises borrowers to receive a signed loan contract and to check the Bank's list of licensed lenders ([Bank of Tanzania notice, 13 May 2024](https://www.bot.go.tz/Adverts/PressRelease/en/2024051310172548.pdf)) | A lender attestation before any loan agreement activates, and a rule that the platform never lends or holds funds |
| National farmer registry | By October 2022, 1.3 million farmers were registered in the government's subsidised fertilizer system, with a target of seven million by the end of December 2022. The Ministry of Agriculture runs it with the fertilizer regulator, and about half of those registered had received passwords and unique identity numbers ([Daily News, 2022](https://dailynews.co.tz/1-3-million-farmers-registered-for-subsidised-fertiliser/)) | An optional national farmer ID field and a record of subsidised inputs received |

**Features added by the second pass**

| Feature | Addresses | Version |
| --- | --- | --- |
| Tenure record per plot: type (title, customary certificate, lease, informal), document status, renewal date, boundary, dispute log | Land tenure | V1 record, V2 tenure risk flag in agreements |
| Pest and disease scouting log, spray records (product, active ingredient, batch, dose, date) and a warning when a harvest falls inside the label's pre-harvest interval | Pests, input quality | V1 logs, V2 warning |
| Outbreak alerts shared between nearby farms, only with consent | Pests | V2 |
| Labour planner, casual worker pool with one-way SMS call-outs, wage benchmarks by task and region, mobile money reference on each payment. Workers still do not log in | Casual labour | V2 |
| Lending licensing guard: agreement type tagged as loan, input advance or sale, lender attestation of their licensing position, and no loan agreement activates without it | Lending law | V2 |
| Optional national farmer ID and subsidised input receipts, with integration to a government registry if one is available | Farmer registry | V1 field, V3 integration |

Until a lawyer confirms how Tanzanian law treats private deals between farmers and investors, loan-type agreements stay behind the legal review step described in the document system. Input advances and offtake contracts may be structured differently from loans, which is also a question for the lawyer.

**Limits of the second pass**

- The text of the Microfinance Act was not available to me, so what counts as the business of lending, and whether an occasional private loan does, is unconfirmed.
- The fall armyworm figures come from farmer recall in Ghana and Zambia, and the Tanzania figure is modelled. Pests of vegetables such as bell pepper were not covered.
- The tenure figures come from a 2021 project document and a 2017 survey, the youth figures from a 2019 article, and the registry figures from 2022 news. Current status was not checked.

**What the platform cannot fix.** Contract enforcement, roads and cold chains, the climate itself, and the cost of insurance sit outside software. The platform can make these problems visible and provide evidence, which is its realistic contribution.

**Who the platform will reach first.** The contract farming review cites a study where 62% of contract farmers had notably larger landholdings or assets than their neighbours. Early users are likely to be commercial and mid-size farmers like the founder. Reaching the smallest farmers needs group and field-agent models, not individual accounts.

**Limits of this evidence**

- The input quality study is from Uganda, not Tanzania, and the digital adoption review focuses on South Africa.
- The farm lending brief reports figures from around 2013 and 2014.
- Published loss estimates disagree widely, so the platform's own measurements will be more useful than any benchmark.
- The data protection summary comes from law firm notes, not the Act. A lawyer should confirm registration steps and cross-border rules.
- A study on smallholder yield trends in sub-Saharan Africa (PNAS) could not be opened, so none of its findings are used.

## Roadmap

Version 1 is a working farm tracker for one farm. Agreements come in version 2, because they depend on crop cycles, costs and harvest records being reliable first.

| Version | Scope | Done when |
| --- | --- | --- |
| V1: Farm operations | Accounts and farm setup; land and plots; crop types with stage and care templates (nursery and direct-sown); crop cycles; nursery batches, survival checks and transplants; daily task list with reminders; daily activity log; workers, hours and pay summary; expenses allocated to cycles; inputs and stock basics; document upload and storage; core reports (daily, cycle cost, labour, nursery survival); offline-first PWA; English and Swahili | The founder runs a real crop cycle end to end and gets a cost report |
| V2: Harvest, investment and documents | Customer orders against expected harvest, invoices, receivables ageing and profit per cycle after overhead; budgets and season planning; weather-aware reminders; SMS and WhatsApp reminders; agreements of all five deal types; farmer and investor logins; invitations, access scopes, two-sided confirmation; crop-repayment pricing rules; investor dashboard and alerts; document templates, clause library, the document status flow and signed-copy upload | A real agreement runs from advance to crop repayment with both sides confirming |
| V3: Product | Subscription billing and plan limits; e-signature integration; investor portfolio analytics; exports; onboarding for new farms; admin tools | Other farmers and investors can sign up and pay |

**Additions from the literature review.** Version 1 also includes supplier and lot capture, the farm weather log, field agent entry by a supervisor, and the consent ledger with retention, export and deletion rules, since data protection obligations apply from the first user. Version 2 adds advisors, track-record reports, buyer obligations and performance records, agreement fairness checks, climate stress scenarios, the loss-event evidence pack, produce lots and storage tracking, and SMS reminders. Version 3 adds full group and cooperative features, group selling and the market price network.

**Additions from the second pass.** Version 1 adds tenure records per plot, pest and disease scouting with spray records, and the optional national farmer ID. Version 2 adds the pre-harvest interval warning, outbreak alerts, the labour planner with SMS call-outs, and the lending licensing guard, which must be in place before any loan agreement can be activated. Version 3 adds integration with a government farmer registry if one is available.

**Additions from the harvest, business, SOP, assets and pesticide review.** Plan vs actual needs a harvest record, so version 1 is best released in two steps. Version 1a is daily operations: the crop SOP in place of separate stage and care templates, the pesticide register and applications with pre-harvest checks, the asset register with usage and maintenance logs, and the single expenses ledger with overhead. Version 1b adds expected harvest, the harvest log and produce lots, simple sales (customer name, delivery, price, payment), and the plan, forecast and actual report. Version 2 adds customer orders against the forecast, invoices and receipts, receivables ageing, asset depreciation allocation, traceability reports by produce lot and product batch, and forecast accuracy reports. Version 3 adds overhead allocation rules and portfolio views.

**Animal farming in the roadmap.** The animal division is large and should not delay the crop release. After version 1b, build it in three steps. Step A1: animal and group register, daily tracker, feed planner and stock, and expense allocation to animals and groups. Step A2: vaccination and health with withdrawal warnings, and performance records (milk, weight, eggs, births). Step A3: genetics and breeding, income by product line, capital investments, and the dashboard and planning view. If the founder's first real farm is a livestock farm, this order is reversed: livestock steps A1 to A3 come first and the crop SOP, harvest and pesticide parts follow. Livestock deals with outside investors wait for a later version.

## Decisions made

| Topic | Decision |
| --- | --- |
| Currency | TZS is the default, switchable to USD per farm |
| Payment methods | Mobile money and bank are both recorded on every advance and repayment, with a reference number |
| Worker logins | None for now. The owner or a supervisor logs work and hours, and workers appear as names with rates. One-way SMS call-outs come in version 2 |
| Documents | Generated from system data, approved once as templates by a lawyer, signed on paper or as the lawyer advises, then the signed copy is uploaded. No in-app signing in version 1 |
| Region and first crop | Not fixed. Each farm sets its own region, crops, calendar, units and price source, and the first real farm drives the first crop templates |
| Interest, penalties and lending licence | A lawyer confirms these before any loan agreement can activate, using the licensing guard described in the challenges section |
| Pricing model (recommended, not yet tested) | A subscription per farm in tiers, limited by acreage or crop cycles per season, with unlimited workers and supervisors. A free tier for small farms. Investors join free and pay by number of active agreements above a free allowance. SMS sold as credits. Seasonal or annual payment alongside monthly, and mobile money accepted. No percentage taken on loans or crop deals, to avoid looking like a lender or broker. Prices are to be set by testing with real farmers |

## Risks, legal considerations and open questions

**Risks**

- **Legal.** Informal lending, interest and crop-repayment contracts may be subject to Tanzanian rules, including licensing if lending becomes regular business. A lawyer should review the agreement templates, interest terms and signing process before real use. This spec is not legal advice.
- **Adoption.** Farm workers and some farmers may have basic phones and little time to enter data. Mitigation: very fast entry screens, voice notes, SMS reminders, and a supervisor role who logs for the team.
- **Data trust.** Investors rely on the farmer's data. Mitigation: two-sided confirmation, photos with timestamps, and weighing-slip attachments.
- **Connectivity.** Poor signal on farms. Mitigation: offline-first design from the start.
- **Scope.** The module list is large. Mitigation: ship version 1 for the founder's own farm before building agreements.
- **Privacy.** ID copies and financial terms are sensitive. Mitigation: encryption, scoped access and an audit log.

**Open questions**

- [ ] Which crops come first? Vegetables with a nursery behave differently from maize or rice, and care templates depend on this.
- [ ] Is the first farm the founder's own, and in which region?
- [ ] Which currencies, units and local market price sources should be supported at launch? tzs and being able to switch to usd
- [ ] Should workers get their own simple login, or log through a supervisor only?
- [ ] Which payment methods (mobile money, bank) should be recorded on advances and repayments? both mobile and bank
- [ ] What interest and penalty terms are allowed, and what licensing applies to lending? (lawyer to confirm)
- [ ] Pricing model for the product: per farm, per plot, or per user? here help me deside which is good based on world experience
