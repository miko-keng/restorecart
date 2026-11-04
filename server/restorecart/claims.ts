import Papa from "papaparse";

export const CLAIM_VERSION = "claims-v1";
export type ClaimStatus = "supported" | "conflicting" | "insufficient_evidence";
export type Claim = {
  sku: string;
  field: string;
  value: string;
  sourceId: string;
  excerpt: string;
};
export type ClaimFinding = {
  index: number;
  status: ClaimStatus;
  reason: string;
  hardBlock: boolean;
};
const compact = (v: string) =>
  v
    .replace(/\\+"/g, '"')
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
export function assessClaims(
  claims: Claim[],
  products: any[],
  sources: any[],
): ClaimFinding[] {
  return claims.map((claim, index) => {
    const result = (
      status: ClaimStatus,
      reason: string,
      hardBlock = false,
    ) => ({ index, status, reason, hardBlock });
    const product = products.find((p) => p.sku === claim.sku);
    const source = sources.find((s) => s.id === claim.sourceId);
    if (!product || !source)
      return result(
        "insufficient_evidence",
        "Unknown product or source.",
        true,
      );
    if (claim.field === "imageSourceId") {
      if (claim.value !== source.id || !/^image\/(png|jpeg)$/.test(source.mime))
        return result(
          "insufficient_evidence",
          "Photo is not an owned image source.",
          true,
        );
      return result(
        "insufficient_evidence",
        "A filename does not prove the photo matches this variant; confirm the supplied image.",
      );
    }
    let records: any[] = [];
    let fieldValues: string[] = [];
    let evidence = source.text || "";
    if (source.mime === "text/csv") {
      const parsed = Papa.parse<Record<string, string>>(source.text, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim().toLowerCase(),
      });
      const get = (r: any, keys: string[]) =>
        keys
          .map((k) =>
            r[source.columnMapping?.[k]?.trim().toLowerCase() || k]?.trim(),
          )
          .find(Boolean) || "";
      records = parsed.data.filter(
        (r) => get(r, ["sku", "product_id", "product id"]) === claim.sku,
      );
      if (!records.length)
        return result(
          "insufficient_evidence",
          "This spreadsheet has no matching SKU row.",
          true,
        );
      const keys =
        claim.field === "name"
          ? ["name", "product", "product name", "title"]
          : claim.field === "price"
            ? ["price", "unit_price", "unit price"]
            : ["description"];
      const values = records.map((r) => get(r, keys)).filter(Boolean);
      fieldValues = values;
      evidence = values.join("\n");
      // A citation to another row cannot support the selected SKU, even in the same file.
      const rowText = records
        .map(
          (r) =>
            compact(JSON.stringify(r)) +
            " " +
            compact(Object.values(r).join(" ")) +
            " " +
            compact(Papa.unparse([Object.values(r)], { header: false })),
        )
        .join(" ");
      if (
        !claim.excerpt.trim() ||
        (!rowText.includes(compact(claim.excerpt)) &&
          !values.some((v) => compact(v) === compact(claim.excerpt)))
      )
        return result(
          "insufficient_evidence",
          "The citation does not identify evidence from this SKU's row.",
          true,
        );
    } else {
      // Text records must identify the SKU on the cited line; nearby variants are not interchangeable.
      const lines = evidence
        .split(/\r?\n/)
        .filter((line: string) => line.includes(claim.sku));
      evidence = lines.join("\n");
      if (
        !claim.excerpt.trim() ||
        !compact(evidence).includes(compact(claim.excerpt))
      )
        return result(
          "insufficient_evidence",
          "The cited text does not link this claim to the selected SKU.",
          true,
        );
    }
    if (claim.field === "price") {
      if (
        source.mime === "text/csv" &&
        !fieldValues.some((v) => Number(v) === Number(claim.value))
      )
        return result(
          "insufficient_evidence",
          "Price differs from the matching spreadsheet row.",
          true,
        );
      const candidates = product.candidates.filter(
        (c: any) => c.field === "price",
      );
      if (
        !candidates.some(
          (c: any) =>
            c.sourceId === claim.sourceId &&
            Number(c.value) === Number(claim.value),
        )
      )
        return result(
          "insufficient_evidence",
          "Price has no matching source candidate.",
          true,
        );
      if (new Set(candidates.map((c: any) => Number(c.value))).size > 1)
        return result(
          "conflicting",
          "Your records show different prices. Which price is current?",
          true,
        );
      return result("supported", "Price agrees with the recorded candidate.");
    }
    if (!["name", "description"].includes(claim.field))
      return result("insufficient_evidence", "Unsupported field.", true);
    if (claim.value.trim() && compact(evidence).includes(compact(claim.value)))
      return result(
        "supported",
        "Proposed text appears in the matching product record.",
      );
    return result(
      "insufficient_evidence",
      "The matching record does not directly establish the proposed wording.",
    );
  });
}
