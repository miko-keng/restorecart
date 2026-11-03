import { z } from "zod";
import { fail, uid } from "./domain";
import { type DB } from "./store";
import { readSavedReview } from "./reviewRecord";
import { sourceList } from "./sources";

export const decisionInput = z
  .object({
    field: z.enum(["name", "description", "price", "imageSourceId"]),
    value: z.string().max(1000),
    sourceId: z.string().max(100),
    choice: z.enum(["accepted", "rejected"]),
    fingerprint: z.string().max(100),
  })
  .strict();
export function recordProductDecision(
  db: DB,
  shopId: string,
  actor: string,
  before: any,
  after: any,
  input: any,
) {
  const choices = input.reviewDecisions || [];
  const review = choices.length ? readSavedReview(db, shopId) : null;
  const decisions = choices.map((choice: any) => {
    const s = review?.suggestions.find(
      (s: any) =>
        s.sku === after.sku &&
        s.field === choice.field &&
        s.value === choice.value &&
        s.sourceId === choice.sourceId,
    );
    if (!s || choice.fingerprint !== review.inputFingerprint)
      fail(
        "The AI review changed. Reopen its findings before saving this decision.",
        409,
      );
    if (
      choice.choice === "accepted" &&
      (review.stale || s.applicable === false)
    )
      fail(
        "This AI suggestion is outdated. Review the current records before accepting it.",
        409,
      );
    return {
      field: s.field,
      proposed: s.value,
      finalValue: String(after[s.field] || ""),
      choice:
        choice.choice === "accepted" && String(after[s.field] || "") !== s.value
          ? "overridden"
          : choice.choice,
      sourceId: s.sourceId,
      reason: s.reason,
      excerpt: s.excerpt,
      model: review.model,
      requestedChoice: choice.choice,
      reviewWasStale: review.stale,
      reviewGeneratedAt: review.generatedAt,
      reviewFingerprint: review.inputFingerprint,
    };
  });
  const fields = [
    "name",
    "description",
    "price",
    "imageSourceId",
    "allocation",
    "excluded",
    "resolved",
    "resolutionNote",
  ];
  const changes = fields
    .filter(
      (f) =>
        JSON.stringify(before?.[f] ?? null) !==
        JSON.stringify(after[f] ?? null),
    )
    .map((field) => ({
      field,
      before: before?.[field] ?? null,
      after: after[field] ?? null,
    }));
  // Stock count and confirmation are seller assertions, not inferred AI facts.
  changes.push({
    field: "physicalCount",
    before: input.previousCount ?? null,
    after: input.quantity,
  });
  const sources = sourceList(db, shopId)
    .filter(
      (s) =>
        after.candidates?.some((c: any) => c.sourceId === s.id) ||
        decisions.some((d: any) => d.sourceId === s.id),
    )
    .map((s) => ({ id: s.id, name: s.name, hash: s.hash }));
  db.prepare("INSERT INTO rc_decisions VALUES(?,?,?,?,?,?)").run(
    uid("decision"),
    shopId,
    after.sku,
    actor,
    Date.now(),
    JSON.stringify({
      action: input.action,
      changes,
      decisions,
      sources,
      sellerConfirmed: input.confirm,
      revision: input.revision + 1,
    }),
  );
}
export function decisionHistory(db: DB, shopId: string, sku: string) {
  return db
    .prepare(
      "SELECT id,actor,created,body FROM rc_decisions WHERE incident=? AND sku=? ORDER BY created DESC,rowid DESC LIMIT 100",
    )
    .all(shopId, sku)
    .map((r: any) => ({
      id: r.id,
      actor: r.actor,
      at: new Date(r.created).toISOString(),
      ...JSON.parse(r.body),
    }));
}
