import { lazy, Suspense, useEffect, useState } from "react";
const BryntumPickups = lazy(() => import("./BryntumPickups"));
const localInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function PickupSchedule({
  orders,
  shopId,
  api,
  onSelect,
  onSaved,
}: {
  orders: any[];
  shopId?: string;
  api?: any;
  onSelect?: (id: string) => void;
  onSaved?: () => Promise<void>;
}) {
  const [availability, setAvailability] = useState<any>(null),
    [pending, setPending] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const sample = orders.some((o) => o.sample);
  const editable = !!api && !!shopId && !sample;
  const refresh = () =>
    api(`/incidents/${shopId}/pickup-availability`).then(setAvailability);
  useEffect(() => {
    setAvailability(null);
    setPending(null);
    setError("");
    setNotice("");
    let alive = true;
    if (editable)
      api(`/incidents/${shopId}/pickup-availability`)
        .then((v: any) => {
          if (alive) setAvailability(v);
        })
        .catch((e: Error) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [shopId, editable]);
  const appointments = orders.filter(
    (o) => o.state === "paid" && !o.refunded && o.pickupWindow,
  );
  const eligible = orders.filter(
    (o) =>
      o.state === "paid" &&
      !o.refunded &&
      o.fulfillment !== "collected" &&
      o.refund?.state !== "checking",
  );
  const enabled =
    import.meta.env.VITE_ENABLE_BRYNTUM === "true" ||
    (import.meta.env.DEV && import.meta.env.VITE_ENABLE_BRYNTUM !== "false");
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  const propose = (id: string, start: string, end: string) => {
    const o = eligible.find((o) => o.id === id);
    if (!o || busy) return;
    setError("");
    setPending({ id, start, end, expected: o.pickupWindow || null });
  };
  return (
    <section aria-label="Pickup appointments">
      <h3>Pickup counter schedule</h3>
      <p>
        {sample
          ? "Read-only sample appointments. No actual bookings are changed."
          : "Click an appointment to open its order. Drag to propose a new time, then confirm. Buyers see only saved appointments."}
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {editable && (
        <>
          <details>
            <summary>Pickup opening dates</summary>
            <p>
              Set a daytime opening window for each date. Time zone:{" "}
              {availability?.timezone ||
                Intl.DateTimeFormat().resolvedOptions().timeZone}
              . Existing appointments must remain inside their opening window.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  const start = new Date(String(f.get("start"))),
                    end = new Date(String(f.get("end")));
                  await api(`/incidents/${shopId}/pickup-availability`, {
                    day: new Intl.DateTimeFormat("en-CA", {
                      timeZone:
                        availability?.timezone ||
                        Intl.DateTimeFormat().resolvedOptions().timeZone,
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(start),
                    timezone:
                      availability?.timezone ||
                      Intl.DateTimeFormat().resolvedOptions().timeZone,
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
          {!!eligible.length && (
            <details>
              <summary>Find next available pickup</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(async () => {
                    const id = String(f.get("order"));
                    setPending({
                      id,
                      ...(await api(`/orders/${id}/pickup-suggestion`, {
                        from: new Date(String(f.get("from"))).toISOString(),
                        minutes: Number(f.get("minutes")),
                      })),
                    });
                  });
                }}
              >
                <label>
                  Pickup order
                  <select name="order" aria-label="Pickup order">
                    {eligible.map((o) => (
                      <option key={o.id} value={o.id}>
                        Order {o.id.slice(-8)}
                        {o.pickupWindow ? " — reschedule" : " — unscheduled"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Not before
                  <input
                    name="from"
                    type="datetime-local"
                    defaultValue={localInput(new Date().toISOString())}
                    required
                  />
                </label>
                <label>
                  Pickup duration (minutes)
                  <input
                    name="minutes"
                    type="number"
                    min="1"
                    max="240"
                    defaultValue="20"
                    required
                  />
                </label>
                <button className="rc-button secondary" disabled={busy}>
                  Find available slot
                </button>
              </form>
            </details>
          )}
          {pending && (
            <div
              className="rc-notice"
              role="region"
              aria-label="Confirm pickup change"
            >
              <h4>Confirm pickup time</h4>
              <p>
                Order {pending.id.slice(-8)}:{" "}
                {new Date(pending.start).toLocaleString()} –{" "}
                {new Date(pending.end).toLocaleTimeString()}
              </p>
              <p>
                The buyer's appointment changes only after a successful save.
              </p>
              <div className="rc-buttonrow">
                <button
                  className="rc-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(`/orders/${pending.id}/pickup-window`, {
                        start: pending.start,
                        end: pending.end,
                        expected: pending.expected,
                      });
                      setPending(null);
                      await onSaved?.();
                      setNotice(
                        "Pickup appointment saved. The buyer receipt will show the new time.",
                      );
                    })
                  }
                >
                  Confirm appointment
                </button>
                <button
                  className="rc-button secondary"
                  disabled={busy}
                  onClick={() => setPending(null)}
                >
                  Cancel change
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {!appointments.length ? (
        <p>No pickup appointments saved yet.</p>
      ) : (
        <>
          {enabled && (
            <Suspense fallback={<p>Loading pickup timeline…</p>}>
              <BryntumPickups
                orders={appointments}
                onSelect={onSelect}
                onPropose={editable ? propose : undefined}
              />
            </Suspense>
          )}
          <ul>
            {appointments.map((o) => (
              <li key={o.id}>
                <button className="rc-link" onClick={() => onSelect?.(o.id)}>
                  Order {o.id.slice(-8)}
                </button>{" "}
                · {new Date(o.pickupWindow.start).toLocaleString()} –{" "}
                {new Date(o.pickupWindow.end).toLocaleTimeString()}
                {editable && eligible.some((e) => e.id === o.id) && (
                  <form
                    key={`${o.id}:${o.pickupWindow.start}:${o.pickupWindow.end}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      propose(
                        o.id,
                        new Date(String(f.get("start"))).toISOString(),
                        new Date(String(f.get("end"))).toISOString(),
                      );
                    }}
                  >
                    <label>
                      New pickup start
                      <input
                        type="datetime-local"
                        name="start"
                        defaultValue={localInput(o.pickupWindow.start)}
                        required
                      />
                    </label>
                    <label>
                      New pickup end
                      <input
                        type="datetime-local"
                        name="end"
                        defaultValue={localInput(o.pickupWindow.end)}
                        required
                      />
                    </label>
                    <button className="rc-button secondary" disabled={busy}>
                      Review new time
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
