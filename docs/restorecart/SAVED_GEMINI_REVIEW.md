# Saved Gemini review and filtered examples

Implemented 31 October 2026. No new Gemini calls were made for this change. Not pushed or deployed.

## Genuine source and provenance

The recorded result was recovered read-only from the verified 30 October local end-to-end database, not generated from a fixture, invented by the UI or copied from the later candle test. It is the validated `gemini-3.5-flash-lite` response: one question about MUG-BLU's $18/$20 discrepancy and three descriptions supported by the CSV. See `server/restorecart/fixtures/sunday-studio-gemini-review.json` and the original `FINAL_E2E_REPORT.md`.

The original generation date is known to day precision only, so the UI displays **Generated 2026-10-30**, without inventing an exact time. Original wording and the validated-output hash are retained. Source references are matched by content hash and remapped to the current seller-owned demo sources; new database UUIDs do not break citations.

## Behavior

- `GET /api/restorecart/incidents/:id/review-result` is seller-owned and read-only. It returns the latest stored review when available, otherwise the archived response only for a prepared Sunday Studio demo; ordinary shops without a review receive null. It never invokes the model or spends allowance.
- **Show saved Gemini review** displays the saved result. **Run a fresh review** is separate and sends `{fresh:true}`, explicitly bypassing the response cache while respecting quotas. Fresh results are saved with model, generation timestamp, sources and an input fingerprint for later replay.
- **Gemini Review** separates questions, suggested improvements and source evidence. **Required before publishing** identifies system validation outside the AI panel.
- Source/product changes mark a saved result **Based on earlier records**. Suggestions cannot be applied while stale. The original question remains unchanged when a seller saves their answer. Stock confirmation alone is not proof of an AI approval.
- Order filters precede the optional **Show sample orders** disclosure. The same matching function is used for actual orders and examples; paid-only fulfillment states cannot accidentally match uncertain payments or refunded orders. Examples never enter actual order rows, totals, appointments or recovery exports.

## Verification

**102 tests passed**, zero failed/skipped; production build and TypeScript check passed. Added coverage verifies exact filter-to-example matches, zero-call replay and unchanged allowances, remapping into independent fresh demo databases, retained original questions and seller answers, stale suggestions, explicit fresh bypass, owner isolation and missing-review behavior.

Browser checks on the existing local 4388 database confirmed the recorded response, original date, source labels, seller's already-saved $20 response and unchanged 12-call allowance. To prepare showed only its preparing sample; Canceled/refunded showed only two matching samples. The old tab containing unsaved user edits was left intact; a separate tab was used for verification after restarting the server with the same database. No user product inputs were saved or discarded during this check.

This is a replay of a previously generated answer, not a fresh AI run. PayPal payments remain actual sandbox flows; sample statuses remain simulated. Hosting storage is still temporary.

## Seller UI simplification — 31 October

The global Gemini banner now contains provenance, counts and a collapsed summary. Original questions appear once beside their matching product, with saved seller answers. Suggestions that already match the draft are counted rather than repeated; remaining suggestions stay beside that product. Each product retains one source-evidence disclosure. Showing a saved result makes no Gemini call.

Orders defaults to the AG Grid table on desktop and cards on narrow screens. Actual sandbox orders and Sample preview are separate data modes, each shared across Orders and Pickup schedule. Six UI-only sample rows include three adjacent example appointments; opening one shows read-only details, never seller mutation controls. The old separate example panel and Cards tab are removed. The previous paragraph describing isolated sample cards is superseded by this shared-view design.

Validation: 103 automated tests passed; production build passed (existing optional vendor bundle size warning remains). Browser verified six sample table rows, matching To prepare filter and Bryntum appointment, read-only sample details, saved Gemini replay with unchanged allowance, and mobile cards at 390 × 844 with no horizontal overflow. No payment, fresh Gemini request, publication, push or deployment was performed for this redesign.

## Field-level findings — 31 October

Gemini name, price, photo and description findings now sit directly beneath their corresponding inputs. Already-matching suggestions remain visible with an Already matches label and expandable source citation. Price questions preserve their original wording and saved seller decision. Stale or unsupported suggestions cannot be applied; unknown question topics stay at product level rather than being assigned to an unrelated field. No review is generated automatically.

Product header labels distinguish Ready to publish, Hidden from shop and specific publishing blockers. These reflect saved seller readiness, not AI approval. The compact review banner no longer advertises a confusing total of matching and outdated suggestions. Required publication checks appear near the final confirmation and save action.

Validation: 106 tests passed, production build passed. Browser verified saved price findings beneath Blue mug's price, matching suggestions beneath name and description, retained saved decision and unchanged AI allowance, and no horizontal overflow at 390 × 844. User products were not saved, reset or published. No new Gemini or PayPal call, push or deployment.

## Conflict-focused review — 31 October

Supersedes matching suggestion cards: identical values are now hidden; only different proposed values appear, with Current / Proposed and source support. Saved seller decisions collapse into Resolved, retaining the original Gemini question on expansion. Unanswered price conflicts list source prices directly beneath the price input. Earlier reviews cannot apply outdated suggestions.

Open conflict practice draft creates or opens one separate Sunday Studio Conflict Practice per seller using the original sample records and genuine archived Gemini response. It never resets an existing shop or an already-edited practice draft. It starts unpublished with unresolved pricing and no confirmed stock or orders. Viewing the saved response costs no Gemini call. This is sample rehearsal data, not a newly generated AI response.

Validation: 107 tests passed and production build passed. Browser confirmed the separate draft, original dated saved response, $20 CSV / $18 PDF finding and absence of matching description/name cards; AI allowance stayed unchanged. Existing shop left intact. No fresh Gemini request, PayPal purchase, push or deployment.

## Reviewed-product save validation and provenance — 31 October

Saving a visible product now requires at least one physically counted and set-aside unit, a valid price, an explanation for conflicting prices and seller confirmation. Both server and browser enforce these requirements. Hidden products remain savable without resolving sale-specific questions. A live checklist explains missing inputs; the publication banner names each remaining product blocker. Success messages explain that saving does not publish and other included products must be ready.

Stock inputs use digit-only text entry with a numeric keyboard, allow clearing/retyping and normalize leading zeros; they do not silently coerce blank entries to zero. Decimals, negative values, exponents and allocation above physical count are rejected. Physical stock remains a seller decision, never inferred by Gemini.

Evidence provenance is explicit: Original file records are extracted by RestoreCart; Evidence cited by Gemini contains only actual citations from the saved/current Gemini review. The entire source panel is not falsely labelled AI-generated.

Validation: 109 tests and build passed. HTTP tests reject zero allocation, missing conflict explanation, absent confirmation and invalid physical counts without modifying the revision. Browser checked blank counts, 05 → 5, allocation above count, valid values enabling Save and restoring original values without saving; saved Gemini evidence labels verified. No Gemini call, publication, push or deployment.
