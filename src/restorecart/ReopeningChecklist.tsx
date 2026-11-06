import { Badge, Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
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
      <Card
        size="3"
        id="rc-reopening-checklist"
        className="rc-payment-card"
        aria-label="Reopening checklist"
      >
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Heading as="h3" size="4">
            Reopening checklist
          </Heading>
          <Badge color={ready ? "teal" : "amber"}>
            {ready
              ? "Ready"
              : readiness
                ? `${products.length} to review`
                : "Checking…"}
          </Badge>
        </Flex>
        {ready ? (
          <Text as="p" size="2" mt="3" role="status">
            <CheckCircle2 size={15} /> Catalog checks passed. Preview, then
            publish.
          </Text>
        ) : (
          <>
            {!!dirtyCount && (
              <p className="rc-payment-hint">
                Save your unsaved product edits first.
              </p>
            )}
            {products.map((p: any) => (
              <div key={p.sku} className="rc-checklist-row">
                <Flex justify="between" align="center" gap="3">
                  <Text weight="medium" size="2">
                    {p.name}
                  </Text>
                  <Button
                    type="button"
                    size="1"
                    variant="soft"
                    onClick={() => onReview(p.sku)}
                  >
                    Review {p.name} →
                  </Button>
                </Flex>
                <details className="rc-payment-details">
                  <summary>
                    {p.questions.length}{" "}
                    {p.questions.length === 1 ? "check" : "checks"} to finish
                  </summary>
                  <ul>
                    {p.questions.map((q: string) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
            {other.length > 0 && (
              <details className="rc-payment-details" open={!products.length}>
                <summary>Shop checks</summary>
                <ul>
                  {other.map((b: any, i: number) => (
                    <li key={i}>{b.message}</li>
                  ))}
                </ul>
              </details>
            )}
            {readiness?.blockers?.some((b: any) => b.kind === "pickup") && (
              <Button type="button" variant="soft" mt="3" onClick={onPickup}>
                Add pickup instructions →
              </Button>
            )}
            {!readiness && <p className="rc-payment-hint">{blockers[0]}</p>}
          </>
        )}
        {readiness?.payment?.available === false && (
          <Flex gap="3" align="center" wrap="wrap" mt="3">
            <Text size="2" color="gray">
              Connect PayPal to accept payments.
            </Text>
            <Button type="button" size="1" variant="soft" onClick={onPayments}>
              Connect PayPal →
            </Button>
          </Flex>
        )}
      </Card>
    </PaymentsUi>
  );
}
