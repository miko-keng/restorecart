/** Resume only a remembered shop returned by this seller's authorized list. */
export function preferredShop(
  shops: { id: string; demoPrepared?: boolean }[],
  remembered: string | null,
) {
  return (
    shops.find((s) => s.id === remembered)?.id ||
    shops.find((s) => s.demoPrepared)?.id ||
    shops[0]?.id ||
    null
  );
}
