# Farm Management and Investment Platform

## Project summary

A multi-tenant web platform where a farmer runs the farm day to day and an
investor funds and monitors crop deals. Both work from the same confirmed
agreement records. The product is intended to be sold to multiple farms, with
the founder's farm as the first user.

## Users

- **Farmer or farm owner:** Plans crops, logs daily work, and tracks costs,
  labour, and harvest.
- **Farm manager or supervisor:** Records daily activities and hours for the
  owner.
- **Investor:** Funds crop cycles through loans, input advances, or contract
  farming, and tracks repayment and returns.

## Goals

1. Record every cost, hour, and input against a plot and crop cycle, so profit
   per crop is always known.
2. Turn care routines (watering, fertilizing, weeding, and spraying) into a
   daily task list with reminders.
3. Support nursery-based crops and direct-sown crops in one system.
4. Let investors and farmers share one confirmed record of each deal,
   including repayment in crop.
5. Store and generate the documents a farm and its deals need in English and
   Swahili.

## Out of scope for now

- Payment processing
- Marketplace for selling produce
- IoT sensors
- Satellite imagery

## Design principles

- **The crop cycle is the backbone.** Labour, machinery, inputs, expenses,
  tasks, and harvests all point to a crop cycle, so cost and profit per cycle
  are simple sums.
- **Nursery is an optional stage.** Each crop type has a stage template.
  Nursery crops run through seed purchase, nursery, transplant, growing, and
  harvest. Direct-sown crops run through land preparation, sowing, growing, and
  harvest. Care reminders attach to stages, so one engine serves both.
- **Log once, link everywhere.** An entry such as "weeding, Plot B, 4 workers,
  5 hours" updates the daily log, labour cost, and cycle cost together.
- **Mobile and offline first.** Field entries are saved on the phone and synced
  when signal returns. Photos and voice notes are supported.
- **Multi-tenant from day one.** Every record carries a farm id, and an
  investor sees a farm only through an agreement.
- **Units everywhere.** Quantities store their unit (kg, bags, litres, acres),
  because farmers mix units.
- **English and Swahili from the start.** Both the interface and documents
  support both languages.

## Farm operations modules

The farm operations scope contains thirteen modules. The first eight are the
core of version 1.

| Module | What it records | Main outputs |
| --- | --- | --- |
| **Land and plots** | Owned or rented land, purchase price or rent, lease period, owner, documents; plots with area, soil type, water source, GPS location, and soil tests. | Land cost per plot; lease expiry alerts. |
| **Crop cycles** | Crop, variety, plot, area planted, planting date and time, status (planned, nursery, transplanted, growing, harvesting, closed), and expected versus actual yield. | Cycle timeline; cost and yield per cycle. |
| **Nursery** | Seed lots bought (variety, supplier, quantity, cost), sowing date, germination and survival checks, condition notes and photos, transplant date and quantity, and losses with reason. | Survival rate; seed-to-field conversion. |
| **Daily care and reminders** | Recurring tasks per crop and stage: watering, fertilizing, weeding, spraying, pruning, staking, thinning, and scouting; completion state (done, skipped, or delayed) with photo and note. | Daily task list; overdue tasks. |
| **Daily activity log** | Free-text diary, weather, photos, and who worked on what. | Daily update and report. |
| **Labour** | Casual workers, task, plot, start and end time, hourly rate, amount owed, and paid status. | Weekly pay summary; labour cost per task. |
| **Machinery** | Owned or hired equipment, hours, fuel, maintenance, task, and plot. | Machinery cost per acre. |
| **Expenses** | Category, amount, date, and allocation to plot or cycle (splittable). | Cost breakdown per cycle. |
| **Inputs and stock** | Seeds, fertilizer, chemicals, and fuel; purchases, usage per task and plot, and stock levels. | Low-stock alerts; application history. |
| **Irrigation** | Water source, pump hours, and electricity or fuel cost. | Water cost per cycle. |
| **Harvest and sales** | Quantity, grade, losses, storage and transport, buyers, price, payments received, and amounts owed to the farm. | Yield; revenue; receivables. |
| **Planning and budgets** | Season plan, crop calendar, budget versus actual, and rotation history. | Next-season plan. |
| **Issues and learning** | Pests and diseases with photos, treatment and outcome, and lessons per cycle. | Issue history per crop. |

### Reports and dashboard

Reports include daily, weekly, and monthly summaries; cycle reports; cost and
labour breakdowns; nursery survival reports; yield comparisons across plots;
and season summaries. The dashboard shows today's tasks, overdue tasks, stock
alerts, and cash position.

### Reminders

Reminders are generated from care templates (for example, weed every 14 days
after transplant) and can be delivered in the app, by SMS, or by WhatsApp.
Weather-aware rules, such as skipping watering after rain, are planned for
version 2.

## Reference data and crop economics

The platform provides standard agricultural reference data and a crop
economics model. A farmer can generate a plan for a crop in a region, then
compare the plan with what actually happened during the crop cycle.

The initial economics template is the founder's one-acre bell pepper model in
Tanzanian shillings (TZS). It covers seeds, survival, plants per acre, yield
per plant, one-off and seasonal costs, per-kilogram harvest costs, price,
monthly cash flow, break-even, and profit.

### Reference data

| Data | Content | Used for |
| --- | --- | --- |
| **Regions and districts** | Tanzanian regions and districts, agro-ecological zone, and altitude. | Choosing defaults for a farm. |
| **Climate** | Rainfall pattern (one or two rainy seasons), monthly rainfall and temperature normals, and frost or heat risk. | Planting windows, crop calendar, and weather-aware reminders. |
| **Soils** | Common soil types per region, pH range, and typical fertility notes. | Suitability and fertilizer guidance. |
| **Crops** | Master crop list: production mode (nursery or direct), cycle length, spacing, plants per acre, expected yield per plant and its unit, stage templates, and care templates. | Crop cycles and reminders. |
| **Regional crop profile** | Most-grown and dominant crops per region, with suitability rating. | Suggesting what to plant. |
| **Crop economics template** | Cost lines per acre from seed to market, per-kilogram harvest costs, expected price range, and timing for costs and harvest. | Plan generation. |
| **Weather** | Monthly normals per region; a live forecast feed is planned for version 2. | Reminders and season planning. |
| **Input and market prices** | Fertilizer, seed, chemicals, labour day rate, land rent, transport, and crop farmgate prices, each by region and date. | Costing and break-even. |

### Value precedence and provenance

Plans draw from three data layers, with the farm's own values taking
precedence:

1. **Platform defaults:** Curated by the platform owner.
2. **Regional values:** Override platform defaults for the selected region.
3. **Farm values:** Entered by the user, override both other layers, and are
   used in that farm's plans.

Every value stores its unit, region, date, and source. Values are labelled as
one of:

- **Benchmark:** A converted or published figure.
- **Local quote:** A price obtained locally.
- **Your actual:** A value recorded by the farm.

These labels keep the strength of each figure visible. In the bell pepper
model notes, for example, only the seed price is a local quote; the other
costs were converted from Kenyan benchmarks. Prices are dated and flagged as
stale after a defined period.

### Plan-to-actual workflow

1. Select a crop, region, area, and planting date. The system fills the
   template using the three data layers.
2. Review and edit assumptions, then save the result as the **plan** for a
   crop cycle. Multiple scenarios (such as expected, low price, and low yield)
   can be saved side by side.
3. Generate a plan document containing assumptions, monthly cash flow, income
   summary, and break-even. It should follow the bell pepper workbook layout
   and be available as a spreadsheet and PDF.
4. As the crop cycle runs, the farm-operation records populate actuals.
5. A **plan vs actual report** compares each line, shows its variance, and
   identifies the driver, such as survival, yield per plant, price, cost line,
   or timing.
6. At cycle close, the farm can update its own reference values from actuals,
   so the next plan starts from its real results.

### Economics model mapping

| Plan line | Actual comes from |
| --- | --- |
| Seed grams, seeds per gram, and total seeds | Nursery batch: seed lot and quantity sown. |
| Germination and survival rate | Nursery checks and transplant counts. |
| Plants for transplant | Transplants: quantity moved. |
| Seed, land preparation, nursery, transplanting, irrigation, fertilizer, and weeding costs | Expenses, work entries, machine jobs, and stock usage, allocated to the cycle by category. |
| Yield per plant and total yield | Harvests: quantity by date, divided by plants transplanted. |
| Harvest, packaging, and transport cost per kilogram | Labour entries and expenses tagged to harvest. |
| Farmgate price | Sales: price per unit received. |
| Monthly cash flow | Expenses and sales grouped by month. |
| Profit, cost per kilogram, and break-even | Calculated from actuals using the same method as the plan. |

### Scenarios and stress tests

A plan has a base case. The user can change price, yield, survival, and any
cost line to see the effect on profit and break-even. The bell pepper file is
identified as a best-case model without a downside case, so low-price and
low-yield scenarios should be generated by default.

### Future farm benchmarks

With user consent, anonymised actuals (such as yield per plant and cost per
acre by crop and region) may improve platform defaults over time. This depends
on a clear consent and privacy policy being defined before the feature is
built.

### Data upkeep and initial scope

Weather normals, prices, and crop data require sources and regular updates.
Version 1 should launch with a small set of crops and regions the founder can
verify. Every figure should be labelled, and users should be able to enter
their own values from the start.

## Investment and contract farming

An agreement links an investor, a farmer, and one or more crop cycles. It
tracks money and crop owed until the agreement closes. The investor can also
be the farmer's own farm owner, making it possible to compare returns on
owner-funded cycles with returns on deals funded by others.

### Deal types

| Type | How it works |
| --- | --- |
| **Cash loan, cash repayment** | Principal, interest, and a repayment schedule. |
| **Loan repaid in crop** | The investor advances money or inputs; the farmer repays in kilograms or bags at harvest. |
| **Input advance with offtake** | The investor supplies seed, fertilizer, or labour money and has the right to buy the harvest at an agreed price, with the advance deducted. |
| **Profit or revenue share** | The investor funds a cycle and receives an agreed percentage of sales or profit. |
| **Land or equipment lease** | An owner leases an asset for rent or a share of the crop. |

### Crop repayment pricing

Each agreement selects one pricing rule, since crop valuation is a common
source of disputes:

- Fixed price agreed upfront.
- Market price on delivery day, using a named reference market.
- Market price with a floor and a ceiling.
- Fixed quantity regardless of price.

Delivered crop is converted into a credit against the amount owed. The
remaining balance is shown in both money and crop.

### Monitoring and alerts

- **Exposure dashboard:** Money out, expected return, crop owed, overdue items,
  and risk by farmer and crop.
- **Crop-linked monitoring:** The investor can view the borrower's cycle
  progress, photos, and cost summary within the access scopes the farmer
  allows.
- **Alerts:** Upcoming delivery due dates, harvest completed but not delivered,
  late payment, and forecast yield below the amount needed to repay.
- **Yield-versus-obligation check:** Compare forecast yield with the amount
  owed before harvest (for example, 10 bags expected against 15 bags owed).
- **Side-selling check:** Compare harvest sales with deliveries to the
  investor.
- **Return calculation:** Return on investment and annualised return per deal,
  including losses and defaults.
- **Statements:** Printable balance statement per agreement for both parties.

## Accounts, roles, and permissions

Farmers and investors have separate logins. An agreement is the only bridge
between an investor and a farm's data.

### Accounts and access model

- **One user, several roles:** A person can have a farmer account (with a farm
  workspace), an investor account (with a portfolio), or both.
- **Farm privacy:** Farm data stays private to the farm. Investors get no
  general farm access; they can only see data permitted by an agreement.
- **Invitation flow:** Either party can create a draft agreement and invite
  the other by phone or email. Once accepted, it becomes a shared record.
- **Agreement-specific access scopes:** The farmer chooses whether to share
  cycle progress, photos, cost summaries, and harvest records. Wages, other
  crops, and other investors' deals are never exposed through that agreement.
- **Closing:** When an agreement closes, access becomes read-only history and
  ends if the farmer wishes.
- **Audit log:** Views and changes to every shared agreement are recorded with
  the responsible person.

### Roles and permissions

| Role | Sees | Can do |
| --- | --- | --- |
| **Farm owner** | Whole farm workspace. | Everything on the farm; create agreements and set access scopes. |
| **Farm manager** | Assigned farm and plots. | Log work, hours, and inputs; cannot change financial settings. |
| **Investor** | Own portfolio and scoped farm data for each agreement. | Create agreements, record advances, confirm deliveries, and download statements. |

### Two-sided confirmation

Money and crop movements require both parties to agree before they count
toward the shared balance:

1. The investor records an advance of 2,000,000 TZS; the farmer confirms
   receipt.
2. The farmer records a delivery of 20 bags; the investor confirms receipt and
   weight.

Unconfirmed entries remain pending. Disputed entries are flagged with notes,
so both parties can see the same agreement balance and its status.

## Document system

The platform stores uploaded documents and generates new documents from
information already entered in the system.

### Generated documents

- Loan, crop-repayment, and input-advance or offtake agreements
- Land and equipment lease agreements
- Receipts for advances given and payments received
- Delivery notes and weighing slips
- Repayment and balance statements
- Reminders or demand letters for late repayment
- Casual labour pay sheets and worker engagement letters
- Daily, crop-cycle, and season farm reports
- Farm profile for presenting to investors

### Document generation

Templates contain placeholders (such as the farmer's name, principal, pricing
rule, and delivery dates) populated from the relevant agreement or farm
records. A clause library allows clauses to be enabled or disabled, including
late-delivery penalties, default terms, and force majeure for drought.

Generated documents are PDFs, with editable Word output also available, in
English and Swahili.

### Uploads, access, and sensitive files

Users can upload and tag signed contracts, ID copies, land and lease papers,
receipts, weighing slips, and photos. Each file is linked to the agreement,
party, or crop cycle it belongs to and follows the access scopes of that
record. Sensitive files such as ID copies are restricted and encrypted.

### Versioning and signing

A signed document is locked. Any change creates an amendment as a new version;
a hash of each final file is stored to help detect later alteration.

Version 1 does not support signing inside the app. The intended workflow is:

1. Generate the document, marked **"Draft, not legally reviewed."**
2. Have a lawyer approve the template once.
3. Have the parties sign on paper or as advised by their lawyer.
4. Upload the signed scan, mark it **Signed**, lock it, and store its hash.

Document statuses are **Draft**, **Sent for review**, **Approved**, **Signed**,
and **Superseded**. A dedicated e-signature service may be integrated later.

Templates are starting points, not legal advice. Before real use, a lawyer
must verify whether in-app signatures would be enforceable in Tanzania and
whether the clauses are adequate. Until then, generated documents are labelled
as templates.

## Technical architecture

### Recommended direction

Build the product as a standalone web application that can be installed as a
progressive web app (PWA) on phones. Given the current Next.js and Prisma
project foundation, version 1 should use a **modular monolith**: one
application with clear domain boundaries, rather than a separately deployed
API server and multiple services. This keeps deployment and operations
efficient while the product and its usage are still being validated. Keep
domain logic behind server-side service/data-access boundaries so a separate
API or worker can be introduced later without rewriting core rules.

### Application and offline use

- **Application:** Continue with Next.js for the web interface and
  server-side application logic. Organize code around product areas such as
  farms, crop cycles, inventory, agreements, and documents.
- **PWA and offline queue:** Cache the application shell and use IndexedDB for
  field entries and a durable sync queue. Upload queued changes when a
  connection returns and show whether each entry is pending, synced, or needs
  attention.
- **Conflict handling:** Do not silently overwrite shared agreement records.
  Advances, payments, and crop deliveries remain pending until the other party
  confirms them; conflicting edits should be visible and auditable.

### Server, database, and tenant security

- **Server access:** Enforce authentication, role checks, farm membership, and
  agreement access scopes on every server request. Use role-based permissions
  together with relationship and scope checks; a role alone must not grant
  access to another farm's data.
- **Database:** Use PostgreSQL with Prisma for the primary relational store.
  Every farm-owned record carries `farm_id`; queries must scope records to the
  authenticated user's farm membership or an explicitly permitted agreement.
- **Row-level security:** Treat PostgreSQL row-level security as
  defense-in-depth, not a substitute for scoped application queries. Adopt it
  only with a verified connection and transaction strategy that reliably sets
  tenant context for every operation.
- **Agreement visibility:** Expose investor data through narrowly scoped
  agreement queries; never grant general farm access. Keep confirmation state
  and audit history for shared financial and crop movements.

### Files, documents, and notifications

- **File storage:** Store photos and documents in private object storage, not
  in the application database or public web directory. Authorize each upload
  and download against its farm, agreement, and access scopes. Encrypt
  sensitive files and use short-lived access links where appropriate.
- **Document generation:** Generate PDF and editable Word documents
  server-side from versioned templates and stored records. Store final files
  and their hashes; preserve signed versions as immutable history.
- **Tasks and notifications:** Generate recurring care tasks from crop-stage
  templates and deliver in-app notifications. Use a scheduled job or worker
  for reliable recurring work; begin with the simplest deployment-compatible
  option and separate it from the web app only when operational needs justify
  it. SMS and WhatsApp delivery are version 2.

### Localisation, security, and operations

- **Internationalisation and units:** Support English and Swahili in the
  interface and documents. Store explicit units and currencies; use TZS as
  the default while supporting multi-currency values.
- **Security operations:** Maintain an audit log, protect sensitive files,
  enforce per-agreement access scopes, and provide tested backups and restore
  procedures.
- **Billing:** Defer subscriptions and per-account limits (farms, plots, or
  users) to version 3.

### Delivery approach

Start with the existing Next.js and Prisma foundation, PostgreSQL, core farm
operations, and a deployable PWA. Establish reliable crop-cycle, cost, and
harvest records before activating agreement workflows in version 2. Add
external messaging, advanced document output, strict database-level tenant
policies, and independently deployed services as the corresponding
requirements and operational evidence justify them. Avoid introducing
separate services or infrastructure before they solve a demonstrated need.

## Draft data model

This is an initial entity and relationship inventory to guide a future Prisma
or SQL schema; it is not yet a database implementation. Every farm-owned
table carries `farm_id`. Money values store both amount and currency, and
quantities store their unit.

### Core entities

| Area | Tables | Key fields and links |
| --- | --- | --- |
| **Accounts** | `users`, `accounts`, `account_roles`, `farms`, `farm_members`, `invitations` | A user can have multiple roles; a farm has members with roles such as owner or manager. |
| **Land** | `land_holdings`, `plots` | A holding records tenure (owned or rented), cost or rent, period, and owner. A plot links to a holding and records area, soil type, water source, and GPS location. |
| **Crops** | `crop_types`, `stage_templates`, `care_templates`, `crop_cycles` | A crop type has a nursery or direct-sown mode, stages, and care rules. A cycle links to a plot and crop type and records variety, area, dates, status, and expected and actual yield. |
| **Nursery** | `nursery_batches`, `nursery_checks`, `transplants` | A batch links to a cycle and seed lot and records sowing date and quantity. Checks record germination, survival, condition, and photos. Transplants record quantities moved or discarded and the reason. |
| **Daily work** | `tasks`, `activity_logs`, `issues` | A task links to a cycle or plot and records type, due date, status (done, skipped, delayed), responsible person, and photos. Tasks can be generated from care templates. |
| **Labour and machinery** | `workers`, `work_entries`, `payments`, `equipment`, `machine_jobs` | A work entry links a worker, task, and cycle and records start, end, rate, amount, and paid status. A machine job records equipment ownership or hire, hours, fuel, and cost. |
| **Inputs and stock** | `items`, `stock_movements`, `suppliers` | Movements record purchases, usage (linked to task, plot, and cycle), or adjustments. |
| **Money and produce** | `expenses`, `harvests`, `sales`, `buyers`, `receipts` | An expense records category, amount, and allocation to a plot or cycle. A harvest links to a cycle and records quantity, grade, and loss. |
| **Planning** | `season_plans`, `budgets`, `budget_lines` | A season plan and its budget lines support budget-versus-actual tracking. |
| **Agreements** | `parties`, `agreements`, `agreement_parties`, `agreement_access_scopes`, `agreement_advances`, `agreement_schedule`, `agreement_deliveries`, `agreement_payments`, `agreement_events` | An agreement records type, parties, linked cycles, principal, interest, pricing rule, default terms, and status. Advances, deliveries, and payments record confirmation status for both parties. |
| **Documents** | `document_templates`, `clauses`, `documents`, `document_versions`, `signatures`, `file_attachments` | A document links to a record and template and tracks version, file hash, and signing status. |
| **Platform** | `audit_log`, `notifications`, `subscriptions` | Records who did what and when, reminder delivery, and plans and billing per account. |

### Key relationships and invariants

- Labour entries, machine jobs, stock usage, and expenses reference
  `cycle_id` so cycle costs can be calculated consistently.
- Harvests can link to agreements to show how much produce is already
  committed.
- Agreement deliveries reference a harvest and can include the weighing slip
  as an attachment.

### Additional entities identified in research

These extend the core inventory and should be assessed for scope and priority
before implementation:

- **Supply quality:** Add lot and batch references to supplier-linked stock
  movements to compare input quality by supplier.
- **Advice and groups:** `advisors`, `advice_requests` (photo, question,
  answer, reviewer), `farmer_groups`, `group_members`, and
  `group_agreements` for optional joint liability; `aggregation_lots`.
- **Consent and data rights:** `track_record_reports`, `consents` (who may see
  what, for how long, and whether access was withdrawn), and `data_requests`
  for export and deletion.
- **Buyer performance:** `buyer_events` for agreed and actual pickup dates,
  quality grade agreed and given, rejection reason and photos, and payment due
  and paid dates.
- **Weather and losses:** `weather_logs` for rain gauge and temperature
  entries per plot, and `loss_events` for type, date, affected area, and
  photos.
- **Produce handling:** `produce_lots`, `storage_checks`, and `loss_records`
  tracking losses by stage (field, handling, storage, transport).
- **Price history:** `price_log` for crop, market, grade, price, unit, date,
  and source.

### Further entities from the second research pass

- **Land tenure:** Add tenure type, document status, and renewal date to
  `plots`; add `tenure_disputes`.
- **Crop health:** `scouting_logs` (pest, severity, photos),
  `spray_records` (product, active ingredient, batch, dose, date, and
  pre-harvest interval), and consent-scoped `outbreak_alerts`.
- **Labour planning:** `labour_plans` (person-days per week), `worker_pool`,
  `callouts`, and `wage_benchmarks`; add a mobile-money reference to
  `payments`.
- **Lender compliance:** `lender_attestations` (licensing position, date, and
  document) linked to `agreements`; add an agreement type tag (loan, input
  advance, sale).
- **Farmer programmes:** Add an optional national farmer ID to `farmers` and
  add `subsidy_receipts` for input, quantity, price, and date.

## Literature review: farmer challenges and product responses

This section records findings and feature ideas from the supplied literature
review. The evidence is context for product decisions, not a set of guaranteed
local benchmarks. Several sources are from other countries, older studies, or
secondary summaries; see the evidence limitations below. Verify sources and
legal interpretations before relying on them in product behavior or generated
documents.

### Challenges, evidence, and platform responses

| Challenge | Evidence noted in the review | Potential platform response |
| --- | --- | --- |
| **Input use and quality** | Tanzania uses about 19 kg/ha of fertilizer against a continental target of 50, and improved seed is used on about 20% of planted area ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)). A Uganda study found tested fertilizer missing 30% of its nutrient; only 20% of samples applied to locally bought hybrid seed were profitable ([VoxEU](https://cepr.org/voxeu/columns/sub-standard-quality-fertilisers-and-hybrid-seeds-makes-adoption-modern-inputs)). | Capture supplier and lot/batch on input purchases and usage; compare survival and yield by supplier. |
| **Limited extension services** | Only 7% of Tanzanian farming households received extension in 2020, down from 67% in 2008; the review reports a gap of about 5,000 crop extension workers ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)). | Advisor role, photo-based advice requests, and agronomist-reviewed care templates. |
| **Finance gap and perceived risk** | The review reports that 3.8% of Tanzanian agricultural households received credit in 2019/20, mostly informal. An African farm-lending review describes banks meeting under 3% of an estimated USD 450 billion smallholder demand and identifies perceived risk as a major barrier; it reports One Acre Fund repayment near 99% with bundled inputs, training, and group liability ([One Acre Fund brief](https://oneacrefund.org/sites/default/files/2023-09/Scaling_Up_Agricultural_Credit_In_Africa_Farm_Finance.pdf)). Apollo Agriculture uses field-officer data and satellite imagery and says free imagery is inadequate for farms under two acres ([GSMA](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/blog/ai-driven-smallholder-farmer-lending-in-africa-insights-from-apollo-agriculture/)). | Consent-based farmer track-record reports, farmer groups, and field agents who collect and verify data. |
| **Contract farming failures** | The review describes side-selling when prices rise, buyer rejection when prices fall, strict quality standards, and weak enforceability ([review](https://openagriculturejournal.com/VOLUME/14/PAGE/59/FULLTEXT/)). In a Ghana pineapple scheme, 56% of farmers who had ever joined had exited by 2009; some firms did not collect fruit and local alternatives could pay roughly half as much ([Barrett et al.](https://marcfbellemare.com/wordpress/wp-content/uploads/2011/09/BarrettetalSmallholderParticipationFinalVersion.pdf)). One cited study found conditional bonuses reduced contract breaches. | Track buyer obligations as carefully as farmer obligations; agree quality grades in advance; require evidence for rejections; consider compliance bonuses. |
| **Climate stress** | African agricultural productivity growth is estimated to be 34% lower since 1961 than it would have been without climate change. Warming above 2°C is projected, with medium confidence, to reduce staple crop yields across most of Africa ([IPCC AR6, chapter 9](https://www.ipcc.ch/report/ar6/wg2/chapter/chapter-9/)). A World Bank report projects Tanzania's maize, beans, and cassava moving into deficit by 2030 under business as usual ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)). | Climate stress scenarios in plans, farm weather logs, and a crop-diversification view across plots. |
| **Insurance access and trust** | The review cites index-insurance uptake of about 16% at full price and 38% with a 50% subsidy, with distrust and basis risk as barriers ([ATAI](https://www.atai-research.org/wp-content/uploads/2016/02/ATAI-Emerging-Insights-Risks-3-page-7.14.16-1.pdf)). | Do not make insurance a platform revenue assumption. Keep loss-event records and evidence packs for potential partners. |
| **Post-harvest losses** | Estimates conflict. FAO figures cited by the World Bank put losses at up to 37% from production to consumption, including 8% in handling and storage; farmer-reported maize losses in Malawi, Tanzania, and Uganda were 1.4–5.9% of national harvest. Improved-storage use ranged from 0.6% in Uganda to 12% in Tanzania ([World Bank](https://www.worldbank.org/en/programs/africa-myths-and-facts/publication/is-post-harvest-loss-significant-in-sub-saharan-africa)). The review says Tanzanian fruit and vegetable growers market about 60% of produce because of perishability ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)). | Measure losses on the farm by stage; track produce lots and storage conditions. |
| **Markets and prices** | Over 80% of Tanzanian farmers reportedly name low prices as their main challenge and under 10% name market access; over 95% farm under 2 ha and market about 20% of their food ([World Bank, 2024](https://documents1.worldbank.org/curated/en/099121924163520324/pdf/P18018715c2c9e0651b367172fb62ee6b60.pdf)). | Price history, buyer history, and—after group features are available—group selling. |
| **Digital adoption barriers** | A smallholder digitisation review, mainly focused on South Africa, identifies poor infrastructure, limited finance, low digital literacy, device and data costs, unreliable connectivity, and distrust. It finds more tools for planning, production, and market access than for storage, transport, and post-harvest ([Frontiers, 2025](https://www.frontiersin.org/journals/sustainable-food-systems/articles/10.3389/fsufs.2025.1583224/full)). | Field-agent support, SMS reminders, low-data operation, and post-harvest workflows. |
| **Personal data protection** | The review states that Tanzania's Personal Data Protection Act took effect on 1 May 2023 and says data controllers/processors must register with the Commission. It notes sensitive data includes financial transactions, cross-border transfers are restricted, and corporate fines can reach TZS 5 billion ([ALN](https://aln.africa/insight/tanzanias-personal-data-protection-act-comes-into-effect/), [Clyde & Co](https://www.clydeco.com/en/insights/2023/02/tanzania-personal-data-protection-act-of-2022)). | Consent ledger, retention rules, data export and deletion, hosting review, and confirmation of company registration obligations. |

### Additional findings from the second review pass

| Challenge | Evidence noted in the review | Potential platform response |
| --- | --- | --- |
| **Land tenure** | As of 2021, 864,000 customary right certificates had been issued against about six million rural households (roughly 14% by simple division). A 2017 survey found 55% of rural respondents had no documents proving land rights. The project document links secure tenure with greater long-term investment ([World Bank project document, 2021](https://documents1.worldbank.org/curated/en/466181641925880285/pdf/Tanzania-Land-Tenure-Improvement-Project.pdf)). | Record tenure per plot, document status, and renewal date; show relevant tenure information to an investor before funding. |
| **Pests and disease** | Farmer-reported fall armyworm yield losses were 26% in Ghana and 35% in Zambia, although recall-based figures may overstate losses; a second Ghana method gave up to 17%. No control was used by 14.7% of Ghanaian and 36.5% of Zambian farmers. Tanzania's annual maize loss of USD 399 million is modelled, not survey-based ([CABI, 2018](https://www.cabi.org/wp-content/uploads/FAW-Evidence-Note-October-2018.pdf)). | Scouting and spray records (product, active ingredient, batch, dose, date), pre-harvest interval warning, and agronomist-reviewed integrated pest management guidance, including non-chemical options. |
| **Casual labour and youth** | In Kilimanjaro and Manyara in 2017, about half of farmers hired daily workers for two-to-three-day jobs at USD 1.20–6.50 per day, usually within their village. An SMS job-posting app reduced pay dispersion by 16–40% but did not increase average wages or job numbers ([CEGA](https://cega.berkeley.edu/collection/facilitating-agricultural-labor-markets-in-rural-tanzania/)). A 2019 report says rural youth participation in the agrifood system rose from 60% to 63%, off-farm agrifood enterprises doubled from 10% to 20%, and farming participation fell ([IFAD, 2019](https://www.ifad.org/en/web/latest/-/blog/measuring-youth-participation-in-agriculture-in-tanzania-and-malawi)). | Turn crop plans into weekly person-day forecasts; maintain a casual worker pool, one-way SMS call-outs, and wage benchmarks based on recorded pay. Workers do not need platform logins for this model. |
| **Lending licensing** | The Bank of Tanzania notice says lending without a valid licence is an offence under section 16(1) of the Microfinance Act 2018, including loans made through platforms, and advises borrowers to use signed contracts and check the licensed-lender list ([Bank of Tanzania notice, 13 May 2024](https://www.bot.go.tz/Adverts/PressRelease/en/2024051310172548.pdf)). | Record agreement type and lender attestation; do not let a loan-type agreement activate without the required legal review/attestation. The platform itself should not lend or hold funds. |
| **National farmer registry** | By October 2022, 1.3 million farmers were reportedly registered in the subsidised-fertilizer system, against a target of seven million by the end of December 2022; about half had received passwords and unique identity numbers ([Daily News, 2022](https://dailynews.co.tz/1-3-million-farmers-registered-for-subsidised-fertiliser/)). | Optional national farmer ID and subsidised-input receipt records; consider registry integration only if available and appropriate. |

### Feature roadmap informed by the review

The following is a proposed staging of the review's feature ideas; it is
subject to product prioritisation and legal review.

| Feature | Initial scope / version |
| --- | --- |
| Supplier and input-lot capture on purchase and usage | V1 capture; V2 supplier scorecards. |
| Tenure record per plot (type, documents, renewal date, boundary, dispute log) | V1 record; V2 tenure-risk flag in agreements. |
| Pest and disease scouting, spray records, batch and dose | V1 logs; V2 pre-harvest interval warning. |
| Farm weather log (rain-gauge entries) | V1 log; V2 climate stress scenarios. |
| Optional national farmer ID and subsidised-input receipts | V1 fields; V3 government-registry integration if available. |
| Consent ledger, retention rules, data export and deletion, hosting decision, company-registration review | V1 foundation. |
| Supervisor data entry | V1. |
| Advisor role, scoped agronomist access, photo-based advice requests, reviewed care templates | V2. |
| Consent-based farmer track-record report (verified cycles, yields, costs, repayments) | V2. |
| Field-agent mode for entering and verifying multiple farms; SMS and low-data screens | V2, building on V1 supervisor entry. |
| Buyer obligations and performance (pickup dates, agreed grades, evidence-backed rejection, payment delays) | V2. |
| Agreement fairness checks, including repayment-to-expected-income warning, compliance bonus clause, and written agreement requirement | V2; subject to legal review. |
| Farmer groups and cooperatives, optional joint liability, and produce aggregation | V2 start; V3 fuller group-selling capability. |
| Loss events with dated photos, weather records, affected area, and partner evidence pack | V2. |
| Produce lots, storage tracking, and stage-by-stage losses (field, handling, storage, transport) | V2. |
| Market price log | V2; group selling in V3. |
| Casual worker pool, labour planner, one-way SMS call-outs, wage benchmarks, and mobile-money payment reference | V2. |
| Consent-based outbreak alerts between nearby farms | V2. |
| Lender licensing guard and attestation | V2, following legal review; no loan agreement activates before required checks. |

Until a lawyer confirms how Tanzanian law applies to private farmer-investor
deals, loan-type agreements remain behind the legal-review step in the
document workflow. Input advances and offtake contracts may be treated
differently from loans; this distinction also requires legal advice.

### Evidence and product limitations

- The Microfinance Act text was not available to the review author, so whether
  a particular private loan constitutes the business of lending is
  unconfirmed.
- Fall armyworm figures are from farmer recall in Ghana and Zambia; the
  Tanzania figure is modelled. The cited evidence does not cover pests of
  vegetables such as bell pepper.
- Land-tenure figures use a 2021 project document and a 2017 survey; youth
  figures are from 2019; registry figures are from 2022. Current status was
  not checked.
- The input-quality study is from Uganda, not Tanzania. The digital adoption
  review mainly focuses on South Africa.
- The farm-lending brief reports figures from around 2013–2014.
- Published post-harvest loss estimates differ substantially; the platform's
  own consistently collected measurements may be more useful than a general
  benchmark.
- The data-protection summary relies on law-firm notes rather than direct
  analysis of the Act. A lawyer should confirm registration steps and
  cross-border data rules.
- A PNAS study on smallholder yield trends in sub-Saharan Africa could not be
  opened by the review author; no findings from it are included here.

### Realistic contribution and initial users

Software cannot by itself fix contract enforcement, roads, cold chains,
climate change, or the cost of insurance. Its realistic contribution is to
make these challenges visible and provide reliable, permissioned evidence.

The contract-farming review cites research where 62% of contract farmers had
notably larger landholdings or assets than their neighbours. Early adopters
may therefore be commercial and mid-sized farms similar to the founder's.
Reaching the smallest farmers is likely to require group and field-agent
models, not only individual accounts.

## Product roadmap

The roadmap stages the product around a key dependency: investment agreements
rely on trustworthy crop-cycle, cost, and harvest records. Version 1 therefore
establishes a useful farm tracker first; investor agreements follow in version
2.

| Version | Scope | Completion evidence |
| --- | --- | --- |
| **V1: Farm operations** | Accounts and farm setup; land and plots; crop types with stage and care templates for nursery and direct-sown crops; crop cycles; nursery batches, survival checks, and transplants; daily task list and reminders; daily activity log; workers, hours, and pay summary; cycle-allocated expenses; basic inputs and stock; document upload and storage; daily, cycle-cost, labour, and nursery-survival reports; offline-first PWA; English and Swahili. Also include the literature-review V1 items described below. | The founder completes a real crop cycle end to end and obtains a cost report. |
| **V2: Harvest, investment, and documents** | Harvest and sales with profit per cycle; budgets and season planning; weather-aware reminders; SMS and WhatsApp reminders; all five agreement types; farmer and investor logins; invitations, access scopes, and two-sided confirmation; crop-repayment pricing rules; investor dashboard and alerts; document templates, clause library, document status flow, and signed-copy upload. Also include the literature-review V2 items described below. | A real agreement runs from advance to crop repayment, with both parties confirming movements. |
| **V3: Product** | Subscription billing and plan limits; e-signature integration; investor portfolio analytics; exports; onboarding for new farms; administration tools. Add full farmer-group and cooperative capabilities, group selling, the market-price network, and government farmer-registry integration if available. | Other farmers and investors can sign up and pay. |

### Literature-review roadmap additions

These additions are included in the version scope above and retain the
proposed sequencing from the research notes:

- **V1:** Supplier and input-lot capture; farm weather log; supervisor
  field-entry capability; consent ledger with retention, export, and deletion
  rules; plot tenure records; pest and disease scouting and spray records;
  optional national farmer ID.
- **V2:** Advisors; consent-based track-record reports; buyer obligations and
  performance records; agreement fairness checks; climate stress scenarios;
  loss-event evidence packs; produce lots and storage tracking; SMS reminders;
  pre-harvest interval warnings; consent-based outbreak alerts; labour
  planner and SMS call-outs; lending licensing guard.
- **V3:** Full group and cooperative features; group selling and market-price
  network; government farmer-registry integration if available.

Loan activation must remain subject to legal review and the licensing guard.
The platform does not lend or hold funds. See the legal and evidence caveats
in the literature review and document-system sections.

## Decisions and working assumptions

| Topic | Decision or current position |
| --- | --- |
| **Currency** | TZS is the default; a farm can switch to USD. Store the currency with each money value. |
| **Payment methods** | Record whether each advance or repayment was made by mobile money or bank, together with its reference number. The platform records payments but does not process them. |
| **Worker logins** | None for now. An owner or supervisor logs workers' names, rates, work, and hours. One-way SMS call-outs are planned for version 2. |
| **Documents** | Generate documents from system data; have a lawyer approve templates; parties sign on paper or as their lawyer advises; upload the signed copy. No in-app signing in version 1. |
| **Region and first crop** | Not fixed. Each farm chooses its region, crops, calendar, units, and price source. The first real farm's needs will guide the initial crop templates. |
| **Interest, penalties, and lending licence** | A lawyer must confirm these before any loan agreement activates, using the legal review and licensing guard described in the literature review. |
| **Pricing model (hypothesis, not validated)** | Test a subscription per farm, tiered by acreage or crop cycles per season, with unlimited workers and supervisors and a free tier for small farms. Investors could join free up to an allowance of active agreements, then pay for additional agreements. SMS could be sold as credits. Offer seasonal or annual billing alongside monthly billing and accept mobile money. Do not take a percentage of loans or crop deals, to avoid presenting the platform as lender or broker. Validate prices with real farmers before committing. |

## Status

This is a working product reference. Product scope, architecture, and the data
model remain subject to refinement as more context is provided. Do not begin
feature implementation until the product context and initial scope are
confirmed.
