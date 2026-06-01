"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { BellIcon } from "./icons";

type Balance = { item_id: string; qty: number };
type Item = { id: string; name: string; reorder_level: number | null };

/** A product whose total on-hand qty has fallen to/below its effective threshold. */
type LowItem = { id: string; name: string; qty: number; threshold: number };

/**
 * Header notification bell. Lists products at or below their low-stock
 * threshold — the per-company default (Settings → General), unless an item
 * defines its own `reorder_level`, which then takes precedence. Clicking a
 * product opens its detail page. Only products that actually have stock
 * movements (rows in stock_balances) are considered, so service/non-stock
 * items never appear.
 */
export default function LowStockBell({ threshold }: { threshold: number }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LowItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [{ data: bal }, { data: its }] = await Promise.all([
      supabase.from("stock_balances").select("item_id,qty"),
      supabase.from("items").select("id,name,reorder_level"),
    ]);

    // Sum on-hand across warehouses per item.
    const onHand = new Map<string, number>();
    for (const b of (bal as Balance[]) ?? []) {
      onHand.set(b.item_id, (onHand.get(b.item_id) ?? 0) + Number(b.qty));
    }

    const byId = new Map<string, Item>();
    for (const it of (its as Item[]) ?? []) byId.set(it.id, it);

    const low: LowItem[] = [];
    for (const [itemId, qty] of onHand) {
      const it = byId.get(itemId);
      const level = it?.reorder_level != null && it.reorder_level > 0 ? Number(it.reorder_level) : threshold;
      if (qty <= level) {
        low.push({ id: itemId, name: it?.name ?? "—", qty, threshold: level });
      }
    }
    low.sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name));
    setItems(low);
  }, [supabase, threshold]);

  // Initial load + refresh whenever the window regains focus (auto-freshness).
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function goTo(id: string) {
    setOpen(false);
    router.push(`/stock/items/${id}`);
  }

  const count = items.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("title")}
        title={t("title")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`relative grid h-[34px] w-[34px] place-items-center rounded-full border transition-colors hover:border-brand-100 hover:bg-brand-50 ${
          open ? "border-brand-100 bg-brand-50 text-brand" : "border-line bg-white text-ink-2"
        }`}
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_0_2px_white]">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      <div
        role="menu"
        aria-hidden={!open}
        className={`absolute end-0 top-[calc(100%+8px)] z-30 w-[300px] rounded-xl border border-line bg-white p-1.5 text-start shadow-[0_12px_32px_-8px_rgba(20,22,30,.16),0_2px_6px_rgba(20,22,30,.06)] transition-[opacity,transform] duration-150 ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-[.98] opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line-2 px-3 pb-2.5 pt-3">
          <span className="text-[13px] font-semibold text-ink">{t("lowStock")}</span>
          {count > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">{count}</span>
          )}
        </div>

        {count === 0 ? (
          <div className="px-3 py-6 text-center text-[13px] text-ink-3">{t("allGood")}</div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto py-1">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                role="menuitem"
                onClick={() => goTo(it.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors hover:bg-line-2"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-50 text-red-500">
                  <BellIcon width={15} height={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{it.name}</span>
                  <span className="block text-[11px] text-ink-3">
                    {t("onHand")}: <span className="font-semibold tabular-nums text-red-600">{it.qty}</span> · {t("threshold")}: {it.threshold}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
