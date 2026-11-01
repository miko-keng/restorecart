# RestoreCart: final three-minute demo

This guide supersedes earlier rehearsal instructions. Use **Save draft** for incomplete work and **Mark ready** for checked products. Do not describe saved Gemini replay as a fresh request or sample orders as payments.

## Before recording

1. Open the hosted `/restorecart/seller/sign-in` in one browser profile and `/restorecart/account` in a separate profile. Ordinary tabs share a login. Locally the current server is http://localhost:4388; judge setup is in [JUDGE_ACCESS.md](docs/restorecart/JUDGE_ACCESS.md).
2. Sign in with your existing seller account. Click **Load prepared Sunday Studio Demo** if necessary. This is idempotent and does not reset a completed/closed draft. If already practiced, use Settings to download a backup and reopen it as a new draft, then recount/review. Never delete prior payment evidence to repeat the demo.
3. Show the **saved Gemini review** before editing. It is a genuine recorded result, explicitly labelled with date and model. A changed draft can make it stale; never force an outdated suggestion to apply. For an unresolved original conflict, use an untouched prepared draft. Reopening an already completed conflict-practice draft preserves its completed state.
4. Before recording, prepare Red mug and Natural tote using the table below and **Mark ready**. Leave Blue mug for the recording. All three must have Hide unchecked. Shop contact/hours/pickup instructions are preloaded.
5. Sign the separate app buyer in and sign into PayPal's **sandbox personal buyer** account beforehand. Do not use the sandbox merchant to buy. Keep credentials out of the recording.
6. Use the exact URL of the shop you publish. The always-visible Sunday Studio Sample Shop belongs to a different demo workflow; purchasing there does not populate your newly published shop's orders.
7. Keep the same running service for the complete story. Do not redeploy during recording. The free deployment is resettable.

| Product | Price USD | Physical units counted | Set aside | Price-source explanation |
| --- | ---: | ---: | ---: | --- |
| Blue mug | 20.00 | 8 | 3 | Latest stock sheet confirms $20. |
| Red mug | 18.00 | 5 | 2 | Not required |
| Natural tote | 12.00 | 4 | 2 | Not required |

For each product, tick **I checked the product, price and photo, counted the stock, and set these units aside.** Then **Mark ready**. Save draft keeps progress but does not approve it.

## Recording: target 2 minutes 55 seconds (never reach 3:00)

| Time | Exact action / input | Speech |
| --- | --- | --- |
| 0:00–0:15 | Seller Shop editor: briefly show source file names. | “When a small shop goes offline, its surviving records can disagree. RestoreCart helps it reopen and keeps emergency sales traceable.” |
| 0:15–0:40 | **Show saved Gemini review**; expand Blue mug and the $18/$20 price conflict. | “This is a saved, genuine Gemini review. It flags conflicting prices and points to the records. The seller makes the decision.” |
| 0:40–1:00 | Blue: price **20.00**, count **8**, set aside **3**, explanation **Latest stock sheet confirms $20.** Tick confirmation → **Mark ready** → **Preview saved draft** → **Close preview** → **Publish shop**. | “I confirm the price and count the stock. Only reviewed products go into the temporary storefront.” |
| 1:00–1:45 | Buyer opens that exact published link. Add Blue mug **2**, Natural tote **1** to basket. Header **Basket** → total **$52.00** → **Checkout with PayPal** → approve on sandbox → wait for **paid** receipt. | “The buyer pays through PayPal sandbox. RestoreCart checks capture on the server before recording a paid sale and committing stock.” |
| 1:45–2:05 | Seller **Orders**, **Actual sandbox orders**, **To prepare** → **Open order** → **Mark ready for pickup**, show receipt → **Mark collected**. | “The seller fulfills the order. The buyer follows its pickup status from the receipt.” |
| 2:05–2:45 | **Recovery** → **Stop new orders** → **Download sales report**. Expand **Optional: update a local recovery file** → **Use practice original-store export** → **Compare return changes** → **Apply to local destination** → **Compare return changes** again. | “When the original store returns, this supported recovery file records one order, two stock changes and $52 net. A second comparison verifies no changes are repeated.” |
| 2:45–2:50 | Show **Return verified**, **1 order(s) already recorded · 0 new changes**, recorded net **$52.00**, and the reset disclosure. | “Rechecking confirms zero repeated changes. This demo can reset.” |
| 2:50–2:55 | Seller **Settings → Connections**. Show **WooCommerce — Not connected**, then click **Connect store** to reveal the empty form. Do not enter or record credentials. | “WooCommerce connection is available here; this shop isn’t connected.” |

Use the real provider flow. Shorten waiting pauses honestly; do not replace payment verification with a sample card. If the receipt says Payment checking, payment is not yet proven. Resolve that before recording a success story.

Expected for one $52 order: first local comparison **3 changes**. After applying, the result shows **Returned: 1 order(s) · 2 stock change(s)**, captured **$52.00**, refunded **$0.00**, net **$52.00**. Compare again to show **Return verified / 1 already recorded / 0 new changes**. Do not say “duplicates prevented” before this verification appears. Original-store totals become **Blue 6, Red 5, Tote 3**; rescue-shop allocations remaining are **1, 2, 1**. Other purchases in that same shop change these totals—use a clean new draft for the main recording.

## Input files

No upload is required for the prepared recording. The original CSV/PDF evidence is preloaded. **Use practice original-store export** supplies the supported JSON destination. For fresh import demonstrations, use your own authorized CSV, PDF or images and explicitly click Import with Gemini; this is a separate, potentially slower flow.

## Optional practice, outside the recording

- Orders → **Sample preview**: six simulated statuses, shared by desktop AG Grid/mobile cards; three example pickup appointments. No payments, stock effects or recovery records.
- Pickup appointment: choose a future 20-minute window, save it, then inspect Pickup schedule and the buyer receipt. Conflicting windows are rejected. A plain appointment list remains available without Bryntum.
- Settings → download shop backup, then open it as a new unpublished draft. It contains catalog, images, evidence and shop details—not accounts/orders/payments. Fresh stock confirmation is required.
- WooCommerce: Settings → **Connections** → **WooCommerce** (Not connected) → **Connect store**. The user enters a public root HTTPS URL plus consumer key/secret; no per-store operator approval. One server encryption key is required before saving. **Connect** checks access with read-only requests; recovery preview/confirm are separate. Real-store verification is pending. The main recording only shows its entry for five seconds; complete credential setup outside the recording. If asked, show the entry form and describe it honestly as awaiting connection, not a verified live return.

## Publishing the video

Record the functioning interface and voice in under three minutes, upload publicly to YouTube, and provide the final link in README and Devpost. Use your own narration and assets; omit music. Review the public video while signed out. No video is claimed to exist until that link is supplied and checked.

## Recording safeguards and last-minute choices

- Do not run a fresh Gemini review for this script. Use the genuine saved output, including its saved-result label.
- Do not record the synthetic recovery UI test shop or substitute sample orders for a real capture.
- If the prepared draft is already reviewed, use a fresh seller workspace/draft during rehearsal; precheck that the conflict is visible before recording. Loading an existing prepared shop does not reset it.
- Keep supporting records/technical recovery details collapsed unless they explain the price conflict. This keeps the story readable.
- Use two browser profiles, not two ordinary tabs, for separate buyer/seller sessions. Keep one receipt tab ready.
- For a slow provider page, remove waiting time in editing without replacing any outcome. Keep the visible amount, approval and paid receipt consistent.
- Show only the WooCommerce entry and empty form at the end. Keep credential setup, backup restoration and simulated statuses outside the main video.
- Rehearse once against the exact final build. Automated tests and the historical hosted payment report support the project, but do not replace recording the working interface.

## Submission caption (copy with the actual video link)

RestoreCart helps a merchant reopen from surviving records, resolve an evidence-backed price conflict, take a PayPal sandbox payment, fulfill pickup and return the emergency sale once through the supported local recovery file. The Gemini review in this recording is a genuine saved result. This is a resettable sandbox prototype; WooCommerce is an optional connector awaiting real-store verification.
