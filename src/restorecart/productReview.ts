// Questions currently have SKU + text, so unknown topics stay at product level.
export function findingField(text: string) {
  if (/price|currency|USD|\$/i.test(text)) return "price";
  if (/photo|image|picture/i.test(text)) return "imageSourceId";
  if (/description/i.test(text)) return "description";
  if (/product name|title/i.test(text)) return "name";
  return "general";
}
export function productStatus(row: any) {
  if (row?.status === "excluded") return "Hidden from shop";
  if (row?.status === "ready") return "Ready to publish";
  const questions: string[] = row?.questions || [];
  if (questions.some((q) => /price|currency/i.test(q)))
    return "Needs review · choose the correct price";
  if (questions.some((q) => /photo|image/i.test(q)))
    return "Needs review · confirm photo";
  if (questions.some((q) => /stock|physical|reserve/i.test(q)))
    return "Needs review · confirm stock";
  return "Needs review · confirm details";
}

export function normalizeStockInput(value: string) {
  return /^\d*$/.test(value) ? value.replace(/^0+(?=\d)/, "") : null;
}
export function productSaveIssues(fields: any, product: any) {
  const issues: string[] = [];
  const count = String(fields.quantity ?? ""),
    allocation = String(fields.allocation ?? "");
  if (!/^\d+$/.test(count) || Number(count) > 10000)
    issues.push("Enter a physical count from 0 to 10,000 whole units.");
  if (!/^\d+$/.test(allocation) || Number(allocation) > 10000)
    issues.push("Enter whole units to set aside (0–10,000).");
  if (Number(allocation) > Number(count))
    issues.push(
      "Set-aside units cannot exceed the physical count. Increase the count or reduce the set-aside quantity.",
    );
  if (!fields.excluded) {
    if (
      !/^\d+(\.\d{1,2})?$/.test(String(fields.price)) ||
      Number(fields.price) <= 0
    )
      issues.push("Choose a valid current price.");
    const prices = new Set(
      (product.candidates || [])
        .filter((c: any) => c.field === "price")
        .map((c: any) => c.value),
    );
    if (prices.size > 1 && !String(fields.resolutionNote || "").trim())
      issues.push(
        "Resolve the price conflict: choose the current price and explain which source confirms it.",
      );
    if (Number(allocation) < 1)
      issues.push(
        "Set aside at least 1 counted unit to sell, or select Hide this product from the shop.",
      );
    if (!fields.confirm)
      issues.push("Tick the product and physical-stock confirmation.");
  }
  return issues;
}
