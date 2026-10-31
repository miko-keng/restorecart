import { type DB } from "./store";
export function workerEvent(
  db: DB,
  outcome: "started" | "completed" | "retry",
  stage = "worker",
  incidentId = "",
) {
  const key = `worker:${incidentId || "global"}`;
  const old = JSON.parse(
    String(
      (db.prepare("SELECT value FROM rc_meta WHERE key=?").get(key) as any)
        ?.value || "{}",
    ),
  );
  const value = {
    ...old,
    heartbeat: Date.now(),
    ...(outcome === "completed" ? { completedAt: Date.now() } : {}),
    ...(outcome === "retry"
      ? { lastFailureAt: Date.now(), retries: (old.retries || 0) + 1, stage }
      : {}),
  };
  db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
    key,
    JSON.stringify(value),
  );
  if (outcome === "retry")
    console.warn(
      JSON.stringify({
        event: "restorecart_worker_retry",
        stage,
        time: new Date().toISOString(),
      }),
    );
}
export function workerStatus(db: DB, incidentId: string) {
  const read = (key: string) =>
    JSON.parse(
      String(
        (db.prepare("SELECT value FROM rc_meta WHERE key=?").get(key) as any)
          ?.value || "{}",
      ),
    );
  const global = read("worker:global"),
    own = read(`worker:${incidentId}`);
  const pending = Number(
    (
      db
        .prepare(
          "SELECT count(*) n FROM rc_orders WHERE incident=? AND state IN ('capture_requested','pending','needs_reconciliation')",
        )
        .get(incidentId) as any
    ).n,
  );
  const refunds = Number(
    (
      db
        .prepare(
          "SELECT count(*) n FROM rc_refunds r JOIN rc_orders o ON r.order_id=o.id WHERE o.incident=? AND r.state='checking'",
        )
        .get(incidentId) as any
    ).n,
  );
  return {
    heartbeat: global.heartbeat || null,
    completedAt: global.completedAt || null,
    pending: pending + refunds,
    retries: own.retries || 0,
    lastFailureAt: own.lastFailureAt || null,
    delayed:
      !!(pending + refunds) &&
      (!global.completedAt ||
        Date.now() - global.completedAt > 45000 ||
        Date.now() - (own.lastFailureAt || 0) < 60000),
  };
}
