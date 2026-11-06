# Payment history, evidence decisions and reopening checks

Implemented 6 November 2026.

## PayPal history

Actual order details include a durable, timestamped history. Records distinguish API requests/responses, background reconciliation and verified webhook processing. Capture requests, observed buyer approval, pending captures, uncertain outcomes, verified captures, refund requests/outcomes, reversals and webhook receipt/processing/retry/duplicate handling are recorded. Times are server observation times, not inferred provider event times. Stable event keys suppress repeated identical observations; they are not an exhaustive log of every network attempt. Verified captures and adjustments record their history within the same transaction as the money/stock changes. History contains event types and provider references, never receipt bearer tokens or raw webhook payloads.

Existing orders retain current state but receive no fabricated historical timestamps. New observations are recorded going forward. Webhook evidence requires signature verification on ingress and provider checks during processing. Unit fixtures are not proof of a new sandbox or production delivery.

## Evidence to published result

Each product's expandable evidence view puts source prices, file names and excerpts next to the saved seller confirmation and current published snapshot. Other claims remain expandable. Each new saved decision captures its original claims, source hashes, result and explanation; later file changes do not rewrite this history. Older decisions explicitly indicate when claim snapshots are unavailable.

When a source referenced by the last ready decision changes or disappears, readiness requires rechecking that product. The seller must reconfirm before publishing. The prior published catalog stays unchanged until a successful publication. This check compares stored source hashes; it does not independently reparse file bytes during each readiness request.

## Reopening checklist

The always-visible shop editor checklist uses server-returned publishing blockers. It checks product details, allocation, stock confirmation, variant photo confirmation, conflicting price explanations, changed decision evidence, pickup instructions, unique included SKUs, shop state and rehearsal mode. Each affected product has a review link; missing pickup instructions link to shop details. Unsaved edits are also shown locally. The publish endpoint enforces the same server blockers. A passing checklist is publish readiness, not a claim that merchant onboarding or live payments have been proven.

## Validation

- Browser: isolated local workspace; saved $20 Blue mug decision with explanation, checklist updated from 0 to 1 ready, hid unused variants, published the test shop, and verified the evidence view showed the published $20 value.
- Final validation: all 193 automated tests passed; production build passed with the existing large vendor chunk warning.
- Regression: lost capture response reconciles once; timestamped capture/refund records stay repeat-safe; queued verified webhook fixtures record receipt and processing; changed evidence blocks publication without rewriting history; owner checks remain enforced.
- No new live Gemini request, PayPal transaction, merchant onboarding or external webhook delivery was used for this work.
