export function GeminiReview({ review }: any) {
  const day = review.origin?.generatedOn || review.generatedAt;
  const saved = review.savedDemo || review.saved || review.cached;
  return (
    <section className="rc-ai-review rc-gemini-review" aria-label="AI review">
      <div className="rc-gemini-heading">
        <h3>AI review</h3>
        <span className="rc-pill">
          {saved ? "Saved response" : "New response"}
        </span>
      </div>
      <p>{review.summary}</p>
      {review.stale && (
        <p role="status">
          Sources or product details changed. Review current evidence before
          using earlier suggestions.
        </p>
      )}
      <details>
        <summary>Details</summary>
        <p>
          {review.model} ·{" "}
          {day ? new Date(day).toLocaleString() : "Generation time unavailable"}
        </p>
        <p>
          {saved
            ? "Previously generated response. Opening it makes no API call."
            : "A new review uses model allowance."}
        </p>
        <p>
          {review.savedDemo
            ? "Prepared sample records."
            : "Review of this shop’s records."}{" "}
          Seller confirmation is required before publishing.
        </p>
      </details>
    </section>
  );
}
