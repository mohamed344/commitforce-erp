"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import { useOptionSet } from "@/components/options/useOptionSet";
import { FormActions } from "./ProjectsView";

type Project = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};
type Opt = { id: string; name: string };
// A product needed by the project, aggregated from its bon(s) de commande.
type ProjProduct = { item_id: string; name: string; uom: string | null; qty: number };
type RawPoLine = { item_id: string; qty: number; item: { name: string; uom: string | null } | null };
type ConsumeLine = { item_id: string; name: string; uom: string | null; required: number; consumed: number; remaining: number; issue: string };
type MatCost = { purchased_qty: number; avg_rate: number | null };
type ProjPrice = { rate: number; qty: number; posting_date: string; invoice_no: string | null };
type PurchaseOrder = { id: string; order_no: string | null; order_date: string; status: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function ProjectDetailView({ projectId }: { projectId: string }) {
  const tp = useTranslations("project");
  const ts = useTranslations("sales");
  const tu = useTranslations("ui");
  const router = useRouter();
  const supabase = createClient();
  const { byValue: statusBy } = useOptionSet("project_status");
  const { byValue: poStatusBy } = useOptionSet("purchase_order_status");

  const [project, setProject] = useState<Project | null>(null);
  // Products needed by the project come (read-only) from its bons de commande.
  const [products, setProducts] = useState<ProjProduct[]>([]);
  const [consumedBy, setConsumedBy] = useState<Map<string, number>>(new Map());
  const [matCostBy, setMatCostBy] = useState<Map<string, MatCost>>(new Map());
  const [pricesByItem, setPricesByItem] = useState<Map<string, ProjPrice[]>>(new Map());
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [whs, setWhs] = useState<Opt[]>([]);
  const [busy, setBusy] = useState(false);

  // Consume materials → stock issue
  const [consumeOpen, setConsumeOpen] = useState(false);
  const [consumeWh, setConsumeWh] = useState("");
  const [consumeLines, setConsumeLines] = useState<ConsumeLine[]>([]);
  const [consumeErr, setConsumeErr] = useState<string | null>(null);

  async function load() {
    const [{ data: p }, { data: pol }, { data: cons }, { data: w }, { data: mc }, { data: pp }, { data: po }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      // Every line across this project's bons de commande.
      supabase
        .from("purchase_order_lines")
        .select("item_id, qty, item:items(name,uom), purchase_orders!inner(project_id)")
        .eq("purchase_orders.project_id", projectId),
      supabase.from("project_item_consumption").select("item_id,consumed_qty").eq("project_id", projectId),
      supabase.from("warehouses").select("id,name").order("name"),
      supabase.from("project_material_cost").select("item_id,purchased_qty,avg_rate").eq("project_id", projectId),
      supabase.from("item_purchase_prices").select("item_id,rate,qty,posting_date,invoice_no").eq("project_id", projectId).order("posting_date", { ascending: false }),
      supabase.from("purchase_orders").select("id,order_no,order_date,status").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    setProject((p as Project) ?? null);
    // Aggregate the chiffrage lines into one row per item (sum of requested qty).
    const prodMap = new Map<string, ProjProduct>();
    for (const r of (pol as unknown as RawPoLine[]) ?? []) {
      const cur = prodMap.get(r.item_id);
      if (cur) cur.qty += Number(r.qty);
      else prodMap.set(r.item_id, { item_id: r.item_id, name: r.item?.name ?? "—", uom: r.item?.uom ?? null, qty: Number(r.qty) });
    }
    setProducts(Array.from(prodMap.values()));
    setConsumedBy(new Map(((cons as { item_id: string; consumed_qty: number }[]) ?? []).map((c) => [c.item_id, Number(c.consumed_qty)])));
    setWhs((w as Opt[]) ?? []);
    setMatCostBy(new Map(((mc as { item_id: string; purchased_qty: number; avg_rate: number | null }[]) ?? []).map((m) => [m.item_id, { purchased_qty: Number(m.purchased_qty), avg_rate: m.avg_rate }])));
    const pricesMap = new Map<string, ProjPrice[]>();
    for (const row of (pp as ({ item_id: string } & ProjPrice)[]) ?? []) {
      const list = pricesMap.get(row.item_id) ?? [];
      list.push({ rate: row.rate, qty: row.qty, posting_date: row.posting_date, invoice_no: row.invoice_no });
      pricesMap.set(row.item_id, list);
    }
    setPricesByItem(pricesMap);
    setPurchaseOrders((po as PurchaseOrder[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function remainingOf(p: ProjProduct): number {
    return Math.max(0, p.qty - (consumedBy.get(p.item_id) ?? 0));
  }

  function openConsume() {
    setConsumeErr(null);
    setConsumeWh(whs[0]?.id ?? "");
    setConsumeLines(
      products
        .map((p) => {
          const consumed = consumedBy.get(p.item_id) ?? 0;
          const remaining = Math.max(0, p.qty - consumed);
          return { item_id: p.item_id, name: p.name, uom: p.uom, required: p.qty, consumed, remaining, issue: String(remaining) };
        })
        .filter((c) => c.remaining > 0),
    );
    setConsumeOpen(true);
  }

  async function submitConsume(e: React.FormEvent) {
    e.preventDefault();
    setConsumeErr(null);
    const rows = consumeLines
      .map((c) => ({ item_id: c.item_id, qty: Number(c.issue || 0) }))
      .filter((r) => r.qty > 0);
    if (!consumeWh || rows.length === 0) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("stock_entries")
      .insert({ entry_type: "issue", project_id: projectId, reference: `CONS-${project?.code ?? projectId.slice(0, 8)}` })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      setConsumeErr(error?.message ?? "error");
      return;
    }
    const entryId = (data as { id: string }).id;
    const res = await supabase.from("stock_entry_lines").insert(
      rows.map((r) => ({ stock_entry_id: entryId, item_id: r.item_id, qty: r.qty, source_warehouse_id: consumeWh })),
    );
    setBusy(false);
    if (res.error) {
      setConsumeErr(res.error.message);
      return;
    }
    setConsumeOpen(false);
    load();
  }

  const money = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString());

  const cols: Column<ProjProduct>[] = [
    { header: tp("products"), cell: (p) => <span className="font-medium text-ink">{p.name}</span> },
    { header: tp("quantity"), cell: (p) => <span className="tabular-nums">{p.qty}</span> },
    { header: tp("unit"), cell: (p) => p.uom ?? "—" },
    {
      header: tp("consumed"),
      className: "text-end",
      cell: (p) => {
        const consumed = consumedBy.get(p.item_id) ?? 0;
        const remaining = remainingOf(p);
        return (
          <span className="tabular-nums">
            {consumed}
            {remaining > 0 && <span className="text-ink-4"> / {tp("remaining")} {remaining}</span>}
          </span>
        );
      },
    },
    {
      header: tp("purchasePrices"),
      className: "text-end",
      cell: (p) => {
        const list = pricesByItem.get(p.item_id) ?? [];
        if (list.length === 0) return <span className="text-ink-4">—</span>;
        const distinct = Array.from(new Set(list.map((x) => x.rate)));
        const avg = matCostBy.get(p.item_id)?.avg_rate;
        return (
          <span className="tabular-nums text-ink-2" title={avg != null ? `${tp("avgCost")}: ${money(avg)}` : undefined}>
            {distinct.map((r) => money(r)).join(" · ")}
          </span>
        );
      },
    },
  ];

  const hasRemaining = products.some((p) => remainingOf(p) > 0);

  const poCols: Column<PurchaseOrder>[] = [
    { header: ts("orderNo"), cell: (r) => <span className="font-medium text-ink">{r.order_no ?? "—"}</span> },
    { header: ts("chiffrageDate"), cell: (r) => r.order_date },
    { header: ts("status"), cell: (r) => <Badge tone={poStatusBy.get(r.status)?.tone ?? "gray"}>{poStatusBy.get(r.status)?.label ?? r.status}</Badge> },
  ];

  if (!project) return <div className="p-8 text-[14px] text-ink-3">{tu("loading")}</div>;

  return (
    <div className="mx-auto w-full max-w-[1000px] p-5 sm:p-8">
      <button type="button" onClick={() => router.push("/projects")} className="mb-4 text-[13px] text-ink-3 hover:text-brand">
        ← {tu("back")}
      </button>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold text-ink">{project.name}</h1>
        <Badge tone={statusBy.get(project.status)?.tone ?? "gray"}>{statusBy.get(project.status)?.label ?? project.status}</Badge>
        {project.code && <span className="text-[13px] text-ink-3">{project.code}</span>}
      </div>

      {(project.start_date || project.end_date || project.description) && (
        <div className="mb-6 rounded-[14px] border border-line bg-white p-4 text-[13px] text-ink-2">
          {(project.start_date || project.end_date) && (
            <div>{project.start_date ?? "…"} → {project.end_date ?? "…"}</div>
          )}
          {project.description && <p className="mt-1 text-ink-3">{project.description}</p>}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{tp("products")}</h2>
        {hasRemaining && (
          <button type="button" onClick={openConsume} className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:border-brand-100 hover:text-brand">
            {tp("consume")}
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <p className="rounded-[12px] border border-line bg-white px-4 py-3 text-[13px] text-ink-3">{tp("noProducts")}</p>
      ) : (
        <ListTable columns={cols} rows={products} getKey={(p) => p.item_id} />
      )}

      {/* Bons de commande (chiffrage) raised for this project. */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{tp("purchaseOrders")}</h2>
      </div>
      {purchaseOrders.length === 0 ? (
        <p className="rounded-[12px] border border-line bg-white px-4 py-3 text-[13px] text-ink-3">{tp("noPurchaseOrders")}</p>
      ) : (
        <ListTable
          columns={poCols}
          rows={purchaseOrders}
          getKey={(r) => r.id}
          onRowClick={(r) => router.push(`/sales/orders/${r.id}`)}
          actions={(r) => <RowActions onView={() => router.push(`/sales/orders/${r.id}`)} />}
        />
      )}

      <Modal open={consumeOpen} onClose={() => setConsumeOpen(false)} title={tp("consumeTitle")}>
        <form onSubmit={submitConsume} className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-3">{tp("consumeHint")}</p>
          <label className={labelCls}>
            {tp("chooseWarehouse")}
            <select required value={consumeWh} onChange={(e) => setConsumeWh(e.target.value)} className={field}>
              <option value="">—</option>
              {whs.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2">
            {consumeLines.length === 0 && <p className="text-[13px] text-ink-3">{tp("nothingToConsume")}</p>}
            {consumeLines.map((c, i) => (
              <div key={c.item_id} className="flex items-center gap-2 rounded-[10px] border border-line-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{c.name}</div>
                  <div className="text-[11px] text-ink-3">{tp("required")} {c.required} · {tp("consumed")} {c.consumed} · {tp("remaining")} {c.remaining}</div>
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={c.remaining}
                  value={c.issue}
                  onChange={(e) => setConsumeLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, issue: e.target.value } : x)))}
                  className={`${field} w-24`}
                />
                <span className="w-10 text-[12px] text-ink-3">{c.uom ?? ""}</span>
              </div>
            ))}
          </div>
          {consumeErr && <p className="text-[12px] text-red-600">{consumeErr}</p>}
          <FormActions busy={busy} onCancel={() => setConsumeOpen(false)} disabled={!consumeWh || consumeLines.every((c) => Number(c.issue || 0) <= 0)} />
        </form>
      </Modal>
    </div>
  );
}
