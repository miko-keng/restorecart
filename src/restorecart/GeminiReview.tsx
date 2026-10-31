export function GeminiReview({ review }: any) {
  const day = review.origin?.generatedOn || review.generatedAt;
  return (
    <section
      className="rc-ai-review rc-gemini-review"
      aria-label="Gemini Review"
    >
      <div className="rc-gemini-heading">
        <h3>{review.source === "gemini" ? "Gemini Review" : "Test Review"}</h3>
        <span className="rc-pill">
          {review.savedDemo
            ? "Saved demo result"
            : review.saved
              ? "Saved result"
              : review.cached
                ? "Cached result"
                : "Fresh result"}
        </span>
      </div>
      <p className="rc-review-provenance">
        {review.model}
        {day
          ? ` · Generated ${review.origin?.datePrecision === "day" ? day : new Date(day).toLocaleString()}`
          : ""}
        .{" "}
        {review.saved
          ? "Replaying a previously generated answer — no API call."
          : "Review suggestions do not approve products or verify physical stock."}
      </p>
      {review.stale && (
        <p className="rc-notice" role="status">
          Earlier review. Product details or sources have changed. Original
          findings remain below; outdated suggestions cannot be applied.
        </p>
      )}
      <p>
        Findings appear directly beneath the fields they concern. You confirm
        the details and stock before publishing.
      </p>
      <details>
        <summary>Review summary</summary>
        <p>{review.summary}</p>
      </details>
    </section>
  );
}
