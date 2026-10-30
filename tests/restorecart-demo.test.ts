import { preferredShop } from "../src/restorecart/selection";
import test from "node:test";
import assert from "node:assert/strict";
import { openRC, save, incident } from "../server/restorecart/store";
import { accountTables } from "../server/restorecart/accounts";
import {
  prepareDemoShop,
  prepareEmptyConfiguredWorkspace,
} from "../server/restorecart/demo";
import { readiness } from "../server/restorecart/continuity";
import { orderProgress, canRefundOrder } from "../src/restorecart/orderStatus";

test("Prepared demo has evidence and contact details but requires human review and creates no sales", async () => {
  const db = openRC(":memory:");
  accountTables(db);
  try {
    const shop = await prepareDemoShop(db, "demo-test");
    assert.equal(shop.products.length, 3);
    assert.ok(shop.pickup);
    assert.equal(
      db
        .prepare("SELECT COUNT(*) n FROM rc_sources WHERE incident=?")
        .get(shop.id)?.n,
      2,
    );
    assert.equal(readiness(db, shop.id).ready, 0);
    assert.equal(readiness(db, shop.id).needsInformation, 3);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM rc_orders").get()?.n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM rc_moves").get()?.n, 0);
    const contact = JSON.parse(
      (
        db
          .prepare("SELECT value FROM rc_meta WHERE key=?")
          .get(`contact:${shop.id}`) as any
      ).value,
    );
    assert.equal(contact.contact, "hello@sunday.example");
    shop.products[0].resolutionNote = "Seller chose $20";
    save(db, shop);
    const second = await prepareDemoShop(db, "demo-test");
    assert.equal(second.id, shop.id);
    assert.equal(second.products[0].resolutionNote, "Seller chose $20");
  } finally {
    db.close();
  }
});
test("Demo preparation preserves published shops", async () => {
  const db = openRC(":memory:");
  accountTables(db);
  try {
    const shop = await prepareDemoShop(db, "owner");
    delete (shop as any).demoPrepared;
    shop.state = "live";
    shop.published = {
      revision: 1,
      products: shop.products,
      pickup: "Existing pickup",
      name: shop.name,
    };
    save(db, shop);
    await prepareDemoShop(db, "owner");
    assert.equal(incident(db, shop.id).published?.pickup, "Existing pickup");
    assert.equal(incident(db, shop.id).state, "live");
  } finally {
    db.close();
  }
});
test("Buyer tracking never mistakes approval or refund for ready paid pickup", () => {
  for (const state of [
    "awaiting_buyer",
    "pending",
    "needs_reconciliation",
    "capture_requested",
  ])
    assert.equal(
      orderProgress({ state, fulfillment: "ready", refunded: 0 }).step,
      0,
    );
  assert.equal(
    orderProgress({ state: "paid", fulfillment: "not_ready", refunded: 0 })
      .step,
    1,
  );
  assert.equal(
    orderProgress({ state: "paid", fulfillment: "ready", refunded: 0 }).step,
    2,
  );
  assert.equal(
    orderProgress({ state: "paid", fulfillment: "collected", refunded: 0 })
      .step,
    3,
  );
  assert.equal(
    orderProgress({ state: "paid", fulfillment: "ready", refunded: 2000 }).step,
    -1,
  );
  assert.equal(
    orderProgress({ state: "canceled", fulfillment: "not_ready", refunded: 0 })
      .step,
    -1,
  );
});

test("Hosted bootstrap prepares an empty configured owner once and preserves seller review", async () => {
  const db = openRC(":memory:");
  accountTables(db);
  try {
    await prepareEmptyConfiguredWorkspace(db);
    const row = db
      .prepare("SELECT id FROM rc_owners WHERE account_id='configured-seller'")
      .get() as any;
    assert.ok(row);
    assert.equal(incident(db, row.id).name, "Sunday Studio Demo");
    assert.equal(readiness(db, row.id).needsInformation, 3);
    const before = incident(db, row.id);
    before.products[0].resolutionNote = "Do not reset";
    save(db, before);
    await prepareEmptyConfiguredWorkspace(db);
    assert.equal(
      incident(db, row.id).products[0].resolutionNote,
      "Do not reset",
    );
    assert.equal(db.prepare("SELECT COUNT(*) n FROM rc_incidents").get()?.n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM rc_orders").get()?.n, 0);
  } finally {
    db.close();
  }
});
test("Concurrent demo setup creates one owned draft", async () => {
  const db = openRC(":memory:");
  accountTables(db);
  try {
    const [a, b] = await Promise.all([
      prepareDemoShop(db, "same-owner"),
      prepareDemoShop(db, "same-owner"),
    ]);
    assert.equal(a.id, b.id);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM rc_incidents").get()?.n, 1);
  } finally {
    db.close();
  }
});

test("Seller resumes a restored or rehearsal draft instead of being forced back to the original demo", () => {
  const shops = [
    { id: "restored" },
    { id: "rehearsal" },
    { id: "original", demoPrepared: true },
  ];
  assert.equal(preferredShop(shops, "restored"), "restored");
  assert.equal(preferredShop(shops, "rehearsal"), "rehearsal");
  assert.equal(preferredShop(shops, null), "original");
  assert.equal(preferredShop(shops, "another-sellers-shop"), "original");
  assert.equal(preferredShop([{ id: "ordinary" }], null), "ordinary");
  assert.equal(preferredShop([], "restored"), null);
});

test("Refund controls match server eligibility instead of offering collected or unverified refunds", () => {
  const paid = {
    state: "paid",
    fulfillment: "not_ready",
    refunded: 0,
    capture: "verified-test-capture",
  };
  assert.equal(canRefundOrder(paid), true);
  assert.equal(canRefundOrder({ ...paid, fulfillment: "ready" }), true);
  assert.equal(canRefundOrder({ ...paid, fulfillment: "collected" }), false);
  assert.equal(canRefundOrder({ ...paid, capture: null }), false);
  assert.equal(canRefundOrder({ ...paid, state: "pending" }), false);
  assert.equal(canRefundOrder({ ...paid, refunded: 5200 }), false);
  assert.equal(
    canRefundOrder({ ...paid, refund: { state: "checking" } }),
    false,
  );
});
