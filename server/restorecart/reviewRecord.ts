import { readFileSync } from "node:fs";
import { hash } from "./domain";
import { incident, type DB } from "./store";
import { sourceList } from "./sources";
export function reviewFingerprint(products: any[], sources: any[]) {
  const sourceHashes = new Map(sources.map((s) => [s.id, s.hash]));
  return hash(
    JSON.stringify({
      sources: sources.map((s) => s.hash).sort(),
      products: products
        .map((p) => ({
          sku: p.sku,
          name: p.name,
          price: p.price,
          currency: p.currency,
          description: p.description || "",
          image: p.imageSourceId
            ? sourceHashes.get(p.imageSourceId) || "missing"
            : "",
          excluded: !!p.excluded,
          candidates: (p.candidates || [])
            .map((e: any) => ({
              ...e,
              sourceId: sourceHashes.get(e.sourceId) || "missing",
            }))
            .sort((a: any, b: any) =>
              JSON.stringify(a).localeCompare(JSON.stringify(b)),
            ),
        }))
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    }),
  );
}
export function rememberReview(
  db: DB,
  id: string,
  answer: any,
  products: any[],
  sources: any[],
) {
  const envelope = {
    schemaVersion: 1,
    origin: {
      kind: process.env.NODE_ENV === "test" ? "injected-test" : "live",
      generatedOn: answer.generatedAt,
      model: answer.model,
    },
    fingerprint: reviewFingerprint(products, sources),
    sources: sources.map((s) => ({ id: s.id, name: s.name, hash: s.hash })),
    answer,
  };
  db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
    `catalog-review:${id}`,
    JSON.stringify(envelope),
  );
}
export function readSavedReview(db: DB, id: string) {
  const shop = incident(db, id),
    sources = sourceList(db, id);
  const row = db
    .prepare("SELECT value FROM rc_meta WHERE key=?")
    .get(`catalog-review:${id}`) as any;
  let envelope: any;
  if (row) envelope = JSON.parse(row.value);
  else if ((shop as any).demoPrepared)
    envelope = JSON.parse(
      readFileSync(
        new URL("./fixtures/sunday-studio-gemini-review.json", import.meta.url),
        "utf8",
      ),
    );
  else return null;
  const stale =
    envelope.fingerprint !== reviewFingerprint(shop.products, sources);
  const sourceFor = (oldId: string) => {
    const old = envelope.sources.find((s: any) => s.id === oldId);
    return { old, current: sources.find((s) => s.hash === old?.hash) };
  };
  return {
    ...envelope.answer,
    citedSources: envelope.sources.map((s: any) => ({
      originalId: s.id,
      id: sources.find((n) => n.hash === s.hash)?.id || "",
      name: s.name,
    })),
    saved: true,
    savedDemo: envelope.origin.kind === "recorded-live-demo",
    origin: envelope.origin,
    stale,
    inputFingerprint: envelope.fingerprint,
    suggestions: envelope.answer.suggestions.map((s: any) => {
      const ref = sourceFor(s.sourceId);
      return {
        ...s,
        sourceId: ref.current?.id || "",
        originalSourceName: ref.old?.name || "Original source",
        value:
          s.field === "imageSourceId"
            ? sourceFor(s.value).current?.id || ""
            : s.value,
        applicable:
          !stale && !!ref.current && shop.products.some((p) => p.sku === s.sku),
      };
    }),
    questions: envelope.answer.questions.map((q: any) => {
      const p = shop.products.find((p) => p.sku === q.sku);
      return {
        ...q,
        sellerConfirmed: !!p?.resolved && !!p?.resolutionNote,
        sellerResponse:
          p?.resolved && p?.resolutionNote
            ? `${p.price} ${p.currency} — ${p.resolutionNote}`
            : null,
      };
    }),
  };
}
