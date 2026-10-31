import { test } from "node:test";
import assert from "node:assert/strict";
import { openRC, incident, save } from "../server/restorecart/store";
import { accountTables } from "../server/restorecart/accounts";
import { prepareDemoShop } from "../server/restorecart/demo";
import { readSavedReview } from "../server/restorecart/reviewRecord";
import { addSource } from "../server/restorecart/sources";
import { aiAllowance, status } from "../server/restorecart/reconstruction";
import {
  createSampleOrders,
  matchesOrderFilter,
  sampleOrders,
} from "../src/restorecart/orderExamples";

test("Each order filter shows only its related simulated statuses", () => {
  const expected: Record<string, string[]> = {
    All: sampleOrders.map((o) => o.name),
    "Payment checking": ["Payment checking"],
    "To prepare": ["To prepare"],
    "Ready for pickup": ["Ready for pickup"],
    Collected: ["Collected"],
    "Canceled / refunded": ["Canceled", "Refunded"],
  };
  for (const [filter, names] of Object.entries(expected))
    assert.deepEqual(
      sampleOrders
        .filter((o) => matchesOrderFilter(o, filter))
        .map((o) => o.name),
      names,
    );
  assert.equal(
    matchesOrderFilter(
      { state: "pending", fulfillment: "ready", refunded: 0 },
      "Ready for pickup",
    ),
    false,
  );
  assert.equal(
    matchesOrderFilter(
      { state: "paid", fulfillment: "collected", refunded: 2000 },
      "Collected",
    ),
    false,
  );
});
test("Genuine saved Sunday Studio response remaps sources across fresh demo databases with zero AI calls", async () => {
  const a = openRC(":memory:"),
    b = openRC(":memory:");
  accountTables(a);
  accountTables(b);
  try {
    const first = await prepareDemoShop(a, "owner-a"),
      second = await prepareDemoShop(b, "owner-b");
    const before = status().calls,
      quota = aiAllowance(a, "owner-a");
    const r = readSavedReview(a, first.id)!,
      again = readSavedReview(a, first.id)!,
      fresh = readSavedReview(b, second.id)!;
    assert.equal(r.savedDemo, true);
    assert.equal(r.source, "gemini");
    assert.equal(r.origin.generatedOn, "2026-10-30");
    assert.equal(r.stale, false);
    assert.deepEqual(r, again);
    assert.equal(status().calls, before);
    assert.deepEqual(aiAllowance(a, "owner-a"), quota);
    assert.equal(r.questions.length, 1);
    assert.match(r.questions[0].text, /\$20.00/);
    assert.match(r.questions[0].text, /\$18.00/);
    assert.notEqual(r.suggestions[0].sourceId, fresh.suggestions[0].sourceId);
    for (const s of fresh.suggestions)
      assert.ok(
        b
          .prepare("SELECT id FROM rc_sources WHERE id=? AND incident=?")
          .get(s.sourceId, second.id),
      );
    assert.equal(a.prepare("SELECT count(*) n FROM rc_orders").get()?.n, 0);
  } finally {
    a.close();
    b.close();
  }
});
test("Saved questions preserve original wording while showing the seller response and stale suggestions stay disabled", async () => {
  const db = openRC(":memory:");
  accountTables(db);
  try {
    const shop = await prepareDemoShop(db, "owner"),
      before = readSavedReview(db, shop.id)!,
      i = incident(db, shop.id),
      blue = i.products.find((p) => p.sku === "MUG-BLU")!;
    blue.price = "20.00";
    blue.resolved = true;
    blue.resolutionNote = "Latest stock sheet confirms $20.";
    i.revision++;
    save(db, i);
    const result = readSavedReview(db, shop.id)!;
    assert.equal(result.stale, true);
    assert.equal(result.questions[0].text, before.questions[0].text);
    assert.equal(result.questions[0].sellerConfirmed, true);
    assert.match(result.questions[0].sellerResponse, /20.00 USD/);
    assert.ok(result.suggestions.every((s: any) => s.applicable === false));
    await addSource(db, shop.id, {
      name: "later-stock.csv",
      data: Buffer.from(
        "sku,name,price,currency\nMUG-BLU,Blue mug,22.00,USD\n",
      ).toString("base64"),
    });
    assert.equal(readSavedReview(db, shop.id)!.stale, true);
  } finally {
    db.close();
  }
});

test("Shared sample dataset provides table rows and non-overlapping pickup appointments without payment identifiers", () => {
  const rows = createSampleOrders(new Date("2026-11-01T04:00:00Z"));
  assert.equal(new Set(rows.map((o) => o.id)).size, 6);
  const appointments = rows.filter(
    (o) => o.state === "paid" && !o.refunded && o.pickupWindow,
  );
  assert.equal(appointments.length, 3);
  for (const [i, row] of rows.entries()) {
    assert.equal(row.sample, true);
    assert.equal(row.amount, 2000);
    assert.equal(row.snapshot.lines[0].sku, "MUG-BLU");
    assert.equal("captureId" in row, false);
    assert.equal("paypalOrderId" in row, false);
  }
  for (let i = 1; i < appointments.length; i++)
    assert.ok(
      Date.parse(appointments[i].pickupWindow!.start) >=
        Date.parse(appointments[i - 1].pickupWindow!.end),
    );
});

test("Conflict practice is separate, repeatable and never resets an existing shop or calls Gemini", async () => {
  const db = openRC(":memory:");
  accountTables(db);
  try {
    const original = await prepareDemoShop(db, "practice-owner");
    const edited = incident(db, original.id);
    edited.products[0].description = "Seller's preserved work";
    save(db, edited);
    const before = status().calls;
    const practice = await prepareDemoShop(db, "practice-owner", true);
    assert.notEqual(practice.id, original.id);
    assert.equal(practice.name, "Sunday Studio Conflict Practice");
    assert.equal(practice.state, "draft");
    const blue = practice.products.find((p) => p.sku === "MUG-BLU")!;
    assert.equal(blue.resolved, false);
    assert.deepEqual(
      [
        ...new Set(
          blue.candidates
            .filter((c) => c.field === "price")
            .map((c) => c.value),
        ),
      ].sort(),
      ["18.00", "20.00"],
    );
    const review = readSavedReview(db, practice.id)!;
    assert.equal(review.savedDemo, true);
    assert.equal(review.stale, false);
    assert.equal(review.questions[0].sellerConfirmed, false);
    assert.equal(
      (await prepareDemoShop(db, "practice-owner", true)).id,
      practice.id,
    );
    assert.equal(
      incident(db, original.id).products[0].description,
      "Seller's preserved work",
    );
    assert.equal(status().calls, before);
    assert.equal(db.prepare("SELECT count(*) n FROM rc_orders").get()?.n, 0);
  } finally {
    db.close();
  }
});
