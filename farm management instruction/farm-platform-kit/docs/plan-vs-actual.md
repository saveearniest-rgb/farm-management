# Plan vs actual: the economics model

The first crop template is the founder's 1-acre bell pepper model in TZS (`fixtures/bell_pepper_1acre_model_tzs.xlsx`). The platform must be able to rebuild this model from stored assumptions, generate a document in the same layout, and later compare each line with what was actually recorded.

The workbook has three sheets: **Assumptions**, **Monthly Cash Flow** (9 months) and **Income Summary**.

## Warning about the numbers

- Only the seed price is a local quote. The other costs and the price were converted from Kenyan benchmarks, so label them `BENCHMARK`.
- The yield of 3.5 kg per plant over 13,600 plants is 47.6 tonnes per acre. That looks very high for open-field capsicum and is probably a best case. Keep it as test data only. Do not ship it as a default without a source.
- The model has no downside case. The platform must generate low-price and low-yield scenarios by default.

## Assumptions (inputs)

| Input | Value | Unit |
| --- | --- | --- |
| Seeds per gram | 160 | seeds/g |
| Seed purchased | 100 | g |
| Germination and nursery survival | 85% | |
| Seed cost | 120,000 | TZS |
| Land preparation | 217,000 | TZS |
| Nursery (trays, medium, labour) | 271,000 | TZS |
| Transplanting labour | 271,000 | TZS |
| Irrigation setup (drip, one-off) | 633,000 | TZS |
| Fertilizer and topdressing, whole season | 452,000 | TZS |
| Weeding and crop management labour, whole season | 542,000 | TZS |
| Harvest picking labour | 54 | TZS/kg |
| Packaging (crates) | 36 | TZS/kg |
| Transport to market | 54 | TZS/kg |
| Yield per plant | 3.5 | kg/season |
| Farmgate price | 1,627 | TZS/kg |
| Reference exchange rate | 2,340 | TZS per USD |

## Formulas

```
total_seeds          = seeds_per_gram * grams_purchased
plants               = total_seeds * survival_rate
total_yield_kg       = plants * yield_per_plant
establishment_cost   = seed + land_prep + nursery + transplanting + irrigation + fertilizer + weeding
variable_cost_per_kg = picking + packaging + transport
harvest_cost         = total_yield_kg * variable_cost_per_kg
revenue              = total_yield_kg * price_per_kg
total_cost           = establishment_cost + harvest_cost
profit               = revenue - total_cost
margin               = profit / revenue
cost_per_kg          = total_cost / total_yield_kg
profit_per_kg        = price_per_kg - cost_per_kg
roi                  = profit / total_cost
break_even_price     = total_cost / total_yield_kg
break_even_yield_kg  = total_cost / price_per_kg
usd_value            = tzs_value / exchange_rate
```

## Monthly timing (nine-month season)

| Cost or income | Month(s) |
| --- | --- |
| Land preparation, seed, nursery | 1 |
| Transplanting labour, irrigation setup | 2 |
| Fertilizer | Half in month 2, half in month 3 |
| Weeding and crop management | Spread equally over months 3 to 8 |
| Harvest quantity, harvest costs and revenue | Spread equally over months 4 to 9 |

The workbook notes that real picking ramps up, peaks and tapers. The platform should let the user reshape the harvest curve instead of forcing an even spread.

## Expected outputs (use these as test assertions)

| Output | Value |
| --- | --- |
| Total seeds | 16,000 |
| Plants for transplant | 13,600 |
| Total yield | 47,600 kg |
| Establishment and management cost | 2,506,000 |
| Variable cost per kg | 144 |
| Harvest variable cost | 6,854,400 |
| Revenue | 77,445,200 |
| Total cost | 9,360,400 |
| Profit | 68,084,800 |
| Profit margin | 87.91% |
| Cost per kg | 196.65 |
| Profit per kg | 1,430.35 |
| ROI on total cost | 727.37% |
| Break-even price | 196.65 TZS/kg |
| Break-even yield | 5,753.17 kg |
| Revenue / cost / profit in USD | 33,096.24 / 4,000.17 / 29,096.07 |

Monthly management cost (months 1 to 9): 608,000; 1,130,000; 316,333.33; 90,333.33 (months 4 to 8, each); 0 in month 9.
Harvest per month (months 4 to 9): 7,933.33 kg, costing 1,142,400 and earning 12,907,533.33.
Net cash flow: -608,000; -1,130,000; -316,333.33; then 11,674,800 for months 4 to 8; 11,765,133.33 in month 9.
Cumulative cash flow reaches -2,054,333.33 in month 3 and 68,084,800 in month 9.

Rounding: compare to the cent. Do not round intermediate values.

## Where each plan line gets its actual value

| Plan line | Actual comes from |
| --- | --- |
| Seed grams, seeds per gram, total seeds | Nursery batch: seed lot and quantity sown |
| Germination and survival rate | Nursery checks and transplant counts |
| Plants for transplant | Transplants: quantity moved |
| Seed, land preparation, nursery, transplanting, irrigation, fertilizer, weeding costs | Expenses, work entries and stock usage, allocated to the cycle by category |
| Yield per plant and total yield | Harvests: quantity by date, divided by plants transplanted |
| Picking, packaging and transport cost per kg | Labour entries and expenses tagged to harvest |
| Farmgate price | Sales: price received per unit |
| Monthly cash flow | Expenses and sales grouped by month |
| Profit, cost per kg, break-even | Same formulas applied to actuals |

## Plan vs actual report

For every line show plan, actual, difference and percentage difference. Then name the main driver of the profit difference: survival rate, yield per plant, price, a specific cost line, or timing. A simple method: change one input at a time from plan to actual and record how much the profit moves.

## Scenarios

Every plan holds a base case. Create two more by default: low price (for example 30% below base) and low yield (for example 40% below base). The user can edit any input in any scenario. Show profit and break-even for all scenarios side by side.

## Plan document

Generate a spreadsheet with the same three sheets as the fixture, using real formulas so the user can change inputs, and a PDF of the summary. Show the source label (`BENCHMARK`, `LOCAL_QUOTE`, `FARM_ACTUAL`) next to every assumption.
