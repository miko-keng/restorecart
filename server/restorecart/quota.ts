import { tx, type DB } from "./store";
import { fail } from "./domain";
export type QuotaPolicy = {
  sellerCallsPerWindow: number;
  globalCallsPerWindow: number;
  windowSeconds: number;
};
export function quotaOwner(db: DB, incidentId: string) {
  if (
    !db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='rc_owners'",
      )
      .get()
  )
    return "configured-seller";
  return String(
    (
      db
        .prepare(
          "SELECT account_id FROM rc_owners WHERE kind='incident' AND id=?",
        )
        .get(incidentId) as any
    )?.account_id || "configured-seller",
  );
}
function table(db: DB) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS rc_ai_usage(scope TEXT NOT NULL, window INTEGER NOT NULL, used INTEGER NOT NULL, PRIMARY KEY(scope,window))",
  );
}
export function allowance(
  db: DB,
  owner: string,
  policy: QuotaPolicy,
  now = Date.now(),
) {
  table(db);
  const window = Math.floor(now / (policy.windowSeconds * 1000));
  const used = (scope: string) =>
    Number(
      (
        db
          .prepare("SELECT used FROM rc_ai_usage WHERE scope=? AND window=?")
          .get(scope, window) as any
      )?.used || 0,
    );
  const sellerRemaining = Math.max(
    0,
    policy.sellerCallsPerWindow - used(`seller:${owner}`),
  );
  const globalRemaining = Math.max(
    0,
    policy.globalCallsPerWindow - used("global"),
  );
  return {
    remaining: Math.min(sellerRemaining, globalRemaining),
    sellerRemaining,
    limit: policy.sellerCallsPerWindow,
    retryAt: new Date((window + 1) * policy.windowSeconds * 1000).toISOString(),
    limited: !sellerRemaining || !globalRemaining,
  };
}
export function claim(
  db: DB,
  owner: string,
  policy: QuotaPolicy,
  now = Date.now(),
) {
  table(db);
  return tx(db, () => {
    const a = allowance(db, owner, policy, now);
    if (a.limited)
      fail(
        `Gemini allowance reached. Try again after ${a.retryAt}. Your saved work is preserved.`,
        429,
      );
    const window = Math.floor(now / (policy.windowSeconds * 1000));
    for (const scope of ["global", `seller:${owner}`])
      db.prepare(
        "INSERT INTO rc_ai_usage VALUES(?,?,1) ON CONFLICT(scope,window) DO UPDATE SET used=used+1",
      ).run(scope, window);
    db.prepare("DELETE FROM rc_ai_usage WHERE window<?").run(window - 2);
    return allowance(db, owner, policy, now);
  });
}
