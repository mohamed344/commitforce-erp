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
import { FormActions } from "@/components/modules/ProjectsView";

type Order = {
  id: string;
  order_no: string | null;
  status: string;
  order_date: string;
  project_id: string | null;
  purchase_invoice_id: string | null;
  supplier: { name: string } | null;
  project: { name: string } | null;
};
type ItemOpt = { id: string; name: string; uom: string | null };
type Line = {
  id: string;
  item_id: string;
  qty: number;
  in_stock_qty: number;
  missing_qty: number;
  item: { name: string; uom: string | null } | null;
};
type Opt = { id: string; name: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100 disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function PurchaseOrderDetailView({
  orderId,
  canCreate,
  canReview,
}: {
  orderId: string;
  canCreate: boolean;
  canReview: boolean;
}) {
  const t = useTranslations("sales");
  const tu = useTranslations("ui");
  const router = useRouter();
  const supabase = createClient();
  const { byValue: statusBy } = useOptionSet("purchase_order_status");

  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [stockByItem, setStockByItem] = useState<Map<string, number>>(new Map());
  const [projects, setProjects] = useState<Opt[]>([]);
  const [suppliers, setSuppliers] = useState<Opt[]>([]);
  const [whs, setWhs] = useState<Opt[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Line | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ item_id: "", qty: "1" });
  const [gen, setGen] = useState({ supplier_id: "", warehouse_id: "" });

  async function load() {
    const [{ data: o }, { data: ln }, { data: it }, { data: sb }, { data: pr }, { data: sup }, { data: w }] = await Promise.all([
      supabase.from("purchase_orders").select("*, supplier:suppliers(name), project:projects(name)").eq("id", orderId).single(),
      supabase.from("purchase_order_lines").select("id,item_id,qty,in_stock_qty,missing_qty, item:items(name,uom)").eq("purchase_order_id", orderId).order("sort_order"),
      supabase.from("items").select("id,name,uom").order("name"),
      supabase.from("stock_balances").select("item_id,qty"),
      supabase.from("projects").select("id,name").order("name"),
      supabase.from("suppliers").select("id,name").order("name"),
      supabase.from("warehouses").select("id,name").order("name"),
    ]);
    setOrder((o as unknown as Order) ?? null);
    setLines((ln as unknown as Line[]) ?? []);
    setItems((it as ItemOpt[]) ?? []);
    // Sum on-hand across all warehouses, per item.
    const m = new Map<string, number>();
    for (const r of (sb as { item_id: string; qty: number }[]) ?? []) {
      m.set(r.item_id, (m.get(r.item_id) ?? 0) + Number(r.qty));
    }
    setStockByItem(m);
    setProjects((pr as Opt[]) ?? []);
    setSuppliers((sup as Opt[]) ?? []);
    setWhs((w as Opt[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const status = order?.status;
  const draftEditable = status === "draft" && canCreate;
  const reviewEditable = (status === "pending_review" || status === "reviewed") && canReview;

  function openNew() {
    setEditing(null);
    setForm({ item_id: "", qty: "1" });
    setOpen(true);
  }
  function openEdit(l: Line) {
    setEditing(l);
    setForm({ item_id: l.item_id, qty: String(l.qty) });
    setOpen(true);
  }

  async function submitLine(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = editing
      ? await supabase.from("purchase_order_lines").update({ qty: Number(form.qty || 0) }).eq("id", editing.id)
      : await supabase.from("purchase_order_lines").insert({
          purchase_order_id: orderId,
          item_id: form.item_id,
          qty: Number(form.qty || 0),
        });
    setBusy(false);
    if (!res.error) {
      setOpen(false);
      load();
    }
  }

  async function delLine(l: Line) {
    await supabase.from("purchase_order_lines").delete().eq("id", l.id);
    load();
  }

  // Reviewer records on-hand stock for a line; missing_qty recomputes in the DB.
  async function setInStock(l: Line, value: string) {
    const v = Number(value || 0);
    if (v === l.in_stock_qty) return;
    await supabase.from("purchase_order_lines").update({ in_stock_qty: v }).eq("id", l.id);
    load();
  }

  async function setProject(project_id: string) {
    await supabase.from("purchase_orders").update({ project_id: project_id || null }).eq("id", orderId);
    setOrder((o) => (o ? { ...o, project_id: project_id || null } : o));
  }

  async function submitForReview() {
    setError(null);
    setBusy(true);
    const res = await supabase.from("purchase_orders").update({ status: "pending_review" }).eq("id", orderId);
    setBusy(false);
    if (res.error) return setError(res.error.message);
    load();
  }

  // Creator can pull a submitted/reviewed chiffrage back to draft to edit it.
  async function reopen() {
    setError(null);
    setBusy(true);
    const res = await supabase.from("purchase_orders").update({ status: "draft" }).eq("id", orderId);
    setBusy(false);
    if (res.error) return setError(res.error.message);
    load();
  }

  async function markReviewed() {
    setError(null);
    setBusy(true);
    const res = await supabase.from("purchase_orders").update({ status: "reviewed" }).eq("id", orderId);
    setBusy(false);
    if (res.error) return setError(res.error.message);
    load();
  }

  async function generate() {
    setError(null);
    if (!gen.supplier_id) return setError(t("selectSupplier"));
    setBusy(true);
    const { data, error: err } = await supabase.rpc("convert_purchase_order_to_invoice", {
      p_order: orderId,
      p_supplier: gen.supplier_id,
      p_warehouse: gen.warehouse_id || null,
    });
    setBusy(false);
    if (err) {
      setError(err.message.includes("nothing_to_purchase") ? t("nothingToPurchase") : err.message);
      return;
    }
    router.push(`/sales/purchases/${data as string}`);
  }

  const num = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString());

  const cols: Column<Line>[] = [
    { header: t("item"), cell: (l) => <span className="font-medium text-ink">{l.item?.name ?? "—"}</span> },
    { header: t("requestedQty"), className: "text-end", cell: (l) => <span className="tabular-nums">{l.qty}</span> },
    { header: "", cell: (l) => l.item?.uom ?? "—" },
    {
      header: t("onHand"),
      className: "text-end",
      cell: (l) => <span className="tabular-nums text-ink-3">{num(stockByItem.get(l.item_id) ?? 0)}</span>,
    },
    {
      header: t("inStock"),
      className: "text-end",
      cell: (l) =>
        reviewEditable ? (
          <input
            type="number"
            step="0.001"
            min="0"
            defaultValue={l.in_stock_qty}
            onBlur={(e) => setInStock(l, e.target.value)}
            className={`${field} w-24 px-2 py-1 text-end`}
          />
        ) : (
          <span className="tabular-nums">{l.in_stock_qty}</span>
        ),
    },
    {
      header: t("missing"),
      className: "text-end",
      cell: (l) => (
        <span className={`tabular-nums font-medium ${l.missing_qty > 0 ? "text-amber-700" : "text-ink-3"}`}>{l.missing_qty}</span>
      ),
    },
  ];

  if (!order) return <div className="p-8 text-[14px] text-ink-3">{tu("loading")}</div>;

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <button type="button" onClick={() => router.push("/sales/orders")} className="mb-4 text-[13px] text-ink-3 hover:text-brand">
        ← {tu("back")}
      </button>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold text-ink">{order.order_no ?? "—"}</h1>
        <Badge tone={statusBy.get(order.status)?.tone ?? "gray"}>{statusBy.get(order.status)?.label ?? order.status}</Badge>
        {order.project?.name && <span className="text-[13px] text-ink-3">{order.project.name}</span>}
        {order.supplier?.name && <span className="text-[13px] text-ink-3">· {order.supplier.name}</span>}
        <span className="text-[13px] text-ink-3">· {t("chiffrageDate")}: {order.order_date}</span>
      </div>

      {/* Project — the chiffrage is the list of articles this project needs. */}
      <div className="mb-6 grid gap-3 rounded-[14px] border border-line bg-white p-4 sm:grid-cols-2">
        <label className={labelCls}>
          {t("project")}
          <select disabled={!draftEditable} value={order.project_id ?? ""} onChange={(e) => setProject(e.target.value)} className={field}>
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{t("lines")}</h2>
        {draftEditable && (
          <button type="button" onClick={openNew} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]">
            + {t("addLine")}
          </button>
        )}
      </div>

      <ListTable
        columns={cols}
        rows={lines}
        getKey={(l) => l.id}
        actions={draftEditable ? (l) => <RowActions onEdit={() => openEdit(l)} onDelete={() => delLine(l)} /> : undefined}
      />

      {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}

      {/* Actions — one stage at a time */}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line-2 pt-5">
        {canCreate && !order.purchase_invoice_id && (status === "pending_review" || status === "reviewed") && (
          <button
            type="button"
            onClick={reopen}
            disabled={busy}
            className="rounded-[10px] border border-line px-5 py-2.5 text-[14px] font-semibold text-ink-2 transition-colors hover:border-brand-100 hover:text-brand disabled:opacity-60"
          >
            {t("reopenToEdit")}
          </button>
        )}
        {order.purchase_invoice_id ? (
          <button
            type="button"
            onClick={() => router.push(`/sales/purchases/${order.purchase_invoice_id}`)}
            className="rounded-[10px] border border-brand px-5 py-2.5 text-[14px] font-semibold text-brand hover:bg-brand-50"
          >
            {t("viewPurchaseInvoice")}
          </button>
        ) : status === "draft" ? (
          canCreate && (
            <button
              type="button"
              onClick={submitForReview}
              disabled={busy || lines.length === 0}
              className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-5 py-2.5 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
            >
              {busy ? t("submitting") : t("submitForReview")}
            </button>
          )
        ) : status === "pending_review" ? (
          canReview ? (
            <button
              type="button"
              onClick={markReviewed}
              disabled={busy}
              className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-5 py-2.5 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
            >
              {busy ? t("marking") : t("markReviewed")}
            </button>
          ) : (
            <span className="text-[13px] text-ink-3">{statusBy.get("pending_review")?.label}</span>
          )
        ) : status === "reviewed" && canReview ? (
          <div className="flex w-full flex-wrap items-end gap-3">
            <label className={labelCls}>
              {t("supplier")}
              <select value={gen.supplier_id} onChange={(e) => setGen({ ...gen, supplier_id: e.target.value })} className={field}>
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t("warehouseInto")}
              <select value={gen.warehouse_id} onChange={(e) => setGen({ ...gen, warehouse_id: e.target.value })} className={field}>
                <option value="">—</option>
                {whs.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={generate}
              disabled={busy || !gen.supplier_id}
              className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-5 py-2.5 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
            >
              {busy ? t("generating") : t("generatePurchaseInvoice")}
            </button>
            <span className="w-full text-[12px] text-ink-3">{t("generateHint")}</span>
          </div>
        ) : (
          <span className="text-[13px] text-ink-3">{statusBy.get(order.status)?.label ?? order.status}</span>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? tu("edit") : t("addLine")}>
        <form onSubmit={submitLine} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("item")}
            <select
              required
              disabled={!!editing}
              value={form.item_id}
              onChange={(e) => setForm({ ...form, item_id: e.target.value })}
              className={field}
            >
              <option value="">—</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            {t("quantity")}
            <input type="number" step="0.001" required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={field} />
          </label>
          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.item_id || !form.qty} />
        </form>
      </Modal>
    </div>
  );
}
