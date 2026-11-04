import { writeFileSync } from "node:fs";
import { openRC, createIncident, incident } from "../server/restorecart/store";
import { addSample, sourceList } from "../server/restorecart/sources";
import { reconstruct } from "../server/restorecart/reconstruction";
import { assist } from "../server/restorecart/assistant";
import {
  verifyClaims,
  mergeVerification,
} from "../server/restorecart/claimVerifier";
import { assessClaims } from "../server/restorecart/claims";
// Two calls maximum: fixture reconstruction is deterministic; one live producer + one checker.
process.env.NODE_ENV = "test";
process.env.RESTORECART_AI_VERIFIER = "off";
if (!process.env.GEMINI_API_KEY)
  throw Error("Supply Gemini credentials through the environment.");
const db = openRC(":memory:");
const report: any = {
  generatedAt: new Date().toISOString(),
  kind: "actual Gemini review producer and independent checker, same producer output",
  calls: [],
  passed: false,
};
try {
  const shop = createIncident(db, "Synthetic verification catalog");
  await addSample(db, shop.id);
  await reconstruct(db, shop.id);
  let rawProposals: any[] = [];
  const traced: typeof fetch = async (url, init) => {
    const started = Date.now(),
      response = await fetch(url, init);
    const body: any = await response.clone().json();
    if (report.calls.length === 0) {
      const parts = body.candidates?.[0]?.content?.parts || [];
      const proposal = parts.find(
        (p: any) => p.functionCall?.name === "submitReview",
      )?.functionCall?.args;
      rawProposals = proposal?.suggestions || [];
    }
    report.calls.push({
      status: response.status,
      elapsedMs: Date.now() - started,
      usage: body.usageMetadata || null,
    });
    return response;
  };
  const produced = await assist(db, shop.id, "review", undefined, traced, true);
  const products = incident(db, shop.id).products,
    sources = sourceList(db, shop.id);
  report.producer = produced;
  report.evidence = { products, sources: sources.map(s => ({ id:s.id, mime:s.mime, text:s.text, columnMapping:s.columnMapping })) };
  // Include all proposals the producer generated, before server filtering.
  report.rawProposals = rawProposals;
  const claims = rawProposals;
  if (claims.length) {
    const base = assessClaims(claims, products, sources);
    const checked = await verifyClaims({
      claims,
      products,
      sources: sources.map((s) => ({ id: s.id, mime: s.mime, text: s.text })),
      images: [],
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      key: process.env.GEMINI_API_KEY!,
      transport: traced,
    });
    report.checker = checked;
    report.combined = mergeVerification(base, checked.findings);
  } else
    report.checker = {
      skipped: "Producer returned no actionable suggestions.",
    };
  report.activationDecision =
    "off: no demonstrated additional unsafe proposal caught on this live producer sample";
  report.passed = true;
  report.limitations =
    "Single synthetic catalog; not a production accuracy estimate. No seller records, payments or stock modified. Server validation and seller approval remain authoritative.";
} catch {
  report.error =
    "Live comparison unavailable; no private provider response retained.";
  process.exitCode = 1;
} finally {
  db.close();
  writeFileSync(
    "tests/evidence/restorecart-producer-comparison.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: report.passed,
      calls: report.calls.length,
      activationDecision: report.activationDecision,
    }),
  );
}
