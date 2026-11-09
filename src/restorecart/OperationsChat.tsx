import type { PickupRequest } from "./PickupSchedule";
import { useEffect, useId, useRef, useState } from "react";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { allowedOrderActions } from "./orderAdvice";
type Props = {
  shopId: string;
  orders: any[];
  api: (path: string, body?: any) => Promise<any>;
  onPlan: (plan: any) => void;
  onOpenOrder: (id: string) => void;
  onReviewPickup: (id: string, proposal?: PickupRequest["proposal"]) => void;
};
type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  plan?: any;
};
export function OperationsChat({
  shopId,
  orders,
  api,
  onPlan,
  onOpenOrder,
  onReviewPickup,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId(),
    feed = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [input, setInput] = useState(""),
    [messages, setMessages] = useState<Message[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [current, setCurrent] = useState(""),
    [decisions, setDecisions] = useState<Record<string, any>>({});
  const serial = useRef(0);
  const version = JSON.stringify([
    shopId,
    orders.map((o) => [
      o.id,
      o.state,
      o.capture,
      o.refunded,
      o.fulfillment,
      o.pickupWindow,
      o.pickupNeedsReschedule,
      o.refund,
    ]),
  ]);
  const versionRef = useRef(version);
  versionRef.current = version;
  useEffect(() => {
    setCurrent("");
    onPlan(null);
  }, [version, onPlan]);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight });
  }, [messages, decisions, busy]);
  async function ask(
    text: string,
    goal = /\brecover(?:y|ing)?\b/i.test(text) ? "recovery" : "orders",
  ) {
    if (busy || !text.trim()) return;
    const requestVersion = versionRef.current;
    setError("");
    setBusy(true);
    setInput("");
    const conversation = messages
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 800) }));
    setMessages((m) => [
      ...m.slice(-11),
      { id: ++serial.current, role: "user", text },
    ]);
    try {
      const plan =
        goal === "recovery"
          ? await api(`/incidents/${shopId}/agent-recovery`, { message: text })
          : await api(`/incidents/${shopId}/agent-operations`, {
              message: text,
              conversation,
              goal,
            });
      if (versionRef.current !== requestVersion)
        throw Error(
          "Orders changed while Gemini was planning. Ask again for current suggestions.",
        );
      setMessages((m) => [
        ...m,
        {
          id: ++serial.current,
          role: "assistant",
          text: plan.reply || "Review these recommendations.",
          plan,
        },
      ]);
      if (goal !== "recovery") {
        setCurrent(plan.agentRunId);
        onPlan(plan);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Gemini could not respond. Your orders are unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function decide(plan: any, a: any, decision: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const result = await api(
        `/incidents/${shopId}/agent-operations/decision`,
        {
          runId: plan.agentRunId,
          orderId: a.orderId,
          action: a.action,
          decision,
        },
      );
      setDecisions((d) => ({
        ...d,
        [`${plan.agentRunId}:${a.orderId}:${a.action}`]: result,
      }));
      if (result.effect === "open_order") {
        setOpen(false);
        onOpenOrder(a.orderId);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Decision could not be saved. Refresh before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="rc-button secondary"
        onClick={() => setOpen(true)}
      >
        <MessageCircle size={17} /> Assistant
      </button>
      <dialog
        ref={dialog}
        className="rc-operations-chat"
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
      >
        <header>
          <div>
            <h3 id={titleId}>
              <Sparkles size={18} /> Gemini order assistant
            </h3>
            <p>Plan your next step. You approve the actions.</p>
          </div>
          <button
            type="button"
            className="rc-icon"
            aria-label="Close Gemini chat"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </header>
        <div
          className="rc-chat-feed"
          ref={feed}
          role="log"
          aria-label="Conversation with Gemini"
          aria-live="polite"
        >
          {!messages.length && (
            <div className="rc-chat-message assistant">
              <strong>How can I help?</strong>
              <p>
                Ask about this shop’s orders or pickup times. I can suggest
                steps, but I cannot pack orders or authorize payments.
              </p>
              {!orders.length && (
                <p>
                  This shop has no orders yet. Complete a sandbox purchase using
                  this shop’s published link first.
                </p>
              )}
            </div>
          )}
          {messages.map((m) => (
            <div className={`rc-chat-message ${m.role}`} key={m.id}>
              <small>
                {m.role === "user"
                  ? "You"
                  : m.plan?.recoveryBlockers
                    ? m.plan.source === "gemini"
                      ? "Verified recovery checks · Gemini prioritized"
                      : "Verified recovery checks"
                    : m.plan?.source === "gemini"
                      ? "Gemini"
                      : "Verified order rules"}
                {m.plan?.cached ? " · saved plan" : ""}
              </small>
              <p>{m.text}</p>
              {m.plan?.recoveryBlockers?.map(
                (blocker: {
                  orderId: string;
                  kind: string;
                  guidance: string;
                }) => (
                  <article
                    className="rc-chat-suggestion"
                    key={`${blocker.orderId}:${blocker.kind}`}
                  >
                    <strong>Order #{blocker.orderId.slice(-8)}</strong>
                    <p>{blocker.guidance}</p>
                    {orders.some((order) => order.id === blocker.orderId) && (
                      <button
                        type="button"
                        className="rc-button secondary"
                        onClick={() => {
                          setOpen(false);
                          onOpenOrder(blocker.orderId);
                        }}
                      >
                        Open order
                      </button>
                    )}
                  </article>
                ),
              )}
              {m.plan?.recoveryBlockerCount >
                m.plan?.recoveryBlockers?.length && (
                <small>
                  Showing the first {m.plan.recoveryBlockers.length} of{" "}
                  {m.plan.recoveryBlockerCount} PayPal checks.
                </small>
              )}
              {m.plan?.actions?.map((a: any) => {
                const key = `${m.plan.agentRunId}:${a.orderId}:${a.action}`,
                  done = decisions[key],
                  o = orders.find((o) => o.id === a.orderId),
                  slot =
                    a.action === "schedule_pickup"
                      ? m.plan.pickups?.find(
                          (p: any) => p.orderId === a.orderId,
                        )
                      : null;
                const stale =
                  current !== m.plan.agentRunId ||
                  !o ||
                  !allowedOrderActions(o).includes(a.action);
                return (
                  <article className="rc-chat-suggestion" key={key}>
                    <strong>{a.label}</strong>
                    <span>
                      Order #{a.orderId.slice(-8)} ·{" "}
                      {o?.snapshot?.lines
                        ?.map((l: any) => `${l.quantity} × ${l.name}`)
                        .join(", ") || "Order details"}
                    </span>
                    <small>
                      Payment: {a.evidence.state.replaceAll("_", " ")}
                      {a.evidence.captureRecorded
                        ? " · capture recorded"
                        : ""}{" "}
                      · Fulfillment:{" "}
                      {a.evidence.fulfillment.replaceAll("_", " ")}
                    </small>
                    {slot && (
                      <p>
                        Proposed pickup: {new Date(slot.start).toLocaleString()}{" "}
                        – {new Date(slot.end).toLocaleTimeString()}
                      </p>
                    )}
                    {a.action === "none" ? (
                      <small>No approval needed.</small>
                    ) : done ? (
                      <p role="status">
                        {done.decision === "reject"
                          ? "Rejected — no order changes."
                          : done.effect === "appointment_saved"
                            ? "Approved — pickup appointment saved."
                            : "Approved — complete this task in the order details."}
                      </p>
                    ) : stale ? (
                      <small>
                        Earlier plan. Ask again before taking action.
                      </small>
                    ) : (
                      <>
                        <div className="rc-chat-decisions">
                          {a.action === "schedule_pickup" ? (
                            <button
                              type="button"
                              className="rc-button"
                              disabled={busy}
                              onClick={() => {
                                setOpen(false);
                                onReviewPickup(a.orderId, slot ?? undefined);
                              }}
                            >
                              Review in schedule
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="rc-button"
                              disabled={busy}
                              onClick={() => void decide(m.plan, a, "approve")}
                            >
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            className="rc-button secondary"
                            disabled={busy}
                            onClick={() => void decide(m.plan, a, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          ))}
          {busy && <p role="status">Working…</p>}
        </div>
        {error && (
          <p className="rc-chat-error" role="alert">
            {error}
          </p>
        )}
        <div className="rc-chat-prompts">
          <button
            type="button"
            disabled={busy || !orders.length}
            onClick={() => void ask("Which orders need my attention?")}
          >
            Review orders
          </button>
          <button
            type="button"
            disabled={busy || !orders.length}
            onClick={() =>
              void ask(
                "Suggest pickup times for my unscheduled orders.",
                "pickups",
              )
            }
          >
            Plan pickups
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void ask("What’s blocking my shop recovery?", "recovery")
            }
          >
            Check recovery
          </button>
        </div>
        <form
          className="rc-chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input.trim());
          }}
        >
          <label className="rc-chat-label" htmlFor={`${titleId}-input`}>
            Message Gemini about your orders
          </label>
          <div>
            <input
              id={`${titleId}-input`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={600}
              placeholder="Which order should I prepare next?"
              autoComplete="off"
              disabled={busy}
            />
            <button
              type="submit"
              className="rc-button"
              disabled={busy || !input.trim() || !orders.length}
            >
              <Send size={16} /> Send
            </button>
          </div>
          <small>
            Gemini uses this shop’s order facts. Approval decisions are saved;
            no automatic charges or refunds.
          </small>
        </form>
      </dialog>
    </>
  );
}
