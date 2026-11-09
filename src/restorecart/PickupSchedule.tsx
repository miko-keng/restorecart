import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { OrderViewBoundary } from "./OrderViewBoundary";
import { pickupTimeLabel } from "./OrderProgress";
import { canSchedulePickup } from "./orderAdvice";

const BryntumPickups = lazy(() => import("./BryntumPickups"));
type PickupWindow = { start: string; end: string };
export type PickupRequest = {
  id: string;
  proposal?: PickupWindow & { expected: PickupWindow | null };
};
type PickupEditor = {
  id: string;
  start: string;
  end: string;
  expected: PickupWindow | null;
  preview?: PickupWindow;
};

function localInput(iso: string) {
  const date = new Date(iso);
  return new Date(+date - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function createEditor(
  request: PickupRequest,
  current: PickupWindow | null,
): PickupEditor {
  const time = request.proposal ?? current;
  return {
    id: request.id,
    start: time ? localInput(time.start) : "",
    end: time ? localInput(time.end) : "",
    expected: request.proposal ? request.proposal.expected : current,
    preview: request.proposal,
  };
}

export default function PickupSchedule({
  orders,
  shopId,
  api,
  onSelect,
  onSaved,
  request,
}: {
  orders: any[];
  shopId?: string;
  api?: any;
  onSelect?: (id: string) => void;
  onSaved?: () => Promise<void>;
  request?: PickupRequest | null;
}) {
  const [availability, setAvailability] = useState<any>(null);
  const [editor, setEditor] = useState<PickupEditor | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const editorRegion = useRef<HTMLElement>(null);
  const sample = orders.some((o) => o.sample);
  const editable = !!api && !!shopId && !sample;
  const appointments = orders.filter(
    (o) => o.state === "paid" && !o.refunded && o.pickupWindow,
  );
  const eligible = editable ? orders.filter(canSchedulePickup) : [];
  const currentOrder = eligible.find((order) => order.id === editor?.id);
  const requestedOrder = eligible.find((order) => order.id === request?.id);
  const requestedWindow = requestedOrder?.pickupWindow ?? null;
  const timezone =
    availability?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const enabled =
    import.meta.env.VITE_ENABLE_BRYNTUM === "true" ||
    (import.meta.env.DEV && import.meta.env.VITE_ENABLE_BRYNTUM !== "false");

  useEffect(() => {
    if (!editable) return;
    let alive = true;
    api(`/incidents/${shopId}/pickup-availability`)
      .then((value: any) => {
        if (alive) setAvailability(value);
      })
      .catch((error: Error) => {
        if (alive) setError(error.message);
      });
    return () => {
      alive = false;
    };
  }, [shopId, editable, api]);
  useEffect(() => {
    if (request && requestedOrder)
      setEditor(createEditor(request, requestedWindow));
    // A refresh must preserve the draft and its original expected appointment.
  }, [request, requestedOrder?.id]);
  useEffect(() => {
    if (editor?.id) {
      editorRegion.current?.scrollIntoView({ block: "nearest" });
      editorRegion.current?.focus({ preventScroll: true });
    }
  }, [editor?.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The schedule could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setAvailability(await api(`/incidents/${shopId}/pickup-availability`));
  }
  function selectOrder(id: string, time?: PickupWindow) {
    const order = eligible.find((order) => order.id === id);
    if (!order || busy) return;
    const current = order.pickupWindow ?? null;
    setError("");
    setNotice("");
    setEditor(
      createEditor(
        { id, proposal: time ? { ...time, expected: current } : undefined },
        current,
      ),
    );
  }

  const appointmentList = (
    <ul className="rc-pickup-appointment-list">
      {appointments.map((order) => (
        <li
          key={order.id}
          className={order.id === editor?.id ? "active" : undefined}
        >
          <button
            type="button"
            className="rc-link"
            disabled={busy}
            onClick={() =>
              editable && canSchedulePickup(order)
                ? selectOrder(order.id)
                : onSelect?.(order.id)
            }
          >
            Order {order.id.slice(-8)}
          </button>
          <span>{pickupTimeLabel(order.pickupWindow)}</span>
          {order.pickupNeedsReschedule && <small>Buyer unavailable</small>}
        </li>
      ))}
    </ul>
  );
  return (
    <section className="rc-pickup-workspace" aria-label="Pickup appointments">
      <div className="rc-pickup-workspace-heading">
        <h3>Pickup schedule</h3>
        {eligible.length > 0 && (
          <label>
            <span className="rc-sr">Choose an order to schedule</span>
            <select
              aria-label="Choose an order to schedule"
              value={currentOrder?.id || ""}
              disabled={busy}
              onChange={(event) => selectOrder(event.target.value)}
            >
              <option value="" disabled>
                Choose an order
              </option>
              {eligible.map((order) => (
                <option key={order.id} value={order.id}>
                  Order {order.id.slice(-8)}
                  {order.pickupNeedsReschedule ? " · Needs new time" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {editor && currentOrder && (
        <section
          className="rc-pickup-editor"
          aria-label="Pickup editor"
          tabIndex={-1}
          ref={editorRegion}
        >
          <h4>
            {currentOrder.pickupWindow
              ? "Reschedule pickup"
              : "Schedule pickup"}{" "}
            · {editor.id.slice(-8)}
          </h4>
          {currentOrder.pickupWindow && (
            <p>Current pickup · {pickupTimeLabel(currentOrder.pickupWindow)}</p>
          )}
          {currentOrder.pickupNeedsReschedule && (
            <p className="rc-pickup-conflict-note">
              Buyer unavailable at the current time
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const start = new Date(editor.start),
                  end = new Date(editor.end);
                if (
                  !Number.isFinite(+start) ||
                  !Number.isFinite(+end) ||
                  start >= end
                )
                  throw Error("Choose an end time after the start.");
                await api(`/orders/${editor.id}/pickup-window`, {
                  start: start.toISOString(),
                  end: end.toISOString(),
                  expected: editor.expected,
                });
                setEditor(null);
                await onSaved?.();
                setNotice("Pickup saved.");
              });
            }}
          >
            <div className="rc-pickup-editor-fields">
              <label>
                Starts{" "}
                <input
                  type="datetime-local"
                  required
                  value={editor.start}
                  disabled={busy}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      start: event.target.value,
                      preview: undefined,
                    })
                  }
                />
              </label>
              <label>
                Ends{" "}
                <input
                  type="datetime-local"
                  required
                  value={editor.end}
                  disabled={busy}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      end: event.target.value,
                      preview: undefined,
                    })
                  }
                />
              </label>
            </div>
            <div className="rc-buttonrow">
              <button
                type="submit"
                className="rc-button"
                disabled={busy || !editor.start || !editor.end}
              >
                Confirm pickup
              </button>
              <button
                type="button"
                className="rc-button secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const duration = editor.expected
                      ? Math.round(
                          (Date.parse(editor.expected.end) -
                            Date.parse(editor.expected.start)) /
                            60000,
                        )
                      : 20;
                    const slot = await api(
                      `/orders/${editor.id}/pickup-suggestion`,
                      { from: new Date().toISOString(), minutes: duration },
                    );
                    setEditor(
                      createEditor(
                        { id: editor.id, proposal: slot },
                        editor.expected,
                      ),
                    );
                  })
                }
              >
                Find next available time
              </button>
              <button
                type="button"
                className="rc-link"
                disabled={busy}
                onClick={() => {
                  setEditor(null);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      {error && (
        <p className="rc-warning" role="alert">
          {error}
        </p>
      )}
      {appointments.length ? (
        <>
          {enabled ? (
            <OrderViewBoundary fallback={appointmentList}>
              {editable && (
                <p className="rc-pickup-drag-hint">
                  Drag an appointment block to propose a time. The blue block is
                  your draft.
                </p>
              )}
              <Suspense fallback={<p>Loading pickup timeline…</p>}>
                <BryntumPickups
                  orders={appointments}
                  height={150}
                  openingWindows={availability?.days || []}
                  proposals={
                    editor?.preview
                      ? [
                          {
                            orderId: editor.id,
                            start: editor.preview.start,
                            end: editor.preview.end,
                          },
                        ]
                      : []
                  }
                  onSelect={(id) =>
                    eligible.some((order) => order.id === id)
                      ? selectOrder(id)
                      : onSelect?.(id)
                  }
                  onPropose={
                    editable
                      ? (id, start, end) => selectOrder(id, { start, end })
                      : undefined
                  }
                />
              </Suspense>
              <details className="rc-pickup-list-disclosure">
                <summary>Appointment list</summary>
                {appointmentList}
              </details>
            </OrderViewBoundary>
          ) : (
            appointmentList
          )}
        </>
      ) : (
        <p>No pickups scheduled.</p>
      )}
      {editable && (
        <details>
          <summary>Pickup opening dates</summary>
          <p>Time zone · {timezone}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                const start = new Date(String(f.get("start"))),
                  end = new Date(String(f.get("end")));
                await api(`/incidents/${shopId}/pickup-availability`, {
                  day: new Intl.DateTimeFormat("en-CA", {
                    timeZone: timezone,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(start),
                  timezone: timezone,
                  start: start.toISOString(),
                  end: end.toISOString(),
                });
                await refresh();
                setNotice("Pickup opening date saved.");
              });
            }}
          >
            <label>
              Opening time
              <input name="start" type="datetime-local" required />
            </label>
            <label>
              Closing time
              <input name="end" type="datetime-local" required />
            </label>
            <button className="rc-button secondary" disabled={busy}>
              Save opening date
            </button>
          </form>
          <ul>
            {availability?.days.map((d: any) => (
              <li key={d.day}>
                {d.day}: {new Date(d.start).toLocaleString()} –{" "}
                {new Date(d.end).toLocaleTimeString()}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
