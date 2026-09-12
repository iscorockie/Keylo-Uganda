# KeyLo v1.1 risk feature catalog

The model should prefer consented, explainable aggregates over raw transaction histories. Raw mobile-money history is not assumed to be available through MTN or Airtel APIs.

## Subscriber and behavioural

- gnuGrid Mobile Credit Score or equivalent licensed CRB score
- Cross-network outstanding digital loans / Universal Loan Checker result
- Mobile-money inflow consistency over 3, 6 and 12 months
- Average monthly wallet turnover
- Airtime top-up regularity and average amount
- SIM tenure / active months
- Successful versus failed digital-loan repayments
- Frequency of large inflows as an income proxy

## Asset

- Vehicle age and mileage
- Uganda make/model residual-value score (Toyota Premio and Vitz are initial high-liquidity examples)
- Current market value estimate
- Ownership history and previous-finance flags where lawfully available

## Identity and traditional

- NIN verification state, never raw NIN in the scoring payload
- Formal CRB score and history length
- Declared income versus consented estimated income
- Formal, informal, business or gig employment type
- Kampala / upcountry location band, monitored for fairness and not used as an automatic exclusion

## Derived

- Affordability ratio: recommended monthly fee / estimated monthly capacity
- Debt-to-income proxy
- Stability score from SIM tenure and inflow consistency
- Combined score from 0–100 with tier A, B, C or Decline

Each feature needs a source, retrieval timestamp, consent id, missing-value treatment and model version in the score snapshot. Store reason codes for the top three drivers so a lender can explain the outcome.
