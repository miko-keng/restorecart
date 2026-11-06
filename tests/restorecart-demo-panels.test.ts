import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SampleOrderChat } from "../src/restorecart/SampleOrderChat";
import { PaymentTimeline } from "../src/restorecart/PaymentTimeline";
import { AiEvaluation } from "../src/restorecart/AiEvaluation";

test("recorded sample chat offers genuine Gemini replay", () => {
  const html = renderToStaticMarkup(createElement(SampleOrderChat));
  assert.match(html, /Play demo chat/);
  assert.match(html, /Saved response/);
  assert.match(html, /never affect PayPal/);
});
test("payment panel does not turn a pending order into verified capture", () => {
  const html = renderToStaticMarkup(
    createElement(PaymentTimeline, {
      order: { state: "pending", refunded: 0 },
    }),
  );
  assert.match(html, /no verified completed capture shown/);
  assert.match(html, /not separately confirmed/);
  assert.match(html, /not proof of a webhook delivery/);
});
test("payment panel shows recorded capture and pending refund independently", () => {
  const html = renderToStaticMarkup(
    createElement(PaymentTimeline, {
      order: {
        state: "paid",
        capture: "CAPTURE-1",
        refunded: 0,
        refund: { state: "checking" },
      },
    }),
  );
  assert.match(html, /recorded \(CAPTURE-1\)/);
  assert.match(html, /checking — wait for confirmation/);
});
test("evaluation exposes the saved synthetic results and limitations", () => {
  const html = renderToStaticMarkup(createElement(AiEvaluation));
  assert.match(html, /9 \/ 12/);
  assert.match(html, /not production accuracy/);
  assert.match(html, /not real merchant data/);
});

test("payment history distinguishes requested and verified events and preserves recorded times", () => {
  const html = renderToStaticMarkup(
    createElement(PaymentTimeline, {
      order: {
        state: "paid",
        capture: "CAPTURE-1",
        refunded: 0,
        paymentHistory: [
          {
            id: "event-1",
            kind: "capture_requested",
            source: "api",
            reference: "ORDER-1",
            at: "2026-11-06T01:00:00.000Z",
          },
          {
            id: "event-2",
            kind: "capture_verified",
            source: "reconciliation",
            reference: "CAPTURE-1",
            at: "2026-11-06T01:01:00.000Z",
          },
        ],
      },
    }),
  );
  assert.match(html, /Capture requested/);
  assert.match(html, /Capture verified/);
  assert.match(html, /Background reconciliation/);
  assert.match(html, /dateTime="2026-11-06T01:01:00.000Z"/i);
  assert.ok(
    html.indexOf("Capture requested") < html.indexOf("Capture verified"),
  );
});

test("legacy orders have no invented timestamped payment history", () => {
  const html = renderToStaticMarkup(
    createElement(PaymentTimeline, {
      order: { state: "paid", capture: "OLDER-CAPTURE", refunded: 0 },
    }),
  );
  assert.match(html, /No timestamped payment events recorded/);
  assert.doesNotMatch(html, /<time /);
});

test("AI provenance has one saved-response badge with metadata in Details", async () => {
  const { GeminiReview } = await import("../src/restorecart/GeminiReview");
  const html = renderToStaticMarkup(
    createElement(GeminiReview, {
      review: {
        saved: true,
        savedDemo: true,
        model: "controlled-model",
        generatedAt: "2026-11-06T01:00:00Z",
        summary: "Two prices disagree.",
      },
    }),
  );
  assert.equal((html.match(/Saved response/g) || []).length, 1);
  assert.match(html, /<summary>Details<\/summary>/);
  assert.doesNotMatch(html, /Saved demo result|Replay the saved review/);
});

test("Empty orders show a useful empty state without grid totals or publish controls", async () => {
  const { OrdersWorkspace } =
    await import("../src/restorecart/OrdersWorkspace");
  const html = renderToStaticMarkup(
    createElement(OrdersWorkspace, {
      shop: { id: "shop", slug: "test", published: {} },
      orders: [],
      api: async () => ({}),
      run: () => {},
      refresh: () => {},
      onPlan: () => {},
      renderOrder: () => null,
    }),
  );
  assert.match(html, /No purchases yet/);
  assert.match(html, /Open storefront/);
  assert.match(html, /Try sample orders/);
  assert.doesNotMatch(
    html,
    /Captured \$|Publish shop|View all orders|No Rows To Show/,
  );
});
