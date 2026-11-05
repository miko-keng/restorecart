# RestoreCart — simple three-minute demo

**Story:** a shop goes offline → Gemini finds a price conflict → seller reopens → buyer pays → seller fulfills → emergency sales are returned once.

## Prepare before recording

- Seller: [open workspace](https://restorecart.onrender.com/restorecart/seller/sign-in). Buyer: [sign in](https://restorecart.onrender.com/restorecart/account) in a **separate browser profile**.
- Seller: choose **Sunday Studio Demo**. If needed, click **Load prepared Sunday Studio Demo**. Files and shop details are already filled in. Use an untouched draft; loading an existing one does not reset it.
- Click **Show saved Gemini review** before editing. This is a genuine saved answer, not a fresh API call.
- Prepare Red mug and Natural tote below before recording. Leave Blue mug unresolved for the demonstration.
- Sign in to the PayPal **sandbox personal buyer** account beforehand. Keep passwords out of the recording.
- Buy from the exact link you publish, not the separate Sunday Studio Sample Shop. Do not restart or redeploy during the demo: current SQLite storage is temporary.

| Product | Price | Physical units counted | Set aside for this shop |
| --- | ---: | ---: | ---: |
| Blue mug — review on camera | 20.00 | 8 | 3 |
| Red mug — prepare beforehand | 18.00 | 5 | 2 |
| Natural tote — prepare beforehand | 12.00 | 4 | 2 |

For each product: leave **Hide this product** unchecked, tick the product/stock confirmation, then **Mark ready**. Blue mug's source explanation: **Latest stock sheet confirms $20.**

## Record — finish by 2:55

| Time | Click / input | Say |
| --- | --- | --- |
| 0:00–0:15 | Seller → **Shop editor**. Briefly show the source files. | “When a small shop goes offline, its surviving records can disagree. RestoreCart helps it reopen and keep every emergency sale traceable.” |
| 0:15–0:40 | **Show saved Gemini review** → Blue mug. Show the **$18 / $20** conflict. | “This genuine saved Gemini review finds conflicting prices and shows the evidence. The seller decides which is correct.” |
| 0:40–1:00 | Enter Blue mug: **20.00**, counted **8**, set aside **3**. Explanation: **Latest stock sheet confirms $20.** Tick confirmation → **Mark ready** → **Preview saved draft** → **Close preview** → **Publish shop**. | “I confirm the price and count the stock. Only reviewed products can be published.” |
| 1:00–1:45 | Buyer opens the published link → add **2 Blue mugs + 1 Natural tote** → **Basket** → **$52.00** → **Checkout with PayPal** → approve → show the **paid** receipt. | “The buyer pays through PayPal sandbox. RestoreCart verifies the payment before recording the sale and committing stock.” |
| 1:45–2:10 | Seller → **Orders** → **Actual sandbox orders** → **To prepare**. Show AG Grid's **Next action** → **Open order** → **Mark ready for pickup**. Show the buyer receipt updating → **Mark collected**. | “The order workspace shows what needs attention. The seller updates fulfillment, and the buyer tracks pickup from the receipt.” |
| 2:10–2:45 | **Recovery** → **Stop new orders** → **Download sales report**. Expand **Optional: update a local recovery file** → **Use practice original-store export** → **Compare return changes** → **Apply to local destination** → compare again. | “When the original shop returns, RestoreCart compares its records with emergency sales. This demonstration updates a supported local recovery file without charging the buyer again.” |
| 2:45–2:55 | Show **1 order already recorded / 0 new changes**. | “The second comparison finds no repeated changes. Reopen from surviving records, keep selling, and bring every order back.” |

**Expected result:** one $52 order, captured $52, refunded $0, net $52. First comparison: **3 changes** — one order and two product stock changes. After applying and comparing again: **0 new changes**. Other purchases in the same shop change these totals.

## Optional: show the new Gemini/Bryntum planning

Keep this outside the main recording, or replace part of the Orders segment. Live requests may take time.

1. **Orders → Actual sandbox orders → Chat with Gemini → Review orders.** Say: “Gemini proposes the next step from verified order facts.”
2. Close the chat. **Pickup schedule → Pickup opening dates:** save a future opening/closing window.
3. **Chat with Gemini → Plan pickups** → review the order and proposed time → **Approve** to save, or **Reject** to dismiss. Close the chat and show the saved time in **Pickup schedule**. Say: “Gemini proposes a time. I review it and approve before the buyer sees it.”

**Sample preview** is read-only simulated data. Saved review replay makes no new AI request. Fresh reviews and planning buttons do. If PayPal still says **Payment checking**, wait for a confirmed result before describing it as paid.

No uploads are needed for this prepared demo. The practice export is an example destination file, not a real connected store. WooCommerce's optional entry is **Settings → Connections → WooCommerce → Connect store**; keep credential setup outside this recording.
