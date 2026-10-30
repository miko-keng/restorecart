import { z } from "zod";
import { fail } from "./domain";
import { order, tx, type DB } from "./store";
export function pickupWindow(
  db: DB,
  id: string,
): { start: string; end: string } | null {
  const row = db
    .prepare("SELECT value FROM rc_meta WHERE key=?")
    .get(`pickup:${id}`) as any;
  return row ? JSON.parse(row.value) : null;
}
export function savePickupWindow(db: DB, id: string, input: unknown) {
  const b = z
    .object({
      start: z.string().datetime({ offset: true }),
      end: z.string().datetime({ offset: true }),
    })
    .strict()
    .parse(input);
  const start = Date.parse(b.start),
    end = Date.parse(b.end);
  if (end <= start || end - start > 240 * 60000)
    fail("Choose a pickup window between 1 and 240 minutes.");
  if (end - start < 60000) fail("Choose at least one minute for pickup.");
  return tx(db, () => {
    const o = order(db, id);
    if (
      o.state !== "paid" ||
      o.refunded ||
      o.fulfillment === "collected" ||
      db
        .prepare(
          "SELECT order_id FROM rc_refunds WHERE order_id=? AND state='checking'",
        )
        .get(id)
    )
      fail("Schedule only paid, unrefunded orders awaiting collection.", 409);
    const other = db
      .prepare(
        "SELECT id FROM rc_orders WHERE incident=? AND id!=? AND state='paid' AND refunded=0 AND fulfillment!='collected'",
      )
      .all(o.incident, id) as any[];
    if (
      other.some((v) => {
        const w = pickupWindow(db, v.id);
        return w && Date.parse(w.start) < end && Date.parse(w.end) > start;
      })
    )
      fail(
        "The pickup counter already has an order in that window. Choose another time.",
        409,
      );
    db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
      `pickup:${id}`,
      JSON.stringify(b),
    );
    return b;
  });
}
