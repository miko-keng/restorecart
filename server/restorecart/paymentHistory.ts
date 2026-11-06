import { uid } from "./domain";
import type { DB } from "./store";
export type PaymentSource = "api" | "reconciliation" | "webhook";
export function paymentEvent(
  db: DB,
  orderId: string,
  kind: string,
  source: PaymentSource,
  reference = "",
  key = `${kind}:${source}:${reference}`,
) {
  db.prepare(
    "INSERT OR IGNORE INTO rc_payment_history(id,order_id,event_key,kind,source,reference,created) VALUES(?,?,?,?,?,?,?)",
  ).run(
    uid("payment_event"),
    orderId,
    key,
    kind,
    source,
    reference,
    Date.now(),
  );
}
export function paymentHistory(db: DB, orderId: string) {
  return db
    .prepare(
      "SELECT id,kind,source,reference,created FROM rc_payment_history WHERE order_id=? ORDER BY created,rowid",
    )
    .all(orderId)
    .map((r: any) => ({
      id: r.id,
      kind: r.kind,
      source: r.source,
      reference: r.reference,
      at: new Date(r.created).toISOString(),
    }));
}
