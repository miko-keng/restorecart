export function SupportingRecords({ product, sources, review }: any) {
  const records = new Map<string, any>();
  for (const c of product.candidates || []) {
    const record = records.get(c.sourceId) || {
      id: c.sourceId,
      facts: new Set<string>(),
      excerpts: new Set<string>(),
      cited: false,
    };
    if (["price", "stock", "name"].includes(c.field))
      record.facts.add(
        `${c.field === "stock" ? "Listed stock" : c.field === "price" ? "Price" : "Name"}: ${c.value}`,
      );
    if (c.excerpt) record.excerpts.add(c.excerpt);
    records.set(c.sourceId, record);
  }
  for (const citation of (review?.suggestions || []).filter(
    (s: any) => s.sku === product.sku,
  )) {
    const record = records.get(citation.sourceId) || {
      id: citation.sourceId,
      facts: new Set<string>(),
      excerpts: new Set<string>(),
      cited: true,
    };
    record.cited = true;
    if (citation.excerpt) record.excerpts.add(citation.excerpt);
    records.set(citation.sourceId, record);
  }
  if (!records.size) return null;
  return (
    <details className="rc-supporting-records">
      <summary>Supporting records · {records.size} files</summary>
      <p>
        Imported records support your decisions. “Cited by Gemini” identifies a
        citation in the saved or current AI review; it does not verify current
        physical stock.
      </p>
      <div className="rc-record-table">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Relevant information</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {[...records.values()].map((record) => {
              const source = sources.find((s: any) => s.id === record.id);
              return (
                <tr key={record.id}>
                  <td>
                    {source?.name || "Original record unavailable"}
                    {source && (
                      <a
                        href={`/api/restorecart/sources/${encodeURIComponent(source.id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View original ↗
                      </a>
                    )}
                  </td>
                  <td>
                    {[...record.facts].join(" · ") || "Supporting excerpt"}
                    <details>
                      <summary>Show excerpt</summary>
                      {[...record.excerpts].map((excerpt, i) => (
                        <blockquote key={i}>{String(excerpt)}</blockquote>
                      ))}
                    </details>
                  </td>
                  <td>
                    {record.cited ? "Cited by Gemini" : "Imported record"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
