import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  openRC,
  tx,
  reserve,
  lock,
  commitCapture,
  order,
  available,
  closeIncident,
  createIncident,
  save,
  publish,
} from "../server/restorecart/store";
import { accountTables, registerAccount } from "../server/restorecart/accounts";
import {
  originalExample,
  reconciliation,
  applyReconciliation,
  putMeta,
} from "../server/restorecart/continuity";
import { prepareSampleShop } from "../server/restorecart/demo";
const manifestPath = ".data/turso-verification-manifest.json";
const stage = process.argv[2] || "run";
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)
  throw Error("Configure private Turso credentials first.");
if (stage === "run") {
  for (const part of ["write", "read"]) {
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/restorecart-turso-verification.ts", part],
      { env: process.env, encoding: "utf8", timeout: 180000 },
    );
    if (child.status !== 0) {
      console.error(
        "Turso verification stage failed; private records and credentials suppressed.",
      );
      process.exit(1);
    }
  }
  console.log(
    "Turso verification passed across two independent application processes; see the evidence report.",
  );
} else {
  const db = openRC();
  try {
    accountTables(db);
    if (stage === "write") {
      if (existsSync(manifestPath))
        throw Error(
          "Verification manifest already exists; use read to recheck without creating more fixtures.",
        );
      const account = registerAccount(db, {
        username: "persistence-check-" + Date.now(),
        email: `persistence-${Date.now()}@restorecart.test`,
        password: "ControlledPersistenceCheck2026!",
        role: "buyer",
      });
      const template = await prepareSampleShop(db);
      const draft = createIncident(
        db,
        "[Verification only] Persistence checks",
      );
      draft.products = structuredClone(template.products);
      draft.pickup = "Controlled verification only; no buyer pickup.";
      save(db, draft);
      putMeta(
        db,
        `counts:${draft.id}`,
        Object.fromEntries(
          draft.products.map((p) => [
            p.sku,
            {
              quantity: p.allocation,
              allocation: p.allocation,
              at: Date.now(),
            },
          ]),
        ),
      );
      const shop = publish(db, draft.id, draft.revision);
      // This fixture is a closed verification shop, never a real provider payment.
      const purchase = reserve(
        db,
        shop.id,
        account.id,
        "controlled-persistence-key",
        "controlled-token",
        shop.published!.revision,
        [{ sku: "MUG-BLU", quantity: 2 }],
      );
      db.prepare("UPDATE rc_orders SET state='awaiting_buyer' WHERE id=?").run(
        purchase.id,
      );
      lock(db, purchase.id);
      commitCapture(db, purchase.id, "CONTROLLED-NO-PAYPAL-" + Date.now());
      assert.throws(() =>
        tx(db, () => {
          db.prepare("INSERT INTO rc_meta VALUES(?,?)").run(
            "persistence-rollback-test",
            "1",
          );
          throw Error("controlled rollback");
        }),
      );
      assert.equal(
        db
          .prepare("SELECT key FROM rc_meta WHERE key=?")
          .get("persistence-rollback-test"),
        undefined,
      );
      closeIncident(db, shop.id);
      const previewKey = "persistence-check-" + Date.now();
      putMeta(
        db,
        "preview:" + previewKey,
        reconciliation(db, shop.id, originalExample(db, shop.id)),
      );
      const returned = applyReconciliation(db, shop.id, previewKey);
      const sources = db
        .prepare("SELECT id,bytes FROM rc_sources WHERE incident=?")
        .all(shop.id) as any[];
      const image = readFileSync("examples/restorecart/blue-mug-evidence.png");
      // Store real example image bytes in an isolated verification source, not a merchant upload.
      const sourceId = "persistence-image-" + Date.now();
      db.prepare("INSERT INTO rc_sources VALUES(?,?,?,?,?,?,?)").run(
        sourceId,
        shop.id,
        "verification-blue.png",
        "image/png",
        sourceId,
        image,
        "",
      );
      writeFileSync(
        manifestPath,
        JSON.stringify({
          accountId: account.id,
          shopId: shop.id,
          orderId: purchase.id,
          previewKey,
          output: returned.output,
          sourceId,
          imageBase64: image.toString("base64"),
          sources: sources.length,
        }),
        { mode: 0o600 },
      );
    } else if (stage === "read") {
      const m = JSON.parse(readFileSync(manifestPath, "utf8"));
      assert.ok(
        db.prepare("SELECT id FROM rc_accounts WHERE id=?").get(m.accountId),
      );
      assert.match(order(db, m.orderId).capture, /^CONTROLLED-NO-PAYPAL-/);
      assert.equal(available(db, m.shopId, "MUG-BLU", 8), 6);
      assert.deepEqual(
        Buffer.from(
          (
            db
              .prepare("SELECT bytes FROM rc_sources WHERE id=?")
              .get(m.sourceId) as any
          ).bytes,
        ),
        Buffer.from(m.imageBase64, "base64"),
      );
      assert.equal(
        applyReconciliation(db, m.shopId, m.previewKey).repeated,
        true,
      );
      assert.equal(reconciliation(db, m.shopId, m.output).changes.length, 0);
      assert.equal(
        db
          .prepare("SELECT count(*) n FROM rc_moves WHERE order_id=?")
          .get(m.orderId)?.n,
        1,
      );
      writeFileSync(
        "tests/evidence/restorecart-turso-persistence.json",
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            backend: "actual remote Turso/libSQL",
            applicationProcesses: 2,
            checks: {
              accountRetained: true,
              imageBytesRetained: true,
              controlledCaptureRetained: true,
              stockMovesRetained: true,
              recoveryJournalRetained: true,
              repeatRecoveryChanges: 0,
              stockMovesForOrder: 1,
              failedTransactionRolledBack: true,
            },
            paymentProviderCalls: 0,
            scope:
              "Independent local application processes against hosted Turso. Controlled payment reference; no PayPal purchase. This is not a Render service restart test.",
          },
          null,
          2,
        ) + "\n",
      );
    } else throw Error("Unknown stage.");
  } finally {
    db.close();
  }
}
