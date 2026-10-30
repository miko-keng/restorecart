# RestoreCart demo rehearsal — exact clicks and inputs

The full buyer/seller loop passed local testing with live Gemini and a real PayPal sandbox capture. Automated tests: 84 passed. Two UI issues found during E2E were fixed and retested. See [report](docs/restorecart/FINAL_E2E_REPORT.md).

## Start with a fresh shop

Fresh local rehearsal: http://127.0.0.1:4387/restorecart/seller/sign-in

| Role | Username | Email | Password |
| --- | --- | --- | --- |
| Local seller | demo-seller | seller.demo@restorecart.test | RestoreSeller2026! |
| Local buyer | demo-buyer | buyer.demo@restorecart.test | RestoreBuyer2026! |

These public synthetic accounts work in the local rehearsal database. On Render, use your configured/private seller login and register a private buyer. The local passwords do not automatically exist on Render. Use separate browser profiles or one normal/private browser window for the two app roles. Ordinary tabs share an app login. PayPal approval uses your separate **sandbox personal buyer** account from Apps & Credentials; never use the merchant account as the buyer.

If needed after restart, run from the standalone RestoreCart folder:

```sh
RESTORECART_DB_PATH=.data/restorecart-rehearsal.sqlite npm run restorecart:demo-accounts
RESTORECART_PORT=4387 RESTORECART_DB_PATH=.data/restorecart-rehearsal.sqlite RESTORECART_HMR_PORT=24680 node --env-file='/Users/kengzx/Paypal hackathon/ScrapDrop/.env' --import tsx server/restorecart/index.ts
```

The explicit env-file path is this computer's existing private configuration; on another computer use your own ignored .env. Do not commit it.

## 1. Seller: prepare and review

1. Sign in at `/restorecart/seller/sign-in`.
2. Select **Sunday Studio Demo · draft**. If no shop appears, click **Load prepared Sunday Studio Demo**.
3. Stay in **Shop editor**. Files, name, contact, hours and pickup instructions are already saved. You do **not** need Upload or Import with Gemini for this prepared flow.
4. Click **Review with Gemini** once. Expect the Blue mug price question: older catalog $18 versus current stock sheet $20.
5. Expand each product as needed and use the values below. Leave **Hide this product from the shop** unchecked. Tick **I checked the product, price and photo, counted the stock, and set these units aside.** Then click that product's **Save product** before moving to the next product.

| Product | Price (USD) | Physical units counted | Set aside for this shop | Which source confirms the current price? |
| --- | --- | ---: | ---: | --- |
| Blue mug | 20.00 | 8 | 3 | The latest stock sheet confirms $20. |
| Red mug | 18.00 | 5 | 2 | Not required |
| Natural tote | 12.00 | 4 | 2 | Not required |

Expected: **3 ready · 0 need attention** and **Publish shop** enabled. A saved product collapses; save one at a time so unsaved entries in other forms are not lost on refresh.

6. Click **Preview saved draft**, inspect prices and quantities, then **Close preview**.
7. Optional preparation: **Shop backup → Download shop backup**. Keep the JSON for another rehearsal; this is not the sales report.
8. Click **Publish shop**.
9. Copy the published URL from **Shop details → Published shop link**, or use **View published shop**. Give this exact link to the buyer profile; do not choose another similar shop from earlier tests.

## 2. Buyer: find products, save basket and pay

1. Sign in as the buyer at `/restorecart/account`. Shopping opens directly.
2. Search **tote**: expect Natural tote from Sunday Studio Demo at $12.
3. Click **Add to basket** on Natural tote. Clear search, then add Blue mug once.
4. Open the header **Basket** icon.
5. Set **Quantity for Blue mug** to **2**. Keep Natural tote at **1**. Expected total: **3 items · $52.00**.
6. Optional check: sign out/in; the saved basket returns. Skip this during the three-minute recording.
7. Click **Checkout with PayPal**.
8. On **sandbox.paypal.com**, sign in with your sandbox personal buyer. Confirm the total is **USD $52.00**. Click **Complete Purchase** (Malay interface: **Lengkapkan Pembelian**).
9. Wait for the return to RestoreCart. Expect **paid**, **Your PayPal sandbox payment is verified**, **Preparing**, and an empty basket. Approval alone is not proof of capture; use the paid receipt.
10. Keep this receipt open. You can reopen it using **Your orders → View order**.

## 3. Seller and buyer: pickup tracking

1. Seller: **Orders → All** or **To prepare**. Find the $52 order with **2 × Blue mug · 1 × Natural tote**.
2. Optional: switch to **Order table**, search **mug**, click **Open order**. The same action card appears.
3. Optional appointment: expand **Schedule pickup time**, enter **31 October 2026, 10:00** to **10:20**, then **Save pickup appointment**. For later rehearsals choose a suitable date. **Pickup schedule** displays the saved window; the buyer also sees it. Bryntum requires the applicable evaluation flag/rights on a hosted build; the plain list works without it.
4. Click **Mark ready for pickup**. Buyer receipt should show **Ready for pickup** within about six seconds while active.
5. Click **Mark collected** when simulating collection. Buyer receipt should show **Collected**. In the seller UI the order moves to the **Collected** filter.

The prototype only offers full refunds for **uncollected** paid orders. Do not include a refund in this main story; refunds after collection are unsupported. The hardcoded examples under **Example order statuses — simulated, no payments** illustrate all six states but are not actual transactions and do not enter reports.

## 4. Seller: close and bring emergency sales back

1. Open **Recovery**.
2. Click **Stop new orders**. Expected: no unresolved payments, public shop closed to new orders.
3. Click **Download sales report**. Inspect the CSV if desired: captured/net **$52.00**, refunded **$0.00**, one collected order.
4. Expand **Optional: update original-store records**.
5. Click **Use practice original-store export**. This creates a fresh Original Store JSON v1 example; no file upload needed for the demo.
6. Click **Compare return changes**. Expected **3 changes · 0 orders already recorded**: add one order, subtract two Blue mugs and one tote.
7. Expected resulting inventory: **MUG-BLU 6 · MUG-RED 5 · TOTE-NAT 3**. These are original-store totals. Emergency stock remaining at the rescue shop is **1 / 2 / 1**, because only a subset was set aside.
8. Click **Apply to local destination**. Expected **3 local changes applied**.
9. Click **Download updated original-store file** if you want the JSON.
10. Click **Compare return changes** again. Expected **0 changes · 1 order already recorded**. End your main demo here.

Say: “The emergency sale is returned once. Repeating recovery does not duplicate the order or deduct stock again.” This adapter updates a local JSON file, not Shopify or WooCommerce.

## 5. Optional practice: reopen a saved backup

This is a separate scenario, not needed for the three-minute video.

1. **Shop editor → Shop backup**.
2. **Open backup as → New shop draft**.
3. **Upload shop backup (.json)** and choose the earlier downloaded backup.
4. Expect a separate **Sunday Studio Demo · restored · draft** with saved prices, source decisions and shop details, but zero physical count/allocation and no copied orders. Recount/reallocate before publishing.
5. Refresh: the restored draft should remain selected. All owned shops remain in **Your shop**.
6. For rehearsal instead, choose **Practice only — no publishing or payments** before uploading. Expect **Practice draft · payments disabled**. Click **Practice returning a sale**; expected **Passed: 2 first-run changes, 0 repeat changes. No real orders changed.**

A closed shop is not reset by Load prepared demo. To repeat without destroying prior payment/recovery evidence, restore a backup as a new shop draft. Choose the correct fresh draft and its new published URL. The setup is intentionally non-destructive.

## Three-minute recording cut

Before recording, sign both app roles in, log the sandbox buyer into PayPal, and confirm/save Red mug and Natural tote. Leave Blue mug unconfirmed. This keeps the recorded manual review focused on the genuine price conflict.

| Time | Action | Speech |
| --- | --- | --- |
| 0:00–0:15 | Show prepared sources and seller editor | “A store outage should not stop a small business selling. RestoreCart works from the records it still has.” |
| 0:15–0:45 | Review with Gemini; enter Blue mug values; save | “Gemini spots two prices. The seller confirms the current price and counts what can actually be sold.” |
| 0:45–1:00 | Preview briefly, then Publish | “Confirmed products become a temporary shop with pickup details.” |
| 1:00–1:45 | Buyer basket: 2 mugs + 1 tote; PayPal sandbox checkout | “The buyer pays through PayPal sandbox. The server verifies capture and updates reserved stock.” |
| 1:45–2:05 | Seller marks ready/collected; show buyer status | “The seller prepares the order, and the buyer can follow pickup progress.” |
| 2:05–2:50 | Close, download sales report, compare/apply/compare again | “When the original store returns, bring back the sale and stock changes. Run recovery again: zero duplicate changes.” |

Skip appointment entry, refunds, registration, full backup rehearsal and extra filters in the recording. You may shorten loading pauses honestly; do not describe preloaded records or simulated examples as a fresh AI reconstruction or real payment. Actual live provider waits vary, so rehearse once before recording. The hosted version still requires the latest deploy, correct private settings and durable storage if you need records to survive restarts.
