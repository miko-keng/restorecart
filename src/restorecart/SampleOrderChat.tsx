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
    <section className="rc-notice rc-demo-panel" aria-label="Sample order assistant">
      <h3>
        {valid
          ? "Saved Gemini demo · Sample orders"
          : "Preparation demo · Sample orders"}
      </h3>
      <p>
        1 Blue mug · $20 ·{" "}
        {decision === "approve" ? "Ready for pickup (sample)" : "Preparing"}
      </p>
      <p>
        Sample only. Decisions stay in this panel and never affect PayPal, real
        inventory or recovery reports.
      </p>
      <button className="rc-button secondary" onClick={() => setShown(true)}>
        {valid ? "Show saved Gemini chat" : "Show sample walkthrough"}
      </button>
      {shown && (
        <>
          <p>
            <b>You:</b> {fixture.prompt}
          </p>
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
          {valid && (
            <small>
              {recording!.model} · {recording!.generatedAt} · Replay uses no
              tokens.
            </small>
          )}
          <p>
            Demo action: mark this sample ready for pickup. The recorded answer
            is advisory; you choose.
          </p>
          {decision ? (
            <p role="status">
              {decision === "approve"
                ? "Approved — sample marked ready for pickup."
                : "Rejected — sample stays Preparing."}
            </p>
          ) : (
            <div className="rc-buttonrow">
              <button
                className="rc-button"
                onClick={() => setDecision("approve")}
              >
                Approve
              </button>
              <button
                className="rc-button secondary"
                onClick={() => setDecision("reject")}
              >
                Reject
              </button>
            </div>
          )}
          <button
            className="rc-button secondary"
            onClick={() => {
              setDecision("");
              setShown(false);
            }}
          >
            Reset demo
          </button>
        </>
      )}
    </section>
  );
}
