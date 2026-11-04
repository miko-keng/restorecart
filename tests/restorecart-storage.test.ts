import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  openRC,
  tx,
  reserve,
  lock,
  commitCapture,
  order,
  available,
  closeIncident,
} from "../server/restorecart/store";
import { accountTables, registerAccount } from "../server/restorecart/accounts";
import {
  originalExample,
  reconciliation,
  applyReconciliation,
  putMeta,
} from "../server/restorecart/continuity";
import { prepareSampleShop } from "../server/restorecart/demo";

test("libSQL adapter commits stock/payment/account/source data across reopen and rolls back failed transactions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rc-external-adapter-"));
  const url = pathToFileURL(join(dir, "external.sqlite")).href;
  let db = openRC(url);
  try {
    accountTables(db);
    const account = registerAccount(db, {
      username: "persistent-buyer",
      email: "persistent@restorecart.test",
      password: "PersistentBuyer2026!",
      role: "buyer",
    });
    const shop = await prepareSampleShop(db);
    const purchase = reserve(
      db,
      shop.id,
      account.id,
      "persist-key",
      "token",
      shop.published!.revision,
      [{ sku: "MUG-BLU", quantity: 2 }],
    );
    db.prepare("UPDATE rc_orders SET state='awaiting_buyer' WHERE id=?").run(
      purchase.id,
    );
    lock(db, purchase.id);
    commitCapture(db, purchase.id, "CAP-PERSIST");
    assert.throws(
      () =>
        tx(db, () => {
          db.prepare("INSERT INTO rc_meta VALUES(?,?)").run(
            "rollback-marker",
            "1",
          );
          throw Error("rollback test");
        }),
      /rollback test/,
    );
    assert.equal(
      db.prepare("SELECT key FROM rc_meta WHERE key=?").get("rollback-marker"),
      undefined,
    );
    const bytes = Buffer.from([0, 1, 255, 42]);
    db.prepare("INSERT INTO rc_cache VALUES(?,?)").run(
      "retained-cache",
      '{"saved":true}',
    );
    const sourceId = (
      db.prepare("SELECT id FROM rc_sources ORDER BY id LIMIT 1").get() as any
    ).id;
    db.prepare("UPDATE rc_sources SET bytes=? WHERE id=?").run(bytes, sourceId);
    closeIncident(db, shop.id);
    const original = originalExample(db, shop.id);
    const preview = reconciliation(db, shop.id, original);
    putMeta(db, "preview:external-restart", preview);
    const returned = applyReconciliation(db, shop.id, "external-restart");
    db.close();
    db = openRC(url);
    accountTables(db);
    assert.equal(
      applyReconciliation(db, shop.id, "external-restart").repeated,
      true,
    );
    assert.equal(
      reconciliation(db, shop.id, returned.output).changes.length,
      0,
    );
    assert.equal(order(db, purchase.id).capture, "CAP-PERSIST");
    assert.equal(available(db, shop.id, "MUG-BLU", 8), 6);
    assert.ok(
      db.prepare("SELECT id FROM rc_accounts WHERE id=?").get(account.id),
    );
    assert.equal(
      db.prepare("SELECT body FROM rc_cache WHERE key=?").get("retained-cache")
        ?.body,
      '{"saved":true}',
    );
    assert.deepEqual(
      Buffer.from(
        (
          db
            .prepare("SELECT bytes FROM rc_sources WHERE id=?")
            .get(sourceId) as any
        ).bytes,
      ),
      bytes,
    );
    assert.equal(
      db
        .prepare("SELECT count(*) n FROM rc_moves WHERE order_id=?")
        .get(purchase.id)?.n,
      1,
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("libSQL adapter fails closed for insecure URLs and missing remote credentials", async () => {
  const { remoteDatabase } =
    await import("../server/restorecart/remoteDatabase");
  assert.throws(
    () => remoteDatabase("http://database.example", "secret"),
    /secure/,
  );
  assert.throws(
    () => remoteDatabase("libsql://database.example"),
    /TURSO_AUTH_TOKEN/,
  );
});

test("Migration copies operational tables and blobs, preserves the source and rejects a non-empty destination", () => {
  const dir = mkdtempSync(join(tmpdir(), "rc-migrate-"));
  const source = join(dir, "source.sqlite"),
    target = join(dir, "target.sqlite");
  const db = openRC(source);
  db.prepare("INSERT INTO rc_meta VALUES(?,?)").run(
    "migration-marker",
    '{"payment":"CAP-MIGRATE"}',
  );
  db.prepare("INSERT INTO rc_sources VALUES(?,?,?,?,?,?,?)").run(
    "source-test",
    "shop-test",
    "image.png",
    "image/png",
    "hash",
    Buffer.from([0, 255, 10]),
    "text",
  );
  db.close();
  const hash = () =>
    createHash("sha256").update(readFileSync(source)).digest("hex");
  const before = hash();
  const env = {
    ...process.env,
    NODE_ENV: "test",
    TURSO_DATABASE_URL: pathToFileURL(target).href,
    TURSO_AUTH_TOKEN: "",
  };
  const args = [
    "--import",
    "tsx",
    "scripts/restorecart-migrate-storage.ts",
    `--source=${source}`,
    "--apply",
  ];
  try {
    const result = execFileSync(process.execPath, args, {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.match(result, /Migration committed/);
    const migrated = openRC(target);
    assert.match(
      String(
        migrated
          .prepare("SELECT value FROM rc_meta WHERE key=?")
          .get("migration-marker")?.value,
      ),
      /CAP-MIGRATE/,
    );
    assert.deepEqual(
      Buffer.from(
        (
          migrated
            .prepare("SELECT bytes FROM rc_sources WHERE id=?")
            .get("source-test") as any
        ).bytes,
      ),
      Buffer.from([0, 255, 10]),
    );
    migrated.close();
    assert.throws(() =>
      execFileSync(process.execPath, args, {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
    assert.equal(hash(), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Migrated registered seller email does not collide with or overwrite bootstrap credentials", async () => {
  const { seedConfiguredAccount } =
    await import("../server/restorecart/accounts");
  const db = openRC(":memory:");
  try {
    accountTables(db);
    seedConfiguredAccount(
      db,
      "original-bootstrap@restorecart.test",
      "OriginalBootstrap2026!",
    );
    registerAccount(db, {
      username: "registered-seller",
      email: "seller.demo@restorecart.test",
      password: "RegisteredSeller2026!",
      role: "seller",
    });
    const before = db.prepare("SELECT * FROM rc_accounts ORDER BY id").all();
    seedConfiguredAccount(
      db,
      "seller.demo@restorecart.test",
      "DifferentEnvironmentPassword2026!",
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM rc_accounts ORDER BY id").all(),
      before,
    );
  } finally {
    db.close();
  }
});

test("Bootstrap refuses a registered email without taking over an existing account", async () => {
  const { seedConfiguredAccount } =
    await import("../server/restorecart/accounts");
  const db = openRC(":memory:");
  try {
    accountTables(db);
    registerAccount(db, {
      username: "registered-buyer",
      email: "registered@restorecart.test",
      password: "RegisteredBuyer2026!",
      role: "buyer",
    });
    const before = db.prepare("SELECT * FROM rc_accounts").all();
    assert.throws(
      () =>
        seedConfiguredAccount(
          db,
          "registered@restorecart.test",
          "EnvironmentPassword2026!",
        ),
      /already registered/,
    );
    assert.deepEqual(db.prepare("SELECT * FROM rc_accounts").all(), before);
  } finally {
    db.close();
  }
});
