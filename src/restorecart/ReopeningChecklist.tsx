import { Button } from "@radix-ui/themes";
import { CheckCircle2 } from "lucide-react";
import { PaymentsUi } from "./PaymentsUi";
export function ReopeningChecklist({
  readiness,
  dirtyCount,
  blockers,
  onReview,
  onPickup,
  onPayments,
}: any) {
  const products =
    readiness?.products?.filter((p: any) => p.status === "needs-information") ||
    [];
  const other =
    readiness?.blockers?.filter((b: any) => b.kind !== "product") || [];
  const ready = !!readiness?.canPublish && !dirtyCount;
  return (
    <PaymentsUi>
      <div
        id="rc-reopening-checklist"
        className="rc-readiness-summary"
        aria-label="Reopening checklist"
      >
        <div>
          <strong>
            {!readiness
              ? "Checking readiness…"
              : products.length
                ? `${products.length} products need review`
                : ready
                  ? "Catalog ready"
                  : "Finish shop setup"}
          </strong>
        </div>
        {products.length > 0 && (
          <Button
            type="button"
            size="2"
            onClick={() => onReview(products[0].sku)}
          >
            Review next
          </Button>
        )}
        {!products.length && other.length > 0 && (
          <details>
            <summary>Shop checks</summary>
            <ul>
              {other.map((b: any, i: number) => (
                <li key={i}>{b.message}</li>
              ))}
            </ul>
            {other.some((b: any) => b.kind === "pickup") && (
              <button className="rc-link" onClick={onPickup}>
                Add pickup instructions
              </button>
            )}
          </details>
        )}
        {readiness?.payment?.available === false && (
          <button className="rc-link" onClick={onPayments}>
            Connect PayPal
          </button>
        )}
      </div>
    </PaymentsUi>
  );
}
