# Backend evidence verification — 4 November 2026

## Delivered without changing the shopping flow

The catalog-review server classifies proposed fields as `supported`, `conflicting`, or `insufficient_evidence`. A real quotation is not enough: spreadsheet claims must refer to the selected SKU's row and field. Quotes encoded as JSON or raw CSV are supported. Invented attributes, wrong-variant rows, unknown source IDs and cross-SKU prices cannot become accepted AI suggestions. Conflicting prices remain seller decisions. Image-file existence alone is not proof of a variant match.

Reconstruction now rejects spreadsheet candidates whose values belong to another SKU and removes unsupported generated descriptions. Saved reviews preserve non-applicable flags; replay cannot re-enable a blocked suggestion. A draft revision check prevents an answer generated during another seller edit from being saved as current. Historical saved demo answers retain their original provenance and are not described as newly verified.

These are evidence-grounding checks, not certification of a merchant's own claims. Exact source wording can still be inaccurate. Conservative checks can withhold useful paraphrases; sellers retain manual editing and approval.

## Independent checker and the activation decision

A second, separately instructed Gemini request receives original source records and actual supplied image bytes. It returns structured, indexed evidence decisions, not actions. Duplicate/missing indexes, invalid fields and malformed responses are rejected. Hard server blocks cannot be overruled. Checker failure falls back to conservative server checks without approving an uncertain claim. There is no automatic retry, new provider or MCP server.

`RESTORECART_AI_VERIFIER=off|shadow|enforce` controls the experiment. Default and current local setting: **off**. Shadow records decisions without changing server findings. Enforce is available for a controlled evaluation, not automatically enabled by an API success. Review plus checker uses at most two calls, shared seller/global quotas and a bounded total deadline. Cache keys include checker mode and pipeline versions; cached answers make no extra request.

Actual live Gemini evidence:

- [Twelve fixed, human-authored proposals](../../tests/evidence/restorecart-verifier-evaluation.json): two batches (six development, six holdout), one verifier call per batch. Same proposals compared before/after checking; no tuning on holdout. Categories cover invented safety/capacity claims, wrong variants, conflicting prices, mapped columns, malicious uploaded instructions, invented citations, faithful paraphrases and an actual blue image given an incorrect red filename.
- The server-only baseline accepted **0 unsupported proposals**, retaining **2 of 5 supported proposals**. Combined checking also accepted **0 unsupported proposals**, retaining **5 of 5 supported proposals**. Exact three-way classifications were **9 of 12 for both** because the checker sometimes called missing evidence “conflicting.” These counts describe this small synthetic set only, not production accuracy.
- [Live producer comparison](../../tests/evidence/restorecart-producer-comparison.json): one actual Gemini catalog-review request plus one independent checker request on its original proposals. All five generated proposals were supported by the source records; checking did not catch an additional unsafe proposal. Latencies and provider-reported token usage are recorded.

**Decision: leave the checker off.** It helped paraphrase retention on fixed cases, but the live producer sample did not establish an additional error-catching benefit. More independent data would be needed to justify the extra call in normal operation. The stronger deterministic checks are active regardless.

Reproduce the bounded live evaluations with private credentials:

```sh
node --env-file=.env --import tsx scripts/restorecart-verifier-eval.ts
node --env-file=.env --import tsx scripts/restorecart-producer-comparison.ts
```

These commands make real Gemini requests using synthetic examples, overwrite their evaluation reports, and consume API allowance. Routine `npm test` uses injected transports and makes no model requests.

## Actual Turso persistence

A private, consistent snapshot preserved the local rehearsal database before migration. The guarded migration copied it to the empty remote database. [Row comparison](../../tests/evidence/restorecart-turso-migration.json) checked all **24 original rows across 16 tables** unchanged. Private account data, tokens and database files are excluded from Git.

[Remote persistence verification](../../tests/evidence/restorecart-turso-persistence.json) ran two independent application processes against actual Turso. It verified an account, real example image bytes, a **controlled payment reference**, stock moves, rollback and recovery history. A repeated recovery applied **zero additional changes**, and the controlled order retained exactly one stock movement. These checks made **no PayPal calls**. Verification fixtures use a separate closed shop; they do not consume the published sample shop's stock.

Local `.env` now selects Turso and requires persistence; existing demo checkout credentials are preserved separately from the private Platform verification configuration. The original rehearsal SQLite file and private pre-migration snapshot remain unchanged.

A Render rebuild/restart check is tracked separately. Remote database verification alone does not prove the hosted deployment is configured correctly. See the hosted report when available.

## Regression and limits

Current regression: **164 tests passed**, including new grounding, cross-SKU reconstruction, escaped citations, verifier index/schema validation, hard-block precedence, shadow/enforce/failure behavior, caching and saved-review checks. Migrated-account bootstrap collisions are handled without replacing registered credentials; sanitized storage error codes help diagnose failures without exposing SQL or secrets. Existing checkout concurrency, interrupted capture/refund, duplicate notifications, pickup conflict and recovery tests continue to pass. Production TypeScript/Vite build passed. Bryntum remains a large lazy-loaded chunk; the existing bundle warning remains.

No new UI screens or third-party dependencies were introduced. Existing AG Grid and Bryntum operations remain covered by the regression suite. This report does not represent a new end-to-end PayPal transaction or extend the historical demo video's coverage.
