import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { openRC, createIncident } from "../server/restorecart/store";
import { addSource } from "../server/restorecart/sources";
import { reconstruct, status } from "../server/restorecart/reconstruction";
const db = openRC(":memory:");
const report: any = {
  date: new Date().toISOString(),
  kind: "Actual Gemini fresh CSV reconstruction; no PayPal transaction",
  passed: false,
};
try {
  const shop = createIncident(db, "Fresh candle evidence check");
  await addSource(db, shop.id, {
    name: "new-candle-records.csv",
    data: Buffer.from(
      "item_ref,display_label,asking_usd,currency,on_hand,details\nCANDLE-LAV,Lavender candle,14.00,USD,7,Soy wax candle\nCANDLE-CIT,Citrus candle,16.00,USD,4,Citrus scented candle\n",
    ).toString("base64"),
  });
  const first = await reconstruct(db, shop.id);
  const calls = status().calls;
  const again = await reconstruct(db, shop.id);
  assert.equal(first.products.length, 2);
  for (const [sku, price] of [
    ["CANDLE-LAV", "14.00"],
    ["CANDLE-CIT", "16.00"],
  ]) {
    const product = first.products.find((p) => p.sku === sku);
    assert.ok(product);
    assert.equal(product.price, price);
    assert.equal(product.allocation, 0);
    assert.equal(product.resolved, false);
  }
  assert.equal(again.run.cached, true);
  assert.equal(status().calls, calls);
  report.passed = true;
  report.calls = calls;
  report.cachedRepeat = true;
  report.variants = first.products.map((p) => ({
    sku: p.sku,
    price: p.price,
    allocation: p.allocation,
    resolved: p.resolved,
  }));
  report.mode = first.run.mode;
} catch (e) {
  report.error = (e as Error).message;
  process.exitCode = 1;
} finally {
  db.close();
  writeFileSync(
    "tests/evidence/restorecart-approved-fixes-live.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
