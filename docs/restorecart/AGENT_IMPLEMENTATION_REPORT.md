# Specialized recovery agents — 5 November 2026

## Implemented behavior

The existing import/review/publish/checkout/recovery journey is retained. This is a conditional multi-role workflow in one Express process, using the configured Gemini model and existing provider key. It does not require MCP, another AI service, or an external agent framework.

| Role | Actual callable tools | Authority |
| --- | --- | --- |
| Catalog Agent | `inspectSources`, `readSourceSection`, `proposeCatalog` | Read uploaded evidence and propose a validated draft. Never publish. |
| Conflict Investigator | `inspectProductEvidence`, `submitInvestigation` | Read selected unresolved SKU records before submitting focused questions and source-backed suggestions. |
| Operations Agent | `inspectOrderFacts`, `inspectPickupAvailability`, `findPickupSlots`, `proposeOperations` | Inspect recorded orders and propose allowed actions and unsaved pickup appointments. |

The coordinator hands unresolved catalog questions to the investigator only when needed and allowance remains. A seller-resolved price is not investigated again. Physical stock is never inferred. Saving a seller edit recomputes readiness with zero additional model requests. Cached findings are scoped to the input fingerprint, model, prompt version and live/fixture mode. An independent general-purpose second checker remains off; it is distinct from this specialized investigator.

The shared run budget is three model requests, twelve tool invocations and ninety seconds, with the existing per-seller/global renewable quotas. No automatic infinite retry or repeated background agent loop is introduced. Invalid tool arguments receive bounded correction feedback. Unsupported tools, foreign SKU/order IDs, stale input and exhausted budgets are rejected. Source text and tool results are treated as untrusted data rather than instructions.

Server claim checks still decide whether evidence supports a suggestion. Invented product attributes, cross-SKU records and unsupported photo certainty cannot become approved product facts. Disputed prices remain seller questions. A final agent answer cannot waive stock confirmation, publication checks or payment rules.

## Order and pickup interface

- AG Grid shows **Next action** beside Status, includes it in filtered CSV, and retains search, filters, sorting, captured/refunded/net totals and saved table preferences.
- **Suggest next actions with Gemini** runs the Operations Agent for the selected shop. Server policy fills mandatory payment-check tasks and removes forbidden actions. Default row advice is deterministic; the label identifies whether a plan used Gemini or verified rules.
- **Suggest pickup plan with Gemini** reads saved opening dates and eligible captured orders. The server computes times, checks existing appointments and reserves proposed slots virtually so proposals do not overlap each other. No appointment is saved by planning.
- Bryntum draws blue **Proposed** events separately from actual appointments. Clicking a proposal opens **Review appointment** / **Confirm appointment**. Confirmation uses the existing server checks and expected prior booking; buyers see the time only after a successful save.
- Sample preview remains read-only and never spends model allowance, changes stock or enters financial/recovery totals.
- Planning tools cannot capture/refund payments, change fulfillment, publish, confirm stock or save appointments.

## Traceability

Each run stores role, prompt/tool version, input fingerprint, model, tool outcomes, usage metadata, elapsed time, handoff state and bounded call counts. Failed catalog/review/operations runs are recorded without publishing. These are operational traces, not private chain-of-thought. Seller ownership and CSRF checks protect `POST /api/restorecart/incidents/:id/agent-operations`; owner-scoped `GET /api/restorecart/incidents/:id/agent-runs` returns the latest twenty records and the role registry.

History shares the current database retention limits; it is not an externally immutable audit ledger. Concurrent seller edits invalidate results. Existing payment and recovery safeguards remain authoritative.

## Verification and evidence

- **178 automated tests passed**, including agent handoffs, tool schema/scope rejection, invented claims, seller-resolved conflict suppression, shared budgets, cache replay, concurrent changes, operation safety, non-overlapping proposals and no planning mutations. HTTP tests cover shop ownership, CSRF and trace access. Production typecheck/build passed.
- **Actual Gemini Conflict Investigator:** on the configured `gemini-3.5-flash-lite`, two successful requests called `inspectProductEvidence` and `submitInvestigation`. It asked which Blue mug price was correct: $18 from the earlier PDF or $20 from the later CSV. This used synthetic source files, not a real merchant dataset. [Raw measured run](../../tests/evidence/restorecart-live-agents.json).
- **Actual Gemini Operations Agent:** a separate run passed in two requests, invoking `inspectOrderFacts`, `inspectPickupAvailability`, `findPickupSlots` and `proposeOperations`. Two controlled captured-order fixtures received non-overlapping proposed slots; orders remained unchanged and zero appointments were saved. Token usage and request timings are preserved. These were controlled payment references, not PayPal captures. [Measured operations run](../../tests/evidence/restorecart-live-operations.json).
- **Provider availability limitation:** the full live run did not pass end-to-end. Catalog requests returned HTTP 503, and the first operations attempt was interrupted by another 503. The failed report is retained; the separate operations retry passed. No model-accuracy percentage or all-live-success claim is made.
- **Hosted SQLite publish check:** a distinct labelled synthetic test shop was registered, configured, counted, published with HTTP 200 and closed. All replies were JSON; publish took 269 ms in that check. No buyer payment occurred and the user's Sunday Studio draft was untouched. This does not establish the exact cause of the earlier Safari error. [Hosted check](../../tests/evidence/restorecart-hosted-sqlite-publish.json).
- **Browser rehearsal:** the production build was opened against an isolated local SQLite database with two controlled paid-order fixtures. AG Grid rendered next-action values; searching one order changed the visible capture total from $40 to $20. Pickup planning drew two blue Bryntum proposals. Clicking one event opened confirmation; confirming saved exactly one appointment. A new plan left the saved booking in place and proposed only the other order. This was a controlled UI check, not a fresh PayPal transaction. [Browser evidence](../../tests/evidence/restorecart-agents-ui.json).

The interrupted-response handler replaces raw JSON/parser errors with a useful instruction to refresh and check whether publication completed before retrying. It does not automatically retry uncertain writes. The order-view boundary offers a reload action after deployments replace lazy-loaded files; that path was exercised locally by rebuilding between screen loads.

## Current hosting scope

At the user's request, both active Turso environment values were removed from Render and local rehearsal configuration, and `RESTORECART_REQUIRE_PERSISTENCE=false` was set. The current deployment uses temporary SQLite. The optional adapter and historical migration/restart reports remain available; the remote database and private backup were not deleted. New accounts, purchases, stock journals and recovery history can be lost on restart/redeploy/spin-down. Hardcoded examples reconstruct examples, not lost transactions. Finish the demo in one running session and download reports before redeploying.

## Reproduction

```sh
npm ci --include=dev
npm test
VITE_ENABLE_BRYNTUM=true npm run build
# Optional actual provider check; spends bounded Gemini requests on synthetic records.
node --env-file=.env --import tsx scripts/restorecart-live-agents.ts
# Operations-only live check, without rerunning catalog generation.
RESTORECART_AGENT_CHECK_PHASE=operations node --env-file=.env --import tsx scripts/restorecart-live-agents.ts
```

Use a disposable database for test fixtures. Normal tests use controlled transports and make no provider calls. Keep keys and private environment files out of GitHub. The existing demo recording can describe the same core journey; it does not itself prove backend checks added after recording.

## Follow-up: visible chat and decisions

The latest order interface replaces the summary-only planning button with **Chat with Gemini**, available above the desktop/mobile order views. The popup supports a bounded seller message and the last six conversation messages. Responses display explicit cards containing the order, action and verified payment/fulfillment facts. Routine fixture mode is labelled **Verified order rules** rather than claiming a fresh Gemini response.

Each actionable card offers **Approve / Reject**. Approving preparation, payment-check or pickup-instruction advice records acceptance and opens the existing order controls; it does not claim the physical task is completed or automatically charge/refund. Approving a pickup card saves the exact proposed appointment through the same eligibility, overlap and stale-booking checks. The appointment and approval audit commit together or both roll back. Reject records a dismissal without changing the order. Duplicate decisions replay the recorded result; reversing a decision requires a new plan. Changed inputs invalidate approvals. The agent itself receives no write tool.

The owner/CSRF-protected decision endpoint is `POST /api/restorecart/incidents/:id/agent-operations/decision`. It accepts only a recorded plan ID, proposed order/action and approve/reject decision. It rejects foreign plans, invented actions, stale state and expired pickup times. Chat input is limited to 600 characters; prior messages are bounded to six of 800 characters. These limits share the existing run/call quotas. Chat conversation is in the current workspace session; decision records share SQLite retention limits.

**184 automated tests and the production build pass**, including six new chat/decision scenarios and expanded endpoint authorization checks. This update does not claim a new live PayPal transaction or a new live Gemini chat evaluation; the earlier actual-model evidence remains separately labelled.
