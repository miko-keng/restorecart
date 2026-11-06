import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SampleOrderChat } from "../src/restorecart/SampleOrderChat";
import { PaymentTimeline } from "../src/restorecart/PaymentTimeline";
import { AiEvaluation } from "../src/restorecart/AiEvaluation";

test("recorded sample chat offers genuine Gemini replay", () => {
  const html = renderToStaticMarkup(createElement(SampleOrderChat));
  assert.match(html, /Show saved Gemini chat/);
  assert.match(html, /Saved Gemini demo/);
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
