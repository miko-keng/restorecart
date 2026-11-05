import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  openRC,
  createIncident,
  incident,
  reserve,
  lock,
  commitCapture,
} from "../server/restorecart/store";
import { accountTables } from "../server/restorecart/accounts";
import { addSample } from "../server/restorecart/sources";
import {
  reconstructWithAgents,
  reviewWithAgents,
  agentProgress,
} from "../server/restorecart/agentCoordinator";
import { prepareSampleShop } from "../server/restorecart/demo";
import { planOperations } from "../server/restorecart/operationsAgent";
import { savePickupAvailability } from "../server/restorecart/pickups";
// Explicit opt-in live evaluation on owned synthetic examples. No PayPal calls.
if (!process.env.GEMINI_API_KEY) throw Error("Configure Gemini privately.");
const db = openRC(":memory:");
accountTables(db);
const report: any = {
  generatedAt: new Date().toISOString(),
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  kind: "actual Gemini specialized-agent workflow on synthetic source files and controlled orders",
  phase: process.env.RESTORECART_AGENT_CHECK_PHASE || "all",
  requests: [],
  passed: false,
  paymentProviderCalls: 0,
};
const transport: typeof fetch = async (url, init) => {
  const started = Date.now(),
    r = await fetch(url, init);
  const b: any = await r.clone().json();
  report.requests.push({
    status: r.status,
    elapsedMs: Date.now() - started,
    usage: b.usageMetadata || null,
  });
  return r;
};
try {
  if (process.env.RESTORECART_AGENT_CHECK_PHASE !== "operations") {
    const shop = createIncident(db, "Live agent evidence example");
    await addSample(db, shop.id);
    try {
      await reconstructWithAgents(db, shop.id, transport);
    } catch (error) {
      report.catalogError =
        error instanceof Error ? error.message : "Catalog request failed";
      // Continue checking the independent roles with explicitly parsed synthetic records.
      const { deterministicCandidates, sourceList } =
        await import("../server/restorecart/sources");
      const { incident, save } = await import("../server/restorecart/store");
      const draft = incident(db, shop.id);
      draft.products = deterministicCandidates(sourceList(db, shop.id));
      save(db, draft);
    }
    let run = agentProgress(db, shop.id)!;
    report.catalogRun = run;
    // If catalog consumed the shared budget, explicitly request a new review run.
    try {
      if (
        !run?.steps.some(
          (s: any) =>
            s.role === "conflict_investigator" && s.status === "completed",
        )
      ) {
        const review = await reviewWithAgents(db, shop.id, transport, true);
        report.investigation = {
          summary: review.summary,
          questions: review.questions,
          suggestions: review.suggestions,
          run: agentProgress(db, shop.id),
        };
      } else
        report.investigation = {
          runId: run.steps.find((s: any) => s.role === "conflict_investigator")
            .runId,
        };
    } catch (error) {
      report.investigationError =
        error instanceof Error ? error.message : "Investigator request failed";
    }
    assert.equal(incident(db, shop.id).state, "draft");
    if (!report.investigationError) {
      const saved = db
        .prepare("SELECT value FROM rc_meta WHERE key=?")
        .get(`catalog-review:${shop.id}`) as any;
      const answer = JSON.parse(saved.value).answer;
      assert.ok(
        answer.questions.some(
          (q: any) => q.sku === "MUG-BLU" && /price/i.test(q.text),
        ),
      );
      assert.ok(
        answer.suggestions.every(
          (s: any) => s.field !== "price" || s.applicable === false,
        ),
      );
    }
  }
  const sample = await prepareSampleShop(db),
    ids = [];
  for (let n = 0; n < 2; n++) {
    const o = reserve(
      db,
      sample.id,
      `controlled-agent-buyer-${n}`,
      `controlled-agent-key-${n}`,
      "controlled-token",
      sample.published!.revision,
      [{ sku: "MUG-BLU", quantity: 1 }],
    );
    db.prepare("UPDATE rc_orders SET state='awaiting_buyer' WHERE id=?").run(
      o.id,
    );
    lock(db, o.id);
    commitCapture(db, o.id, `CONTROLLED-NO-PAYPAL-${n}`);
    ids.push(o.id);
  }
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  savePickupAvailability(db, sample.id, {
    day,
    timezone: "UTC",
    start: day + "T10:00:00Z",
    end: day + "T12:00:00Z",
  });
  const before = JSON.stringify(
    db.prepare("SELECT * FROM rc_orders ORDER BY id").all(),
  );
  const plan = await planOperations(
    db,
    sample.id,
    { goal: "pickups", from: day + "T10:00:00Z" },
    transport,
  );
  report.operations = {
    source: plan.source,
    actions: plan.actions,
    pickups: plan.pickups,
    run: agentProgress(db, sample.id),
  };
  assert.equal(plan.pickups.length, 2);
  assert.ok(
    Date.parse(plan.pickups[0].end) <= Date.parse(plan.pickups[1].start),
  );
  assert.equal(
    JSON.stringify(db.prepare("SELECT * FROM rc_orders ORDER BY id").all()),
    before,
  );
  assert.equal(
    db.prepare("SELECT count(*) n FROM rc_meta WHERE key GLOB 'pickup:*'").get()
      ?.n,
    0,
  );
  report.checks = {
    ...(process.env.RESTORECART_AGENT_CHECK_PHASE !== "operations"
      ? {
          catalogRemainsDraft: true,
          priceConflictStillRequiresSeller: !report.investigationError,
        }
      : {}),
    nonOverlappingPickupProposals: true,
    noOrderMutations: true,
    noAppointmentsSaved: true,
  };
  report.passed = !report.catalogError && !report.investigationError;
} catch (error) {
  report.error =
    error instanceof Error ? error.message : "Live agent check failed";
  process.exitCode = 1;
} finally {
  db.close();
  writeFileSync(
    process.env.RESTORECART_AGENT_CHECK_PHASE === "operations"
      ? "tests/evidence/restorecart-live-operations.json"
      : "tests/evidence/restorecart-live-agents.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: report.passed,
      calls: report.requests.length,
      error: report.error || null,
    }),
  );
}
