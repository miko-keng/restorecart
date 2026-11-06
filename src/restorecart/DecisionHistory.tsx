import { useEffect, useState } from "react";
export function DecisionHistory({
  shopId,
  sku,
  revision,
  api,
  product,
  sources = [],
  published,
  changedSources = [],
}: any) {
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
      <summary>Evidence & history</summary>
      {product && (
        <>
          <h4>Source evidence</h4>
          {new Set(
            product.candidates
              ?.filter((c: any) => c.field === "price")
              .map((c: any) => c.value),
          ).size > 1 && (
            <p>
              Source prices conflict. The seller must choose the current price
              and explain why.
            </p>
          )}
          {!product.candidates?.length && (
            <p>
              No source claims recorded. These details require seller
              confirmation.
            </p>
          )}
          <ul>
            {product.candidates
              ?.filter((c: any) => c.field === "price")
              .map((c: any, index: number) => (
                <li key={index}>
                  <b>
                    {c.field}: {c.value}
                  </b>{" "}
                  ·{" "}
                  {sources.find((s: any) => s.id === c.sourceId)?.name ||
                    "Source unavailable"}{" "}
                  · {c.location}
                  <blockquote>{c.excerpt}</blockquote>
                </li>
              ))}
          </ul>
          <details>
            <summary>Other source claims</summary>
            <ul>
              {product.candidates
                ?.filter((c: any) => c.field !== "price")
                .map((c: any, index: number) => (
                  <li key={index}>
                    {c.field}: {c.value} ·{" "}
                    {sources.find((s: any) => s.id === c.sourceId)?.name ||
                      "Source unavailable"}
                    <blockquote>{c.excerpt}</blockquote>
                  </li>
                ))}
            </ul>
          </details>
          {!!changedSources.length && (
            <p role="alert">
              Evidence changed or is missing: {changedSources.join(", ")}.
              Recheck the product before publishing.
            </p>
          )}
          <h4>Your decision</h4>
          <p>
            {product.resolved
              ? "Seller confirmed"
              : "Awaiting seller confirmation"}{" "}
            ·{" "}
            {product.price
              ? `${product.currency} ${product.price}`
              : "Price unresolved"}
          </p>
          <p>{product.resolutionNote || "No source explanation saved."}</p>
          <h4>Published details</h4>
          <p>
            {published
              ? `${published.name} · ${published.currency} ${published.price}`
              : "This product is not in the published shop."}
          </p>
          {published &&
            (published.price !== product.price ||
              published.name !== product.name ||
              !product.resolved) && (
              <p>
                Saved draft differs or needs review. Customers still see the
                published version above.
              </p>
            )}
        </>
      )}
      <h4>History</h4>
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
                  <summary>Changes and original supporting evidence</summary>
                  {r.approvedProduct && (
                    <p>
                      Saved result: {r.approvedProduct.name} ·{" "}
                      {r.approvedProduct.currency} {r.approvedProduct.price}.{" "}
                      {r.approvedProduct.resolutionNote}
                    </p>
                  )}
                  {r.evidence ? (
                    <ul>
                      {r.evidence.map((c: any, index: number) => (
                        <li key={index}>
                          {c.field}: {c.value} ·{" "}
                          {r.sources.find(
                            (source: any) => source.id === c.sourceId,
                          )?.name || "Source unavailable"}{" "}
                          · {c.location}
                          <blockquote>{c.excerpt}</blockquote>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>This older decision has no saved claim snapshot.</p>
                  )}
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
