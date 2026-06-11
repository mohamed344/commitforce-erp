// Shared stock-matching helpers for the CRM chiffrage pipeline.
// Extracted from CrmProjectDetailView so the QTE auto-price, CSV import, and
// exports all match Excel/CSV rows against the item catalogue the same way.

export type MaterialStatus = "in_stock" | "insufficient" | "not_found";

// UI/export status: adds "needs_price" for items that matched an article but
// have no price yet (price null/0). Derived, never stored — the DB `status`
// column only allows the three MaterialStatus values.
export type DisplayStatus = MaterialStatus | "needs_price";

export function displayStatus(m: { status: MaterialStatus; matched_item_id: string | null; unit_rate: number | null }): DisplayStatus {
  if (m.matched_item_id && (m.unit_rate == null || m.unit_rate === 0)) return "needs_price";
  return m.status;
}

/** Item catalogue row used for matching + pricing. */
export type ItemRow = {
  id: string;
  name: string;
  sku: string | null;
  standard_buying_rate: number | null;
  valuation_rate: number | null;
  uom: string | null;
};

export type MatchResult = {
  matched_item_id: string | null;
  matched_item: ItemRow | null;
  unit_rate: number | null;
  in_stock_qty: number | null;
  status: MaterialStatus;
};

/** Lowercase, strip accents and collapse whitespace — for fuzzy header/value matching. */
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Parse a quantity that may use a comma decimal separator / thousands spaces. */
export function toNum(s: unknown): number {
  const cleaned = String(s ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Index of the first header cell that contains one of the candidate keywords (-1 if none). */
export function findCol(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const nk = norm(headers[i]);
    if (candidates.some((c) => nk.includes(c))) return i;
  }
  return -1;
}

/** Lookup tables built once from the item catalogue + on-hand balances. */
export type ItemIndex = {
  bySku: Map<string, ItemRow>;
  byName: Map<string, ItemRow>;
  stockBy: Map<string, number>;
};

export function buildItemIndex(
  items: ItemRow[],
  balances: { item_id: string; qty: number }[],
): ItemIndex {
  const bySku = new Map<string, ItemRow>();
  const byName = new Map<string, ItemRow>();
  for (const it of items) {
    if (it.sku) bySku.set(norm(it.sku), it);
    byName.set(norm(it.name), it);
  }
  const stockBy = new Map<string, number>();
  for (const b of balances) {
    stockBy.set(b.item_id, (stockBy.get(b.item_id) ?? 0) + Number(b.qty));
  }
  return { bySku, byName, stockBy };
}

/**
 * Match one material line (by reference/SKU, then by name) to the catalogue and
 * snapshot its unit price (buying → valuation fallback), on-hand qty, and status.
 */
export function matchLine(ref: string, name: string, qty: number, index: ItemIndex): MatchResult {
  let matched: ItemRow | null = null;
  if (ref) matched = index.bySku.get(norm(ref)) ?? null;
  if (!matched && name) matched = index.byName.get(norm(name)) ?? null;

  const inStock = matched ? index.stockBy.get(matched.id) ?? 0 : null;
  const unitRate = matched ? matched.standard_buying_rate ?? matched.valuation_rate ?? null : null;

  let status: MaterialStatus;
  if (!matched) status = "not_found";
  else if (qty > 0 && (inStock ?? 0) >= qty) status = "in_stock";
  else status = "insufficient";

  return { matched_item_id: matched?.id ?? null, matched_item: matched, unit_rate: unitRate, in_stock_qty: inStock, status };
}
