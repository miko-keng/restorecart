import { accountTables } from "../server/restorecart/accounts";
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  openRC,
  createIncident,
  incident,
  save,
  reserve,
  lock,
  commitCapture,
  order,
} from "../server/restorecart/store";
import {
  addSample,
  deterministicCandidates,
  sourceList,
} from "../server/restorecart/sources";
import { AgentBudget, runAgent } from "../server/restorecart/agentRuntime";
import {
  reviewWithAgents,
  reconstructWithAgents,
  unresolvedEvidence,
  agentProgress,
  resumeAfterSellerEdit,
} from "../server/restorecart/agentCoordinator";
import {
  planOperations,
  decideOperation,
  proposePickupSlots,
} from "../server/restorecart/operationsAgent";
import { prepareSampleShop } from "../server/restorecart/demo";
import {
  savePickupAvailability,
  savePickupWindow,
} from "../server/restorecart/pickups";
import { putMeta } from "../server/restorecart/continuity";
import {
  allowedOrderActions,
  nextOrderAction,
} from "../src/restorecart/orderAdvice";
import { readApiResponse } from "../src/restorecart/apiResponse";
function reply(name: string, args: any) {
  return Response.json({
    candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }],
    usageMetadata: { totalTokenCount: 42 },
  });
}
async function catalog() {
  const db = openRC(":memory:"),
    shop = createIncident(db);
  await addSample(db, shop.id);
  shop.products = deterministicCandidates(sourceList(db, shop.id));
  save(db, shop);
  return { db, id: shop.id };
}
async function operationFixture() {
  const db = openRC(":memory:");
  accountTables(db);
  const shop = await prepareSampleShop(db);
  const purchases = [];
  for (let n = 0; n < 2; n++) {
    const o = reserve(
      db,
      shop.id,
      `agent-buyer-${n}`,
      `agent-key-${n}`,
      `controlled-${n}`,
      shop.published!.revision,
      [{ sku: "MUG-BLU", quantity: 1 }],
    );
    db.prepare("UPDATE rc_orders SET state='awaiting_buyer' WHERE id=?").run(
      o.id,
    );
    lock(db, o.id);
    commitCapture(db, o.id, `CONTROLLED-AGENT-${n}`);
    purchases.push(o.id);
  }
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  savePickupAvailability(db, shop.id, {
    day,
    timezone: "UTC",
    start: day + "T10:00:00Z",
    end: day + "T12:00:00Z",
  });
  return { db, id: shop.id, purchases, from: day + "T10:00:00Z" };
}
function orderSnapshot(db: any) {
  return JSON.stringify({
    orders: db.prepare("SELECT * FROM rc_orders ORDER BY id").all(),
    moves: db.prepare("SELECT * FROM rc_moves ORDER BY event_key").all(),
    holds: db.prepare("SELECT * FROM rc_holds ORDER BY order_id").all(),
    pickups: db
      .prepare("SELECT * FROM rc_meta WHERE key GLOB 'pickup:*' ORDER BY key")
      .all(),
  });
}

test("API decoding turns interrupted publish/HTML replies into actionable uncertainty, never raw parser errors", async () => {
  await assert.rejects(
    readApiResponse(
      new Response("<html>Bad Gateway</html>", { status: 502 }),
      "/incidents/x/publish",
    ),
    /check whether it published/,
  );
  await assert.rejects(
    readApiResponse(new Response("", { status: 503 }), "/orders"),
    /incomplete response/,
  );
  await assert.rejects(
    readApiResponse(
      Response.json(
        { error: { message: "Resolve the price conflict" } },
        { status: 409 },
      ),
      "/publish",
    ),
    /Resolve the price conflict/,
  );
  assert.deepEqual(
    await readApiResponse(Response.json({ published: true }), "/publish"),
    { published: true },
  );
});
test("Agent runtime rejects write tools and enforces a shared model/tool budget", async () => {
  const db = openRC(":memory:"),
    shop = createIncident(db);
  try {
    const budget = new AgentBudget(1, 2, 10);
    let calls = 0;
    await assert.rejects(
      runAgent({
        db,
        id: shop.id,
        role: "test",
        instruction: "Read only",
        context: {},
        budget,
        transport: (async () => {
          calls++;
          return reply("issueRefund", { amount: 100 });
        }) as typeof fetch,
        tools: [
          {
            name: "inspect",
            description: "Read",
            schema: z.object({}).strict(),
            read: () => ({ ok: true }),
          },
        ],
      }),
      /unsupported tool/,
    );
    assert.equal(calls, 1);
    assert.equal(budget.calls, 1);
    assert.throws(() => budget.claimCall(), /budget/);
    assert.equal(db.prepare("SELECT count(*) n FROM rc_orders").get()?.n, 0);
  } finally {
    db.close();
  }
});
test("Conflict investigator reads only unresolved SKU evidence, retains price uncertainty, and caches identical work", async () => {
  const f = await catalog();
  try {
    const before = JSON.stringify(incident(f.db, f.id));
    let calls = 0;
    const transport = (async (_url: any, init: any) => {
      calls++;
      const body = JSON.parse(init.body);
      if (calls === 1) {
        assert.deepEqual(
          body.toolConfig.functionCallingConfig.allowedFunctionNames,
          ["inspectProductEvidence"],
        );
        return reply("inspectProductEvidence", { sku: "MUG-BLU" });
      }
      assert.match(JSON.stringify(body.contents), /20.00/);
      assert.match(JSON.stringify(body.contents), /18.00/);
      return reply("submitInvestigation", {
        summary: "Two recorded prices need the seller's decision.",
        suggestions: [],
        questions: [
          { sku: "MUG-BLU", text: "Price: which recorded price is current?" },
        ],
      });
    }) as typeof fetch;
    const result = await reviewWithAgents(f.db, f.id, transport);
    assert.equal(calls, 2);
    assert.equal(result.agentRole, "conflict_investigator");
    assert.equal(result.questions.length, 1);
    assert.equal(JSON.stringify(incident(f.db, f.id)), before);
    const cached = await reviewWithAgents(f.db, f.id, transport);
    assert.equal(cached.cached, true);
    assert.equal(calls, 2);
    const progress = agentProgress(f.db, f.id)!;
    assert.equal(progress.state, "awaiting_seller");
    assert.equal(progress.calls, 2);
    assert.ok(
      progress.steps[0].trace.some(
        (s: any) => s.name === "inspectProductEvidence",
      ),
    );
  } finally {
    f.db.close();
  }
});
test("Investigator rejects unrelated SKU reads and cannot promote invented descriptions", async () => {
  const f = await catalog();
  try {
    await assert.rejects(
      reviewWithAgents(
        f.db,
        f.id,
        (async () =>
          reply("inspectProductEvidence", {
            sku: "OTHER-SHOP",
          })) as typeof fetch,
        true,
      ),
      /only unresolved products/,
    );
    let n = 0;
    const sid = sourceList(f.db, f.id).find((s) => s.mime === "text/csv")!.id;
    const result = await reviewWithAgents(
      f.db,
      f.id,
      (async () =>
        ++n === 1
          ? reply("inspectProductEvidence", { sku: "MUG-BLU" })
          : reply("submitInvestigation", {
              summary: "Proposal",
              suggestions: [
                {
                  sku: "MUG-BLU",
                  field: "description",
                  value: "Dishwasher-safe guaranteed",
                  sourceId: sid,
                  excerpt: "A blue stoneware mug",
                  reason: "Guess",
                },
              ],
              questions: [],
            })) as typeof fetch,
      true,
    );
    assert.equal(result.suggestions.length, 0);
    assert.ok(result.questions.some((q: any) => /price/i.test(q.text)));
    assert.equal(incident(f.db, f.id).products[0].resolved, false);
  } finally {
    f.db.close();
  }
});
test("Resolved seller choices do not get reinvestigated; readiness resumes without model calls", async () => {
  const f = await catalog();
  try {
    await reviewWithAgents(f.db, f.id);
    const shop = incident(f.db, f.id);
    shop.products = shop.products.map((p) => ({
      ...p,
      price: p.sku === "MUG-BLU" ? "20.00" : p.price,
      resolved: true,
      resolutionNote: "Seller confirmed source",
      allocation: 1,
    }));
    shop.pickup = "Controlled pickup";
    shop.revision++;
    save(f.db, shop);
    putMeta(
      f.db,
      `counts:${f.id}`,
      Object.fromEntries(
        shop.products.map((p) => [
          p.sku,
          { quantity: 1, allocation: 1, at: Date.now() },
        ]),
      ),
    );
    assert.equal(unresolvedEvidence(f.db, f.id).length, 0);
    resumeAfterSellerEdit(f.db, f.id);
    const status = agentProgress(f.db, f.id)!;
    assert.equal(status.state, "ready_for_seller_publish");
    assert.equal(incident(f.db, f.id).state, "draft");
    const record = f.db
      .prepare("SELECT value FROM rc_meta WHERE key=?")
      .get(`agent-progress:${f.id}`) as any;
    assert.equal(JSON.parse(record.value).modelCalls, 0);
  } finally {
    f.db.close();
  }
});
test("Catalog and investigator share one bounded run with an actual handoff", async () => {
  const f = await catalog();
  try {
    let calls = 0;
    const rows = deterministicCandidates(sourceList(f.db, f.id)).map(
      ({ sku, name, description, candidates }) => ({
        sku,
        name,
        description,
        candidates,
      }),
    );
    const transport = (async (_u: any, init: any) => {
      calls++;
      const body = JSON.parse(init.body);
      if (calls === 1) {
        assert.ok(
          body.toolConfig.functionCallingConfig.allowedFunctionNames.includes(
            "readSourceSection",
          ),
        );
        return reply("proposeCatalog", { products: rows });
      }
      if (calls === 2)
        return reply("inspectProductEvidence", { sku: "MUG-BLU" });
      return reply("submitInvestigation", {
        summary: "Seller must select price",
        suggestions: [],
        questions: [{ sku: "MUG-BLU", text: "Which price is current?" }],
      });
    }) as typeof fetch;
    await reconstructWithAgents(f.db, f.id, transport);
    assert.equal(calls, 3);
    const run = agentProgress(f.db, f.id)!;
    assert.equal(run.calls, 3);
    assert.deepEqual(
      run.steps.map((s: any) => s.role),
      ["catalog", "conflict_investigator"],
    );
    assert.equal(incident(f.db, f.id).state, "draft");
  } finally {
    f.db.close();
  }
});
test("Investigation cannot save current findings after a concurrent product edit", async () => {
  const f = await catalog();
  try {
    let calls = 0;
    await assert.rejects(
      reviewWithAgents(f.db, f.id, (async () => {
        if (++calls === 1)
          return reply("inspectProductEvidence", { sku: "MUG-BLU" });
        const shop = incident(f.db, f.id);
        shop.revision++;
        save(f.db, shop);
        return reply("submitInvestigation", {
          summary: "old",
          suggestions: [],
          questions: [],
        });
      }) as typeof fetch),
      /draft changed/,
    );
  } finally {
    f.db.close();
  }
});
test("Operations plans validate actions, avoid overlapping proposals, and never mutate orders or appointments", async () => {
  const f = await operationFixture();
  try {
    const before = orderSnapshot(f.db);
    let calls = 0;
    const fake = (async () =>
      ++calls === 1
        ? reply("findPickupSlots", { orderIds: f.purchases })
        : reply("proposeOperations", {
            actions: [
              ...f.purchases.map((orderId) => ({
                orderId,
                action: "schedule_pickup",
              })),
              { orderId: "other-shop-order", action: "prepare" },
            ],
          })) as typeof fetch;
    const plan = await planOperations(
      f.db,
      f.id,
      { from: f.from, minutes: 20 },
      fake,
    );
    assert.equal(plan.source, "gemini");
    assert.equal(plan.rejectedProposals, 1);
    assert.equal(plan.pickups.length, 2);
    assert.ok(
      Date.parse(plan.pickups[0].end) <= Date.parse(plan.pickups[1].start),
    );
    assert.equal(orderSnapshot(f.db), before);
    const cached = await planOperations(
      f.db,
      f.id,
      { from: f.from, minutes: 20 },
      fake,
    );
    assert.equal(cached.cached, true);
    assert.equal(calls, 2);
  } finally {
    f.db.close();
  }
});
test("Payment checking cannot be silently omitted or replaced with preparation", async () => {
  const f = await operationFixture();
  try {
    f.db
      .prepare("UPDATE rc_orders SET state='pending',capture=NULL WHERE id=?")
      .run(f.purchases[0]);
    const plan = await planOperations(f.db, f.id, { from: f.from }, (async () =>
      reply("proposeOperations", {
        actions: [{ orderId: f.purchases[0], action: "prepare" }],
      })) as typeof fetch);
    assert.equal(plan.rejectedProposals, 1);
    assert.ok(
      plan.actions.some(
        (a: any) =>
          a.orderId === f.purchases[0] && a.action === "check_payment",
      ),
    );
    assert.equal(plan.pickups.length, 0);
    assert.deepEqual(
      allowedOrderActions({ state: "paid", capture: null, refunded: 0 }),
      ["check_payment"],
    );
    assert.equal(
      nextOrderAction({
        state: "paid",
        capture: "CAP",
        fulfillment: "ready",
        refunded: 0,
        pickupWindow: {},
      }),
      "Review pickup instructions",
    );
  } finally {
    f.db.close();
  }
});
test("Operation planning refuses stale facts and foreign-shop scheduling tools", async () => {
  const f = await operationFixture();
  try {
    await assert.rejects(
      planOperations(f.db, f.id, { from: f.from }, (async () =>
        reply("findPickupSlots", {
          orderIds: ["other-shop-order"],
        })) as typeof fetch),
      /not from this shop/,
    );
    await assert.rejects(
      planOperations(f.db, f.id, { from: f.from }, (async () => {
        f.db
          .prepare("UPDATE rc_orders SET refunded=100 WHERE id=?")
          .run(f.purchases[0]);
        return reply("proposeOperations", { actions: [] });
      }) as typeof fetch),
      /changed during planning/,
    );
    assert.equal(
      proposePickupSlots(f.db, f.id, ["other-shop-order"], f.from).length,
      0,
    );
  } finally {
    f.db.close();
  }
});

test("Invalid tool arguments and injected final action fields exhaust a bounded run without writes", async () => {
  const db = openRC(":memory:"),
    shop = createIncident(db);
  try {
    let requests = 0;
    const budget = new AgentBudget(2, 4, 10);
    await assert.rejects(
      runAgent({
        db,
        id: shop.id,
        role: "operations",
        instruction: "Read only",
        context: {},
        budget,
        transport: (async () => {
          requests++;
          return reply("finish", { approved: true, publish: true });
        }) as typeof fetch,
        tools: [
          {
            name: "finish",
            description: "Proposal",
            schema: z.object({ approved: z.literal(false) }).strict(),
            final: true,
          },
        ],
      }),
      /budget/,
    );
    assert.equal(requests, 2);
    assert.equal(incident(db, shop.id).state, "draft");
  } finally {
    db.close();
  }
});
test("Pickup-specific plans include eligible slots even when the model selects preparation only", async () => {
  const f = await operationFixture();
  try {
    const plan = await planOperations(
      f.db,
      f.id,
      { from: f.from, goal: "pickups" },
      (async () =>
        reply("proposeOperations", {
          actions: f.purchases.map((orderId) => ({
            orderId,
            action: "prepare",
          })),
        })) as typeof fetch,
    );
    assert.equal(plan.pickups.length, 2);
    assert.ok(plan.pickups.every((p: any) => p.expected === null));
    assert.equal(
      f.db
        .prepare("SELECT count(*) n FROM rc_meta WHERE key GLOB 'pickup:*'")
        .get()?.n,
      0,
    );
  } finally {
    f.db.close();
  }
});

test("catalog provider failure records a bounded failed run without publishing", async () => {
  const { db, id } = await catalog();
  try {
    await assert.rejects(
      reconstructWithAgents(
        db,
        id,
        async () => new Response("unavailable", { status: 503 }),
      ),
      /503/,
    );
    const run = agentProgress(db, id)!;
    assert.equal(run.state, "needs_review");
    assert.equal(run.steps[0].status, "failed");
    assert.equal(run.calls, 1);
    assert.equal(incident(db, id).state, "draft");
  } finally {
    db.close();
  }
});

test("Operations chat forwards bounded conversation and returns the model reply without executing its proposal", async () => {
  const f = await operationFixture();
  try {
    const before = orderSnapshot(f.db);
    const result = await planOperations(
      f.db,
      f.id,
      {
        message: "Which order should I prepare first?",
        conversation: [{ role: "user", text: "I have one pickup counter." }],
      },
      async (_url, init) => {
        const body = JSON.parse(String(init?.body)),
          context = JSON.parse(body.contents[0].parts[0].text);
        assert.equal(
          context.sellerRequest,
          "Which order should I prepare first?",
        );
        assert.equal(context.conversation.length, 1);
        return reply("proposeOperations", {
          reply: "Prepare the first paid order, then arrange pickup.",
          actions: [{ orderId: f.purchases[0], action: "prepare" }],
        });
      },
    );
    assert.match(result.reply, /first paid order/);
    assert.equal(orderSnapshot(f.db), before);
    await assert.rejects(
      planOperations(f.db, f.id, { message: "x".repeat(601) }),
    );
    await assert.rejects(
      planOperations(f.db, f.id, {
        conversation: Array(7).fill({ role: "user", text: "x" }),
      }),
    );
  } finally {
    f.db.close();
  }
});

test("Approving a preparation recommendation opens its order and rejects forged or contradictory decisions", async () => {
  const f = await operationFixture();
  try {
    const plan = await planOperations(f.db, f.id, {}),
      before = orderSnapshot(f.db);
    const b = {
      runId: plan.agentRunId,
      orderId: f.purchases[0],
      action: "prepare",
      decision: "approve",
    };
    const result = decideOperation(f.db, f.id, "seller-fixture", b);
    assert.equal(result.effect, "open_order");
    assert.equal(result.actor, "seller-fixture");
    assert.equal(orderSnapshot(f.db), before);
    assert.equal(
      decideOperation(f.db, f.id, "seller-fixture", b).replayed,
      true,
    );
    assert.throws(
      () =>
        decideOperation(f.db, f.id, "seller-fixture", {
          ...b,
          decision: "reject",
        }),
      /already has a decision/,
    );
    assert.throws(
      () =>
        decideOperation(f.db, f.id, "seller-fixture", {
          ...b,
          action: "notify_pickup",
        }),
      /not proposed/,
    );
    assert.throws(
      () => decideOperation(f.db, createIncident(f.db).id, "seller-fixture", b),
      /not from this shop/,
    );
  } finally {
    f.db.close();
  }
});

test("Rejecting a pickup recommendation records the decision without saving an appointment", async () => {
  const f = await operationFixture();
  try {
    const plan = await planOperations(f.db, f.id, {
        goal: "pickups",
        from: f.from,
      }),
      before = orderSnapshot(f.db);
    const b = {
      runId: plan.agentRunId,
      orderId: f.purchases[0],
      action: "schedule_pickup",
      decision: "reject",
    };
    assert.equal(
      decideOperation(f.db, f.id, "seller-fixture", b).effect,
      "dismissed",
    );
    assert.equal(
      decideOperation(f.db, f.id, "seller-fixture", b).replayed,
      true,
    );
    assert.equal(orderSnapshot(f.db), before);
  } finally {
    f.db.close();
  }
});

test("Explicit pickup approval saves the exact server proposal and audit once", async () => {
  const f = await operationFixture();
  try {
    const plan = await planOperations(f.db, f.id, {
      goal: "pickups",
      from: f.from,
    });
    const before = JSON.stringify(
      f.db.prepare("SELECT * FROM rc_orders ORDER BY id").all(),
    );
    const b = {
      runId: plan.agentRunId,
      orderId: f.purchases[0],
      action: "schedule_pickup",
      decision: "approve",
    };
    const result = decideOperation(f.db, f.id, "seller-fixture", b),
      slot = plan.pickups.find((p: any) => p.orderId === f.purchases[0]);
    assert.equal(result.effect, "appointment_saved");
    assert.deepEqual(result.appointment, { start: slot.start, end: slot.end });
    assert.equal(
      decideOperation(f.db, f.id, "seller-fixture", b).replayed,
      true,
    );
    assert.equal(
      f.db
        .prepare("SELECT count(*) n FROM rc_meta WHERE key GLOB 'pickup:*'")
        .get()?.n,
      1,
    );
    assert.equal(
      f.db
        .prepare(
          "SELECT count(*) n FROM rc_meta WHERE key GLOB 'agent-decision:*'",
        )
        .get()?.n,
      1,
    );
    assert.equal(
      JSON.stringify(f.db.prepare("SELECT * FROM rc_orders ORDER BY id").all()),
      before,
    );
    assert.throws(
      () =>
        decideOperation(f.db, f.id, "seller-fixture", {
          ...b,
          orderId: f.purchases[1],
        }),
      /changed/,
    );
  } finally {
    f.db.close();
  }
});

test("Changed order state invalidates an outstanding approval", async () => {
  const f = await operationFixture();
  try {
    const plan = await planOperations(f.db, f.id, {});
    f.db
      .prepare("UPDATE rc_orders SET fulfillment='collected' WHERE id=?")
      .run(f.purchases[0]);
    assert.throws(
      () =>
        decideOperation(f.db, f.id, "seller-fixture", {
          runId: plan.agentRunId,
          orderId: f.purchases[0],
          action: "prepare",
          decision: "approve",
        }),
      /changed/,
    );
    assert.equal(
      f.db
        .prepare(
          "SELECT count(*) n FROM rc_meta WHERE key GLOB 'agent-decision:*'",
        )
        .get()?.n,
      0,
    );
  } finally {
    f.db.close();
  }
});

test("Appointment save rolls back if its linked decision audit cannot be recorded", async () => {
  const f = await operationFixture();
  try {
    const slot = proposePickupSlots(f.db, f.id, [f.purchases[0]], f.from)[0];
    assert.throws(
      () =>
        savePickupWindow(
          f.db,
          f.purchases[0],
          { start: slot.start, end: slot.end, expected: null },
          () => {
            throw Error("audit unavailable");
          },
        ),
      /audit unavailable/,
    );
    assert.equal(
      f.db
        .prepare("SELECT count(*) n FROM rc_meta WHERE key GLOB 'pickup:*'")
        .get()?.n,
      0,
    );
  } finally {
    f.db.close();
  }
});
