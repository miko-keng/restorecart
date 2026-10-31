# Final seller workflow — parts 1 and 2

Implemented locally, 31 October 2026. Supersedes earlier notes that disabled Save until all readiness checks passed.

## Save, approve and publish

- Save draft preserves incomplete prices, decisions and stock counts. Invalid quantities still receive guidance. Saving a draft clears approval and requires review before publication; it does not replace an existing published snapshot.
- Mark ready validates the current price, any price-conflict explanation, allocation, physical count and seller confirmation. Missing requirements remain visible, clicking gives a clear message and focuses a relevant field. It never silently disables the action for missing inputs.
- Statuses distinguish Needs review (with a reason), Ready to publish and Hidden from shop.
- Publish stays actionable and opens a checklist when blocked, with links opening affected products. Completed checklists close automatically. Server validation remains authoritative.
- Preview shows saved included products, readiness labels and names of hidden products; no checkout is possible.
- Important draft edits clear readiness. Stable product keys and per-product browser drafts preserve other unsaved forms.
- Backups and store connections are secondary Settings, outside the main editor.

## Gemini and supporting records

- Only different proposed values appear as suggestions, with Current / Proposed, a reason and explicit application.
- Original conflict questions stay beneath their related fields. Resolved seller decisions collapse; matching values do not produce suggestion cards.
- Saved response provenance remains visible. Earlier suggestions cannot be applied.
- Supporting records is one collapsed table grouped by original file, with concise facts, View original and collapsed Show excerpt. Only actual response citations are labelled Cited by Gemini; other file records are labelled Imported record. Citations do not certify physical stock.

## Verification

110 automated tests passed; production build and diff whitespace check passed. Existing optional vendor bundle-size warnings remain.

Browser tested against an isolated copy of the local database on port 4390: invalid Mark ready guidance and focus; incomplete draft save; reload retained physical count; Publish checklist; Mark ready success; preview listed included and hidden products; local publication succeeded; editing the approved product and saving a draft returned it to Needs review. Saved Gemini replay and grouped citations were inspected without any new AI call. The temporary test server was stopped.

Original localhost:4388 database was not modified by these scenarios. Updated app is running there. Narrow layout checked at 390 × 844 with no page overflow. No external payment, external-store mutation, push or deployment performed.
