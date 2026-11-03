import { useEffect, useState } from "react";
export function DecisionHistory({ shopId, sku, revision, api }: any) {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<any[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let live = true;
    setRows(null);
    setError("");
    api(`/incidents/${shopId}/decision-history?sku=${encodeURIComponent(sku)}`)
      .then((v: any) => {
        if (live) setRows(v);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [open, shopId, sku, revision]);
  return (
    <details
      className="rc-decision-history"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Seller decision history</summary>
      {error && <p role="alert">{error}</p>}
      {!rows && !error && <p>Loading history…</p>}
      {rows?.length === 0 && (
        <p>
          No saved decisions yet. Decisions appear after you save this product.
        </p>
      )}
      {!!rows?.length && (
        <>
          <p>
            Latest {rows.length} saved decisions. Stock counts are
            seller-confirmed.
          </p>
          <ol>
            {rows.map((r) => (
              <li key={r.id}>
                <b>{r.action === "ready" ? "Marked ready" : "Draft saved"}</b> ·{" "}
                {new Date(r.at).toLocaleString()} · {r.actor}
                {r.decisions.map((d: any, i: number) => (
                  <p key={i}>
                    Gemini {d.field}: {d.choice} · Proposed: {d.proposed} ·
                    Saved: {d.finalValue || "Not set"}
                  </p>
                ))}
                <details>
                  <summary>Changes and supporting sources</summary>
                  <ul>
                    {r.changes.map((c: any, i: number) => (
                      <li key={i}>
                        {c.field}: {String(c.before ?? "Not set")} →{" "}
                        {String(c.after ?? "Not set")}
                      </li>
                    ))}
                  </ul>
                  <ul>
                    {r.sources.map((s: any) => (
                      <li key={s.id}>
                        {s.name} · Source fingerprint: {s.hash.slice(0, 12)}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}
    </details>
  );
}
