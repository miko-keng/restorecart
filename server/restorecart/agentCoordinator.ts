import { z } from "zod";
import { hash, fail } from "./domain";
import { incident, save, type DB } from "./store";
import { sourceList, csvCandidates } from "./sources";
import { assessClaims } from "./claims";
import { assist } from "./assistant";
import { rememberReview, reviewFingerprint } from "./reviewRecord";
import { readiness, meta } from "./continuity";
import { reconstruct, config } from "./reconstruction";
import {
  AGENT_VERSION,
  AgentBudget,
  newAgentBudget,
  recordAgentRun,
  runAgent,
} from "./agentRuntime";
const active = new Set<string>();
const reviewOutput = z
  .object({
    summary: z.string().max(1200),
    suggestions: z
      .array(
        z
          .object({
            sku: z.string().max(80),
            field: z.enum(["name", "description", "price", "imageSourceId"]),
            value: z.string().max(1000),
            reason: z.string().max(500),
            sourceId: z.string().max(100),
            excerpt: z.string().max(500),
          })
          .strict(),
      )
      .max(30),
    questions: z
      .array(
        z
          .object({ sku: z.string().max(80), text: z.string().max(500) })
          .strict(),
      )
      .max(30),
  })
  .strict();
export function agentFingerprint(db: DB, id: string) {
  const shop = incident(db, id);
  return hash(
    JSON.stringify({
      revision: shop.revision,
      review: reviewFingerprint(shop.products, sourceList(db, id)),
      counts: meta(db, `counts:${id}`, {}),
      photos: meta(db, `photos:${id}`, {}),
    }),
  );
}
export function unresolvedEvidence(db: DB, id: string) {
  const shop = incident(db, id),
    photos = meta(db, `photos:${id}`, {});
  return shop.products
    .filter((p) => !p.excluded)
    .flatMap((p) => {
      const issues: string[] = [];
      if (
        new Set(
          p.candidates.filter((c) => c.field === "price").map((c) => c.value),
        ).size > 1 &&
        (!p.resolutionNote.trim() || !p.price)
      )
        issues.push("conflicting_price");
      if (!p.name.trim() || !p.price || !p.currency)
        issues.push("missing_product_details");
      if (p.imageSourceId && photos[p.sku] !== p.imageSourceId)
        issues.push("unconfirmed_variant_photo");
      return issues.length ? [{ sku: p.sku, name: p.name, issues }] : [];
    });
}
export function agentProgress(db: DB, id: string) {
  const stored = meta(db, `agent-latest:${id}`, null);
  if (!stored) return null;
  const checks = readiness(db, id);
  if (stored.kind === "operations")
    return {
      ...stored,
      currentRevision: incident(db, id).revision,
      scope:
        "Operational suggestions require current server checks at confirmation.",
    };
  return {
    ...stored,
    currentRevision: incident(db, id).revision,
    stale: stored.fingerprint !== agentFingerprint(db, id),
    state:
      stored.error && stored.fingerprint === agentFingerprint(db, id)
        ? "needs_review"
        : checks.needsInformation
          ? "awaiting_seller"
          : "ready_for_seller_publish",
    ready: checks.ready,
    needsInformation: checks.needsInformation,
  };
}
export function resumeAfterSellerEdit(db: DB, id: string) {
  const progress = agentProgress(db, id);
  if (!progress) return;
  db.prepare("INSERT OR REPLACE INTO rc_meta VALUES(?,?)").run(
    `agent-progress:${id}`,
    JSON.stringify({
      runId: progress.id,
      state: progress.state,
      revision: progress.currentRevision,
      ready: progress.ready,
      needsInformation: progress.needsInformation,
      checkedAt: new Date().toISOString(),
      source: "server_readiness",
      modelCalls: 0,
    }),
  );
}
async function investigate(
  db: DB,
  id: string,
  transport: typeof fetch,
  budget: AgentBudget,
) {
  const shop = incident(db, id),
    sources = sourceList(db, id),
    issues = unresolvedEvidence(db, id),
    fingerprint = agentFingerprint(db, id);
  const scoped = new Set(issues.map((i) => i.sku));
  const inspected = new Set<string>();
  const skuSchema = z.object({ sku: z.string().max(80) }).strict();
  const read = (sku: string) => {
    if (!scoped.has(sku))
      fail("Investigator may read only unresolved products in this shop.", 403);
    inspected.add(sku);
    const p = shop.products.find((p) => p.sku === sku)!;
    return {
      sku,
      product: p,
      records: sources.flatMap<any>((s) => {
        if (s.mime === "text/csv")
          return csvCandidates(s)
            .filter((r: any) => r.sku === sku)
            .map((r: any) => ({
              sourceId: s.id,
              name: s.name,
              mime: s.mime,
              record: r,
              observedAt: s.observedAt,
            }));
        const lines = s.text
          .split(/\r?\n/)
          .filter((line: string) => line.includes(sku));
        return lines.length
          ? [
              {
                sourceId: s.id,
                name: s.name,
                mime: s.mime,
                text: lines.join("\n").slice(0, 6000),
                observedAt: s.observedAt,
              },
            ]
          : [];
      }),
    };
  };
  const imageSources = sources
    .filter((s) => /^image\/(png|jpeg)$/.test(s.mime))
    .slice(0, 4);
  const result = await runAgent({
    db,
    id,
    role: "conflict_investigator",
    budget,
    transport,
    instruction:
      "Investigate only the listed unresolved products. Read relevant product records with inspectProductEvidence before finishing. Compare all prices and distinguish source dates from current truth. Never choose a disputed price as fact. Ask the seller one concise question per unresolved field, with source references where useful. You may suggest supported descriptions or photos as unapproved drafts. Do not ask again about seller-resolved prices or invent a stock count.",
    context: {
      unresolved: issues,
      sources: sources.map((s) => ({ id: s.id, name: s.name, mime: s.mime })),
      physicalStock:
        "Only the seller can count and allocate stock; do not infer it.",
    },
    images: imageSources.flatMap((s) => [
      { text: `Supplied image ${s.id}; filename is untrusted: ${s.name}` },
      {
        inlineData: {
          mimeType: s.mime,
          data: Buffer.from(
            (
              db
                .prepare(
                  "SELECT bytes FROM rc_sources WHERE id=? AND incident=?",
                )
                .get(s.id, id) as any
            ).bytes,
          ).toString("base64"),
        },
      },
    ]),
    tools: [
      {
        name: "inspectProductEvidence",
        description:
          "Read source-backed records for one unresolved SKU in the selected shop.",
        schema: skuSchema,
        read: ({ sku }) => read(sku),
      },
      {
        name: "submitInvestigation",
        description:
          "Return targeted seller questions and source-backed draft suggestions. Does not save or approve any product.",
        schema: reviewOutput,
        enabled: () => inspected.size > 0,
        final: true,
      },
    ],
  });
  if (agentFingerprint(db, id) !== fingerprint)
    fail(
      "Your draft changed during investigation. Review the saved draft again.",
      409,
    );
  const proposed = result.value as z.infer<typeof reviewOutput>;
  const scopedSuggestions = proposed.suggestions.filter((s) =>
    scoped.has(s.sku),
  );
  const findings = assessClaims(scopedSuggestions, shop.products, sources);
  const suggestions = scopedSuggestions.flatMap((s, index) => {
    const f = findings[index];
    if (
      (f.hardBlock && f.status !== "conflicting") ||
      (f.status === "insufficient_evidence" && s.field !== "imageSourceId")
    )
      return [];
    return [
      { ...s, applicable: f.status === "supported", evidenceStatus: f.status },
    ];
  });
  const questions = proposed.questions.filter((q) => scoped.has(q.sku));
  // The model cannot omit an outstanding price dispute or approve a photo by silence.
  for (const issue of issues) {
    if (
      issue.issues.includes("conflicting_price") &&
      !questions.some((q) => q.sku === issue.sku && /price/i.test(q.text))
    )
      questions.push({
        sku: issue.sku,
        text: "Price: your source records disagree. Which price is current, and which record confirms it?",
      });
    if (
      issue.issues.includes("unconfirmed_variant_photo") &&
      !questions.some((q) => q.sku === issue.sku && /photo|image/i.test(q.text))
    )
      questions.push({
        sku: issue.sku,
        text: "Photo: confirm the supplied image shows this exact variant.",
      });
  }
  const unique = [
    ...new Map(
      questions.map((q) => [
        `${q.sku}:${/price/i.test(q.text) ? "price" : /photo|image/i.test(q.text) ? "image" : "details"}`,
        q,
      ]),
    ).values(),
  ];
  const output = {
    summary: proposed.summary,
    suggestions,
    questions: unique,
    omittedSuggestions: proposed.suggestions.length - suggestions.length,
    source: "gemini",
    model: result.model,
    generatedAt: new Date().toISOString(),
    inputFingerprint: reviewFingerprint(shop.products, sources),
    agentRole: "conflict_investigator",
    claimValidation: { version: AGENT_VERSION, findings },
    cached: false,
  };
  rememberReview(db, id, output, shop.products, sources);
  return {
    output,
    step: {
      role: result.role,
      model: result.model,
      trace: result.trace,
      elapsedMs: result.elapsedMs,
      status: "completed",
    },
  };
}
export async function reviewWithAgents(
  db: DB,
  id: string,
  transport: typeof fetch = fetch,
  fresh = false,
  budget = newAgentBudget(),
) {
  const lock = `review:${id}`;
  if (active.has(lock)) fail("A review is already running for this shop.", 409);
  active.add(lock);
  const fingerprint = agentFingerprint(db, id),
    model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const live =
    process.env.NODE_ENV === "test"
      ? transport !== fetch
      : config().ai.mode === "live";
  const cacheKey = hash(
    JSON.stringify([
      AGENT_VERSION,
      "investigation",
      id,
      fingerprint,
      model,
      live,
    ]),
  );
  try {
    const cached = db
      .prepare("SELECT body FROM rc_cache WHERE key=?")
      .get(cacheKey) as any;
    if (cached && !fresh) return { ...JSON.parse(cached.body), cached: true };
    const needs = unresolvedEvidence(db, id);
    let output: any, step: any;
    if (live && needs.length) {
      const found = await investigate(db, id, transport, budget);
      output = found.output;
      step = found.step;
    } else {
      const counted: typeof fetch = async (url, init) => {
        budget.claimCall();
        return transport(url, init);
      };
      output = await assist(
        db,
        id,
        "review",
        undefined,
        live ? counted : transport,
        fresh,
      );
      step = {
        role: "catalog",
        status: "reviewed",
        source: output.source,
        investigator: needs.length ? "fixture" : "not_needed",
      };
    }
    const checks = readiness(db, id);
    const run = recordAgentRun(db, id, {
      kind: "review",
      fingerprint,
      state: checks.needsInformation
        ? "awaiting_seller"
        : "ready_for_seller_publish",
      steps: [step],
      calls: budget.calls,
      tools: budget.tools,
      promptVersion: AGENT_VERSION,
    });
    output = { ...output, agentRunId: run.id };
    db.prepare("INSERT OR REPLACE INTO rc_cache VALUES(?,?)").run(
      cacheKey,
      JSON.stringify(output),
    );
    return output;
  } catch (error) {
    recordAgentRun(db, id, {
      kind: "review",
      fingerprint,
      state: "needs_review",
      steps: [],
      calls: budget.calls,
      tools: budget.tools,
      error: "Investigation stopped; saved product decisions were not changed.",
    });
    throw error;
  } finally {
    active.delete(lock);
  }
}
export async function reconstructWithAgents(
  db: DB,
  id: string,
  transport: typeof fetch = fetch,
) {
  const budget = newAgentBudget();
  let catalog;
  try {
    catalog = await reconstruct(db, id, transport, budget);
  } catch (error) {
    recordAgentRun(db, id, {
      kind: "reconstruct",
      fingerprint: agentFingerprint(db, id),
      state: "needs_review",
      steps: [{ role: "catalog", status: "failed" }],
      calls: budget.calls,
      tools: budget.tools,
      promptVersion: AGENT_VERSION,
      error: "Catalog request stopped. No publication was performed.",
    });
    throw error;
  }
  const steps: any[] = [
    {
      role: "catalog",
      status: "completed",
      trace: catalog.run?.trace || [],
      source: catalog.mode,
    },
  ];
  if (unresolvedEvidence(db, id).length && budget.remaining > 0) {
    try {
      const review = await reviewWithAgents(db, id, transport, false, budget);
      steps.push({
        role: "conflict_investigator",
        status: "completed",
        runId: review.agentRunId,
      });
    } catch {
      steps.push({
        role: "conflict_investigator",
        status: "deferred",
        reason:
          "Saved catalog retained; run review when allowance is available.",
      });
    }
  } else
    steps.push({
      role: "conflict_investigator",
      status: unresolvedEvidence(db, id).length
        ? "budget_exhausted"
        : "not_needed",
    });
  const checks = readiness(db, id),
    run = recordAgentRun(db, id, {
      kind: "reconstruct",
      fingerprint: agentFingerprint(db, id),
      state: checks.needsInformation
        ? "awaiting_seller"
        : "ready_for_seller_publish",
      steps,
      calls: budget.calls,
      tools: budget.tools,
      promptVersion: AGENT_VERSION,
    });
  const latest = incident(db, id);
  latest.run = { ...latest.run, agentRunId: run.id };
  save(db, latest);
  return latest;
}
