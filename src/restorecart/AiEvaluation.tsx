import evaluation from "../../tests/evidence/restorecart-verifier-evaluation.json";
export function AiEvaluation() {
  const cases = evaluation.cases;
  return (
    <details className="rc-notice rc-demo-panel">
      <summary>AI Evaluation — Synthetic Dataset</summary>
      <p>
        Saved run: {evaluation.generatedAt} · {evaluation.model}. Actual Gemini
        verifier on fixed human-authored proposals, not real merchant data or
        end-to-end producer accuracy.
      </p>
      <table>
        <thead>
          <tr>
            <th>Measure</th>
            <th>Recorded result</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Claims examined</td>
            <td>{cases.length}</td>
          </tr>
          <tr>
            <td>Combined decisions matching labels</td>
            <td>
              {evaluation.combined.correctDecisions} / {cases.length}
            </td>
          </tr>
          <tr>
            <td>Unsupported claims accepted</td>
            <td>{evaluation.combined.unsupportedAccepted}</td>
          </tr>
          <tr>
            <td>Supported claims retained</td>
            <td>{evaluation.combined.correctRetained}</td>
          </tr>
          {(["development", "holdout"] as const).map((split) => {
            const rows = cases.filter((c) => c.split === split);
            return (
              <tr key={split}>
                <td>{split} decisions matching labels</td>
                <td>
                  {rows.filter((c) => c.combined === c.expected).length} /{" "}
                  {rows.length}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        {evaluation.limitations} Verifier activation: off pending live producer
        comparison.
      </p>
      <p>
        AI proposes information. Server checks evidence and blocks unsupported
        claims. Sellers make the final decision. Provider unavailability can
        interrupt fresh requests; replay does not measure current availability.
      </p>
    </details>
  );
}
