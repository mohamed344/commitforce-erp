"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";

type Ref = { name: string } | null;
type Item = {
  id: string;
  name: string;
  sku: string | null;
  item_type: "template" | "variant";
  category: Ref;
  brand: Ref;
  stock_uom: Ref;
};

export default function ItemsList() {
  const t = useTranslations();
  const ts = useTranslations("stock");
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>([]);
  const [onHand, setOnHand] = useState<Record<string, number>>({});

  async function load() {
    const [{ data: it }, { data: bal }] = await Promise.all([
      supabase
        .from("items")
        .select("id,name,sku,item_type, category:categories(name), brand:brands(name), stock_uom:uoms(name)")
        .order("created_at", { ascending: false }),
      supabase.from("stock_balances").select("item_id,qty"),
    ]);
    setItems((it as unknown as Item[]) ?? []);
    const m: Record<string, number> = {};
    ((bal as { item_id: string; qty: number }[]) ?? []).forEach((b) => {
      m[b.item_id] = (m[b.item_id] ?? 0) + Number(b.qty);
    });
    setOnHand(m);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function del(r: Item) {
    await supabase.from("items").delete().eq("id", r.id);
    load();
  }

  const cols: Column<Item>[] = [
    { header: ts("item"), cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { header: ts("code"), cell: (r) => r.sku ?? "—" },
    { header: ts("itemGroup"), cell: (r) => r.category?.name ?? "—" },
    { header: ts("brand"), cell: (r) => r.brand?.name ?? "—" },
    { header: ts("stockUom"), cell: (r) => r.stock_uom?.name ?? "—" },
    { header: ts("onHand"), cell: (r) => <span className="tabular-nums">{onHand[r.id] ?? 0}</span> },
    { header: t("item.type"), cell: (r) => <Badge tone={r.item_type === "template" ? "blue" : "violet"}>{t(`item.types.${r.item_type}`)}</Badge> },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => router.push("/stock/items/new")}
          className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]"
        >
          + {ts("newItem")}
        </button>
      </div>
      <ListTable
        columns={cols}
        rows={items}
        getKey={(r) => r.id}
        onRowClick={(r) => router.push(`/stock/items/${r.id}`)}
        actions={(r) => (
          <RowActions
            onView={() => router.push(`/stock/items/${r.id}`)}
            onEdit={() => router.push(`/stock/items/${r.id}`)}
            onDelete={() => del(r)}
          />
        )}
      />
    </div>
  );
}
