"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";

type Bal = { item_id: string; warehouse_id: string; qty: number };
type Row = { key: string; item: string; warehouse: string; qty: number };

export default function StockBalanceView() {
  const t = useTranslations("stock");
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: bal }, { data: it }, { data: w }] = await Promise.all([
        supabase.from("stock_balances").select("item_id,warehouse_id,qty"),
        supabase.from("items").select("id,name"),
        supabase.from("warehouses").select("id,name"),
      ]);
      const itemName: Record<string, string> = {};
      ((it as { id: string; name: string }[]) ?? []).forEach((r) => (itemName[r.id] = r.name));
      const whName: Record<string, string> = {};
      ((w as { id: string; name: string }[]) ?? []).forEach((r) => (whName[r.id] = r.name));
      const mapped = ((bal as Bal[]) ?? [])
        .map((b) => ({
          key: `${b.item_id}-${b.warehouse_id}`,
          item: itemName[b.item_id] ?? "—",
          warehouse: whName[b.warehouse_id] ?? "—",
          qty: Number(b.qty),
        }))
        .sort((a, b) => a.item.localeCompare(b.item));
      setRows(mapped);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cols: Column<Row>[] = [
    { header: t("item"), cell: (r) => <span className="font-medium text-ink">{r.item}</span> },
    { header: t("warehouse"), cell: (r) => r.warehouse },
    { header: t("onHand"), className: "text-end", cell: (r) => <span className="tabular-nums font-medium">{r.qty}</span> },
  ];

  return <ListTable columns={cols} rows={rows} getKey={(r) => r.key} />;
}
