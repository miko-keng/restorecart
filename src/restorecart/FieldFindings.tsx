import { findingField } from "./productReview";
export function FieldFindings({
  field,
  product,
  review,
  fields,
  sources,
  change,
  onDecision,
}: any) {
  const questions = (review?.questions || []).filter(
    (q: any) => q.sku === product.sku && findingField(q.text) === field,
  );
  const suggestions = (review?.suggestions || []).filter(
    (s: any) =>
      s.sku === product.sku &&
      s.field === field &&
      String(fields[field] ?? "") !== String(s.value ?? ""),
  );
  if (!questions.length && !suggestions.length) return null;
  return (
    <aside
      className="rc-field-findings"
      data-tone={
        questions.some((q: any) => !q.sellerConfirmed)
          ? "conflict"
          : questions.length
            ? "resolved"
            : "suggestion"
      }
      aria-label={`Gemini findings for ${field === "imageSourceId" ? "photo" : field}`}
    >
      {questions.map((q: any, i: number) =>
        q.sellerConfirmed ? (
          <details key={`q:${i}`} className="rc-resolved-finding">
            <summary>Resolved · {q.sellerResponse}</summary>
            <strong>Original Gemini finding</strong>
            <p>{q.text}</p>
          </details>
        ) : (
          <div key={`q:${i}`}>
            <strong>
              {field === "price"
                ? "Choose the current price"
                : "Review this detail"}
            </strong>
            {(field !== "price" ||
              !(product.candidates || []).some(
                (c: any) => c.field === "price",
              )) && <p>{q.text}</p>}
            {field === "price" && (
              <ul>
                {(product.candidates || [])
                  .filter((c: any) => c.field === "price")
                  .map((c: any, n: number) => (
                    <li key={n}>
                      {c.value} {product.currency || "USD"} ·{" "}
                      {sources.find((x: any) => x.id === c.sourceId)?.name ||
                        "Source record"}
                    </li>
                  ))}
              </ul>
            )}
            <small>
              Choose the correct details, confirm the product and save below.
            </small>
          </div>
        ),
      )}
      {suggestions.map((s: any, i: number) => {
        const source = sources.find((x: any) => x.id === s.sourceId);
        const proposed =
          field === "imageSourceId"
            ? sources.find((x: any) => x.id === s.value)?.name ||
              "Suggested variant photo"
            : s.value;
        const choice = (fields.reviewDecisions || []).find(
          (d: any) =>
            d.field === s.field &&
            d.value === s.value &&
            d.sourceId === s.sourceId &&
            d.fingerprint === review.inputFingerprint,
        );
        if (choice?.choice === "rejected")
          return (
            <p key={`s:${i}`}>
              Kept current {field === "imageSourceId" ? "photo" : field}. Save
              this product to record your decision.
            </p>
          );
        return (
          <div key={`s:${i}`}>
            <strong>✦ Suggested change</strong>
            <p>
              <b>Current:</b>{" "}
              {field === "imageSourceId"
                ? sources.find((x: any) => x.id === fields[field])?.name ||
                  "No photo selected"
                : fields[field] || "Not entered"}
            </p>
            <p>
              <b>Proposed:</b> {proposed}
            </p>
            <small>
              {review.stale || s.applicable === false
                ? "Earlier suggestion — review before using"
                : s.reason}
            </small>
            {
              <button
                type="button"
                className="rc-link"
                disabled={review.stale || s.applicable === false}
                onClick={() => {
                  change(field, s.value);
                  onDecision?.(s, "accepted");
                }}
              >
                Use suggestion
              </button>
            }
            {onDecision && (
              <button
                type="button"
                className="rc-link"
                onClick={() => onDecision(s, "rejected")}
              >
                Keep current value
              </button>
            )}
            <small>Decisions are recorded when you save this product.</small>
            <details>
              <summary>View source</summary>
              <p>{s.reason}</p>
              {source ? (
                <a
                  href={`/api/restorecart/sources/${encodeURIComponent(source.id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.name}
                </a>
              ) : (
                <span>
                  {s.originalSourceName || "Original source unavailable"}
                </span>
              )}
              <blockquote>{s.excerpt}</blockquote>
            </details>
          </div>
        );
      })}
    </aside>
  );
}
