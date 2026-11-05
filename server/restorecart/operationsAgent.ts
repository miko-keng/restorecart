import { z } from "zod";
import { hash, fail } from "./domain";
import { incident, order, type DB } from "./store";
import {
  pickupWindow,
  pickupAvailability,
  suggestPickupWindow,
} from "./pickups";
import { config } from "./reconstruction";
import {
  newAgentBudget,
  recordAgentRun,
  runAgent,
  AGENT_VERSION,
} from "./agentRuntime";
import {
  allowedOrderActions,
  actionLabel,
  type OrderAction,
} from "../../src/restorecart/orderAdvice";
export function operationOrders(db: DB, id: string) {
  return (
    db
      .prepare(
        "SELECT id FROM rc_orders WHERE incident=? ORDER BY rowid DESC LIMIT 50",
      )
      .all(id) as any[]
  ).map((r) => {
    const o = order(db, r.id);
    return {
      ...o,
      pickupWindow: pickupWindow(db, o.id),
      refund:
        db.prepare("SELECT state FROM rc_refunds WHERE order_id=?").get(o.id) ||
        null,
    };
  });
}
function fingerprint(db: DB, id: string, orders = operationOrders(db, id)) {
  return hash(
    JSON.stringify({
      revision: incident(db, id).revision,
      orders: orders.map((o) => ({
        id: o.id,
        state: o.state,
        capture: o.capture,
        refunded: o.refunded,
        fulfillment: o.fulfillment,
        pickupWindow: o.pickupWindow,
        refund: o.refund,
      })),
      hours: pickupAvailability(db, id),
    }),
  );
}
export function proposePickupSlots(
  db: DB,
  id: string,
  orderIds: string[],
  from: string,
  minutes = 20,
) {
  const orders = operationOrders(db, id),
    virtual: { start: string; end: string }[] = [],
    proposals: any[] = [];
  for (const orderId of [...new Set(orderIds)].slice(0, 12)) {
    const o = orders.find((o) => o.id === orderId);
    if (!o || !o.capture || !allowedOrderActions(o).includes("schedule_pickup"))
      continue;
    let cursor = from;
    for (let attempt = 0; attempt < 20; attempt++) {
      let slot;
      try {
        slot = suggestPickupWindow(db, orderId, { from: cursor, minutes });
      } catch {
        break;
      }
      const overlap = virtual.find(
        (w) =>
          Date.parse(w.start) < Date.parse(slot.end) &&
          Date.parse(w.end) > Date.parse(slot.start),
      );
      if (overlap) {
        cursor = overlap.end;
        continue;
      }
      proposals.push({ orderId, ...slot });
      virtual.push(slot);
      break;
    }
  }
  return proposals;
}
const inputSchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    minutes: z.number().int().min(1).max(240).default(20),
    fresh: z.boolean().optional(),
    goal: z.enum(["orders", "pickups"]).default("orders"),
  })
  .strict();
const proposalSchema = z
  .object({
    actions: z
      .array(
        z
          .object({
            orderId: z.string().max(100),
            action: z.enum([
              "check_payment",
              "prepare",
              "schedule_pickup",
              "notify_pickup",
              "none",
            ]),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
const running = new Set<string>();
export async function planOperations(
  db: DB,
  id: string,
  input: unknown = {},
  transport: typeof fetch = fetch,
) {
  const b = inputSchema.parse(input);
  incident(db, id);
  if (running.has(id))
    fail("An operations plan is already running for this shop.", 409);
  const orders = operationOrders(db, id),
    initial = fingerprint(db, id, orders),
    budget = newAgentBudget(),
    from = b.from || new Date().toISOString();
  const live =
    process.env.NODE_ENV === "test"
      ? transport !== fetch
      : config().ai.mode === "live";
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const cacheKey = hash(
    JSON.stringify([
      AGENT_VERSION,
      "operations",
      id,
      initial,
      b.minutes,
      b.goal,
      from.slice(0, 16),
      model,
      live,
    ]),
  );
  const cached = db
    .prepare("SELECT body FROM rc_cache WHERE key=?")
    .get(cacheKey) as any;
  if (cached && !b.fresh) return { ...JSON.parse(cached.body), cached: true };
  const facts = orders.map((o) => ({
    orderId: o.id,
    state: o.state,
    captureRecorded: !!o.capture,
    refunded: o.refunded,
    fulfillment: o.fulfillment,
    pickupWindow: o.pickupWindow,
    refundState: o.refund?.state || null,
    allowedActions: allowedOrderActions(o),
    items: (o.snapshot.lines || []).map((l: any) => ({
      sku: l.sku,
      quantity: l.quantity,
    })),
  }));
  running.add(id);
  try {
    let proposals: any[],
      trace: any[] = [],
      source = "policy",
      agentModel: string | null = null;
    if (live && facts.length) {
      const result = await runAgent({
        db,
        id,
        role: "operations",
        budget,
        transport,
        instruction:
          "Prioritize the verified orders needing seller attention. Use inspectOrderFacts and inspectPickupAvailability when needed, and findPickupSlots for unscheduled eligible orders. Propose only actions explicitly allowed for each order. No free-text diagnosis, payments, fulfillment mutations, or appointment writes. Finish with proposeOperations. These are suggestions requiring seller confirmation.",
        context: {
          orders: facts,
          goal: b.goal,
          notBefore: from,
          durationMinutes: b.minutes,
          scope:
            "Selected shop only. Only existing server-permitted actions may be proposed.",
        },
        tools: [
          {
            name: "inspectOrderFacts",
            description:
              "Read verified payment/fulfillment facts for this shop.",
            schema: z.object({}).strict(),
            read: () => facts,
          },
          {
            name: "inspectPickupAvailability",
            description: "Read opening dates and existing saved appointments.",
            schema: z.object({}).strict(),
            read: () => ({
              availability: pickupAvailability(db, id),
              appointments: orders
                .filter((o) => o.pickupWindow)
                .map((o) => ({ orderId: o.id, ...o.pickupWindow })),
            }),
          },
          {
            name: "findPickupSlots",
            description:
              "Find non-overlapping proposed slots for eligible unscheduled orders. Does not save them.",
            schema: z
              .object({ orderIds: z.array(z.string().max(100)).max(12) })
              .strict(),
            read: ({ orderIds }) => {
              if (
                orderIds.some(
                  (key: string) => !orders.some((o) => o.id === key),
                )
              )
                fail("Order is not from this shop.", 403);
              return proposePickupSlots(db, id, orderIds, from, b.minutes);
            },
          },
          {
            name: "proposeOperations",
            description:
              "Propose a prioritized list of allowed actions; no action is executed.",
            schema: proposalSchema,
            final: true,
          },
        ],
      });
      proposals = result.value.actions;
      trace = result.trace;
      source = "gemini";
      agentModel = result.model;
    } else
      proposals = facts.map((o) => ({
        orderId: o.orderId,
        action: o.allowedActions[0],
      }));
    if (fingerprint(db, id) !== initial)
      fail(
        "Orders or pickup availability changed during planning. Refresh and request a new plan.",
        409,
      );
    const seen = new Set<string>();
    let rejected = 0;
    const actions = proposals.flatMap((p) => {
      const o = orders.find((o) => o.id === p.orderId),
        key = `${p.orderId}:${p.action}`;
      if (!o || !allowedOrderActions(o).includes(p.action) || seen.has(key)) {
        rejected++;
        return [];
      }
      seen.add(key);
      return [
        {
          orderId: o.id,
          action: p.action as OrderAction,
          label: actionLabel[p.action as OrderAction],
          requiresConfirmation: p.action !== "none",
          evidence: {
            state: o.state,
            captureRecorded: !!o.capture,
            refunded: o.refunded,
            fulfillment: o.fulfillment,
          },
        },
      ];
    });
    // Critical payment checks cannot disappear merely because a model omitted them.
    for (const o of orders.filter(
      (o) => allowedOrderActions(o)[0] === "check_payment",
    ))
      if (!actions.some((a) => a.orderId === o.id))
        actions.push({
          orderId: o.id,
          action: "check_payment",
          label: actionLabel.check_payment,
          requiresConfirmation: true,
          evidence: {
            state: o.state,
            captureRecorded: !!o.capture,
            refunded: o.refunded,
            fulfillment: o.fulfillment,
          },
        });
    if (b.goal === "pickups")
      for (const o of orders.filter((o) =>
        allowedOrderActions(o).includes("schedule_pickup"),
      )) {
        if (
          !actions.some(
            (a) => a.orderId === o.id && a.action === "schedule_pickup",
          )
        )
          actions.push({
            orderId: o.id,
            action: "schedule_pickup",
            label: actionLabel.schedule_pickup,
            requiresConfirmation: true,
            evidence: {
              state: o.state,
              captureRecorded: !!o.capture,
              refunded: o.refunded,
              fulfillment: o.fulfillment,
            },
          });
      }
    const pickups = proposePickupSlots(
      db,
      id,
      actions
        .filter((a) => a.action === "schedule_pickup")
        .map((a) => a.orderId),
      from,
      b.minutes,
    );
    const run = recordAgentRun(db, id, {
      kind: "operations",
      fingerprint: initial,
      state: "awaiting_seller_confirmation",
      steps: [
        {
          role: "operations",
          source,
          model: agentModel,
          trace,
          status: "proposed",
        },
      ],
      calls: budget.calls,
      tools: budget.tools,
      rejectedProposals: rejected,
    });
    const result = {
      source,
      model: agentModel,
      actions,
      pickups,
      rejectedProposals: rejected,
      agentRunId: run.id,
      fingerprint: initial,
      generatedAt: new Date().toISOString(),
      scope:
        "Suggestions only; no orders, payments or appointments were changed.",
      cached: false,
    };
    db.prepare("INSERT OR REPLACE INTO rc_cache VALUES(?,?)").run(
      cacheKey,
      JSON.stringify(result),
    );
    return result;
  } catch (error) {
    recordAgentRun(db, id, {
      kind: "operations",
      fingerprint: initial,
      state: "needs_review",
      steps: [],
      calls: budget.calls,
      tools: budget.tools,
      error:
        "Operations planning stopped without modifying orders or appointments.",
    });
    throw error;
  } finally {
    running.delete(id);
  }
}
