import { Button, Card, Heading, Text } from "@radix-ui/themes";
import { PaymentsUi } from "./PaymentsUi";
import { useState } from "react";
import fixture from "./fixtures/sample-order-chat.json";
type Recording = {
  source: string;
  model: string;
  generatedAt: string;
  text: string;
  input: { order: typeof fixture.order; prompt: string };
};
export function SampleOrderChat() {
  const [shown, setShown] = useState(false);
  const [decision, setDecision] = useState("");
  const recording = fixture.recording as Recording | null;
  const valid =
    recording?.source === "gemini" &&
    JSON.stringify(recording.input) ===
      JSON.stringify({ order: fixture.order, prompt: fixture.prompt });
  return (
    <PaymentsUi>
      <Card
        size="3"
        className="rc-payment-card"
        aria-label="Sample order assistant"
      >
        <Heading as="h3" size="4">
          {valid
            ? "Saved Gemini demo · Sample orders"
            : "Preparation demo · Sample orders"}
        </Heading>
        <p>
          1 Blue mug · $20 ·{" "}
          {decision === "approve" ? "Ready for pickup (sample)" : "Preparing"}
        </p>
        <Text as="p" size="1" color="gray" mt="2" mb="3">
          Sample only · No payments or inventory changes
        </Text>
        <Button type="button" variant="soft" onClick={() => setShown(true)}>
          {valid ? "Show saved Gemini chat" : "Show sample walkthrough"}
        </Button>
        {shown && (
          <>
            <details className="rc-payment-details">
              <summary>Saved prompt and model</summary>
              <p>{fixture.prompt}</p>
              {valid && (
                <p>
                  {recording!.model} · {recording!.generatedAt} · Replay uses no
                  tokens.
                </p>
              )}
            </details>
            <p>
              <b>
                {valid
                  ? "Gemini (saved response)"
                  : "Scripted example — Gemini recording unavailable"}
                :
              </b>{" "}
              {valid
                ? recording!.text
                : "Prepare the sample Blue mug, then mark it ready for pickup when packing is complete."}
            </p>
            <Text as="p" size="1" color="gray" mt="2" mb="3">
              Demo action: mark this sample ready for pickup.
            </Text>
            {decision ? (
              <p role="status">
                {decision === "approve"
                  ? "Approved — sample marked ready for pickup."
                  : "Rejected — sample stays Preparing."}
              </p>
            ) : (
              <div className="rc-buttonrow">
                <Button type="button" onClick={() => setDecision("approve")}>
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="soft"
                  onClick={() => setDecision("reject")}
                >
                  Reject
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDecision("");
                setShown(false);
              }}
            >
              Reset demo
            </Button>
          </>
        )}
        <details className="rc-payment-details">
          <summary>About this demo</summary>
          <p>
            Decisions never affect PayPal, real inventory or recovery reports.
            The saved answer is advisory.
          </p>
        </details>
      </Card>
    </PaymentsUi>
  );
}
