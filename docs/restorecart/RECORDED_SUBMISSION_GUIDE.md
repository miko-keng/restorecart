# RestoreCart — seller-only recorded submission guide

Target duration: 2 minutes 55 seconds. No buyer login, PayPal login or new purchase is needed for the main recording. Button and field labels below match the current repository. This is a prepared-data catalog recovery and simulated fulfillment demonstration; it does not demonstrate a new payment or actual-order recovery.

## Prepare off camera

1. Open the tested build at `/restorecart/seller` and sign in as seller before recording. On a hosted build, confirm it has **Reopening checklist**, **Evidence → seller decision → published details**, and **Show saved Gemini chat**. Pushing code does not itself establish that the hosted deployment is current.
2. Select an untouched **Sunday Studio Demo** draft. If absent, click **Load prepared Sunday Studio Demo**. Loading an existing draft preserves edits; it does not reset them. Do not use **Open conflict practice draft** for this script: practice mode cannot publish.
3. Keep Blue mug unresolved for the recording. Under **Red mug** and **Natural tote**, tick **Hide this product from the shop**, then click **Save draft** for each. This keeps the story focused on one product and avoids additional on-camera confirmation steps.
4. Shop details should already have pickup instructions. If missing, fill **Pickup instructions** and click **Save shop details** before recording.
5. Check that **Show saved Gemini review** is available, and that Orders → **Sample preview** has the heading **Saved Gemini demo · Sample orders** and the button **Show saved Gemini chat**. Then return to **Shop editor**. Do not make a fresh Gemini request during recording.
6. Have these values ready to paste, without quote marks:

| Blue mug field | Exact input |
| --- | --- |
| Price (USD) | 20.00 |
| Which source confirms the current price? | Latest stock sheet confirms $20; the older PDF price is outdated. |
| Physical units counted | 8 |
| Set aside for this shop | 3 |

7. Record at a readable desktop size, ideally 1920 × 1080. Hide password managers, notifications, credentials and unrelated tabs. Use quick cuts between completed actions; retain the saved-result and sample labels. Do not describe an edited replay as a continuous live generation.
8. Set a starting frame: **Shop editor**, **Sunday Studio Demo** selected, prepared files and reopening checklist visible. Keep account setup outside the video.

## Exact actions and narration

Read only the **Say** column aloud. Bold text in the action column identifies interface labels. Stop briefly on each result so judges can read it. The timing includes short cursor movements and typing/paste pauses.

| Time | Exact action / button | Say verbatim |
| --- | --- | --- |
| 0:00–0:15 | Start on **Shop editor**. Show **Sunday Studio Demo**, then the prepared source files. | “When a small shop’s website goes down, its surviving records can disagree. RestoreCart helps the seller rebuild a storefront and keep control. I’m demonstrating with prepared sample records.” |
| 0:15–0:35 | Click **Show saved Gemini review**. Show its saved-result label. Open **Blue mug** if collapsed; show the price conflict beneath **Price (USD)**. | “This is a genuine saved Gemini review, replayed without another API call. The stock sheet says twenty dollars, while the older PDF says eighteen. Gemini flags the conflict; the seller decides.” |
| 0:35–0:50 | Expand **Evidence → seller decision → published details** inside Blue mug. Pause on the two source prices and **Awaiting seller confirmation**. | “The evidence stays beside the decision. Both source prices are visible, and this product is still waiting for seller confirmation.” |
| 0:50–1:20 | Fill the four Blue mug fields using the exact values above. Tick **I checked the product, price and photo, counted the stock, and set these units aside.** Click **Mark ready**. | “For this example, I choose twenty dollars and explain why. I confirm eight physical units and set three aside. Saving records my decision and the supporting evidence.” |
| 1:20–1:45 | Show **Reopening checklist** with **Catalog checks passed**. Click **Preview saved draft** → show Blue mug at $20 → **Close preview** (the × button) → **Publish shop**. Reopen **Blue mug**, expand its evidence view and briefly show **Published details** with **Blue mug · USD 20.00**. | “The reopening checklist uses the same checks the server enforces. After reviewing the saved draft, I publish. The confirmed price now matches the published product.” |
| 1:45–2:00 | Expand **AI Evaluation — Synthetic Dataset**. Pause on 12 claims, 9/12 decisions matching labels, zero unsupported acceptances and the limitations. | “In this twelve-claim synthetic verifier test, nine decisions matched the expected labels. This is limited test evidence, not a measure of real-merchant accuracy.” |
| 2:00–2:35 | Click **Orders** → **Sample preview** → **Show saved Gemini chat**. Pause on **1 Blue mug · $20 · Preparing**, the saved response and **Saved prompt and model** (expand to show token-free replay provenance). Click **Approve** → pause on **Ready for pickup (sample)**. Click **Reset demo** → **Show saved Gemini chat** → **Reject** → pause on **Rejected — sample stays Preparing.** | “Before making a purchase, sellers can explore a clearly labelled sample order. This saved Gemini answer suggests preparation steps. Approve demonstrates sample readiness; reject keeps it preparing. These actions stay inside the demo and never affect PayPal, real inventory or recovery reports.” |
| 2:35–2:45 | Click **Settings** and show the **PayPal payments** panel without starting a connection flow. Keep its actual connection status visible. | “RestoreCart integrates PayPal sandbox checkout. This walkthrough stops before payment and does not demonstrate a transaction.” |
| 2:45–2:55 | Return to **Shop editor**. End on the published Blue mug and its evidence view, or a simple closing title card. | “RestoreCart connects surviving records, seller decisions and a reopened storefront—with evidence behind every step.” |

## Optional stronger PayPal ending — only if genuine footage already exists

Replace the 2:35–2:45 Settings segment with a 15–20-second clip from a genuine previously recorded PayPal sandbox transaction. Keep the total under the applicable submission limit by shortening the intro and cursor pauses. No login needs to appear in the finished video.

Use a visible title: **Previously recorded PayPal sandbox checkout**.

| Clip | Exact action or frame | Say verbatim |
| --- | --- | --- |
| Payment evidence | Show an authentic recording of buyer PayPal approval followed by the confirmed receipt. Do not use Sample preview or create a title card claiming payment succeeded without the corresponding evidence. | “In this previously recorded sandbox checkout, the buyer approves in PayPal and RestoreCart verifies the completed capture before recording the sale.” |
| If an actual order already exists | Instead of checkout footage, record seller → **Orders** → **Actual sandbox orders** → open that actual order → expand **PayPal payment history**. Show **Capture verified** only if recorded. If the order predates history recording, show its current recorded capture without implying historical timestamps exist. | “This is a previously completed sandbox order. The seller can inspect its recorded payment evidence without repeating checkout.” |

Do not claim merchant onboarding or webhook delivery was verified unless corresponding real evidence is available. A saved order is payment evidence, not proof that this video performed checkout.

## Keep these outside the main video

- **Run a fresh review**, **Import with Gemini**, live **Chat with Gemini**, or pickup planning: they add latency and spend model allowance.
- **Connect PayPal**, buyer registration and password entry: they interrupt the story and expose account setup.
- **Recovery** with only sample orders: samples do not enter recovery data. A zero-change comparison with no actual orders does not demonstrate returning a sale or duplicate protection.
- The old $52 basket and “three changes, then zero” result: those belong to the separate full-transaction rehearsal, not this no-purchase script.

## Last check before export

The video should visibly show the source conflict, saved Gemini label, seller explanation, checklist result, published $20 value and sample label. Keep the synthetic evaluation disclaimer readable. Use the actual connection status. The recorded text mentions packaging “for shipping”; preserve the genuine answer, but do not claim shipping is supported—the app’s fulfillment is pickup only.

This guide does not establish the current hackathon’s video-length or editing rules. Check the actual submission requirements before exporting.

## Current recording mode

Use the explicitly labelled **Shared demo** mode with the existing configured checkout account. Seller authorization reached PayPal but remains unverified because the test flow requested identity details. Do not show or narrate **Connected · sandbox** for this fallback. In the Settings segment say: “This demo uses a configured PayPal sandbox account. Individual seller onboarding is still being validated.” No real ID is required for the recorded walkthrough.
