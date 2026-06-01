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
import { INVOICE_KINDS, type InvoiceKind } from "./invoiceKind";

type Invoice = {
  id: string;
  invoice_no: string | null;
  status: string;
  invoice_date: string;
  warehouse_id: string | null;
  tax_rate: number;
  total_ht: number;
  total_tax: number;
  total_ttc: number;
  stock_entry_id: string | null;
  partner: { name: string } | null;
};
type ItemOpt = {
  id: string;
  name: string;
  uom: string | null;
  standard_selling_rate: number | null;
  standard_buying_rate: number | null;
};
type Line = { id: string; item_id: string; qty: number; rate: number; item: { name: string; uom: string | null } | null };
type Opt = { id: string; name: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100 disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function InvoiceDetailView({ kind, invoiceId }: { kind: InvoiceKind; invoiceId: string }) {
  const cfg = INVOICE_KINDS[kind];
  const t = useTranslations("sales");
  const tu = useTranslations("ui");
  const router = useRouter();
  const supabase = createClient();
  const { byValue: statusBy } = useOptionSet("invoice_status");

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [whs, setWhs] = useState<Opt[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Line | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ item_id: "", qty: "1", rate: "" });

  async function load() {
    const [{ data: inv }, { data: ln }, { data: it }, { data: w }] = await Promise.all([
      supabase.from(cfg.table).select(`*, ${cfg.partnerSelect}`).eq("id", invoiceId).single(),
      supabase.from(cfg.linesTable).select("id,item_id,qty,rate, item:items(name,uom)").eq(cfg.fk, invoiceId).order("sort_order"),
      supabase.from("items").select("id,name,uom,standard_selling_rate,standard_buying_rate").order("name"),
      supabase.from("warehouses").select("id,name").order("name"),
    ]);
    setInvoice((inv as unknown as Invoice) ?? null);
    setLines((ln as unknown as Line[]) ?? []);
    setItems((it as ItemOpt[]) ?? []);
    setWhs((w as Opt[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const locked = invoice?.status !== "draft";

  function defaultRate(it: ItemOpt | undefined): string {
    if (!it) return "";
    const r = kind === "sales" ? it.standard_selling_rate : it.standard_buying_rate;
    return r != null ? String(r) : "";
  }

  function openNew() {
    setEditing(null);
    setForm({ item_id: "", qty: "1", rate: "" });
    setOpen(true);
  }
  function openEdit(l: Line) {
    setEditing(l);
    setForm({ item_id: l.item_id, qty: String(l.qty), rate: String(l.rate) });
    setOpen(true);
  }

  async function submitLine(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      [cfg.fk]: invoiceId,
      item_id: form.item_id,
      qty: Number(form.qty || 0),
      rate: Number(form.rate || 0),
    };
    const res = editing
      ? await supabase.from(cfg.linesTable).update({ qty: payload.qty, rate: payload.rate }).eq("id", editing.id)
      : await supabase.from(cfg.linesTable).insert(payload);
    setBusy(false);
    if (!res.error) {
      setOpen(false);
      load();
    }
  }

  async function delLine(l: Line) {
    await supabase.from(cfg.linesTable).delete().eq("id", l.id);
    load();
  }

  async function setWarehouse(warehouse_id: string) {
    await supabase.from(cfg.table).update({ warehouse_id: warehouse_id || null }).eq("id", invoiceId);
    setInvoice((inv) => (inv ? { ...inv, warehouse_id: warehouse_id || null } : inv));
  }
  async function setTax(rate: string) {
    await supabase.from(cfg.table).update({ tax_rate: Number(rate || 0) }).eq("id", invoiceId);
    load();
  }

  async function validate() {
    setError(null);
    setBusy(true);
    const res = await supabase.from(cfg.table).update({ status: "validated" }).eq("id", invoiceId);
    setBusy(false);
    if (res.error) {
      setError(res.error.message.includes("warehouse_required") ? t("selectWarehouse") : res.error.message);
      return;
    }
    load();
  }

  const money = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString());

  const cols: Column<Line>[] = [
    { header: t("item"), cell: (l) => <span className="font-medium text-ink">{l.item?.name ?? "—"}</span> },
    { header: t("quantity"), cell: (l) => <span className="tabular-nums">{l.qty}</span> },
    { header: "", cell: (l) => l.item?.uom ?? "—" },
    { header: t("unitPrice"), className: "text-end", cell: (l) => <span className="tabular-nums">{money(l.rate)}</span> },
    { header: t("amount"), className: "text-end", cell: (l) => <span className="tabular-nums font-medium">{money(l.qty * l.rate)}</span> },
  ];

  if (!invoice) return <div className="p-8 text-[14px] text-ink-3">{tu("loading")}</div>;

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <button type="button" onClick={() => router.push(cfg.listHref)} className="mb-4 text-[13px] text-ink-3 hover:text-brand">
        ← {tu("back")}
      </button>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold text-ink">{invoice.invoice_no ?? "—"}</h1>
        <Badge tone={statusBy.get(invoice.status)?.tone ?? "gray"}>{statusBy.get(invoice.status)?.label ?? invoice.status}</Badge>
        <span className="text-[13px] text-ink-3">{invoice.partner?.name ?? "—"}</span>
        <span className="text-[13px] text-ink-3">· {invoice.invoice_date}</span>
      </div>

      {/* Header controls */}
      <div className="mb-6 grid gap-3 rounded-[14px] border border-line bg-white p-4 sm:grid-cols-2">
        <label className={labelCls}>
          {t(cfg.warehouseLabelKey)}
          <select disabled={locked} value={invoice.warehouse_id ?? ""} onChange={(e) => setWarehouse(e.target.value)} className={field}>
            <option value="">—</option>
            {whs.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          {t("taxRate")}
          <input type="number" step="0.01" disabled={locked} defaultValue={invoice.tax_rate} onBlur={(e) => setTax(e.target.value)} className={field} />
        </label>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{t("lines")}</h2>
        {!locked && (
          <button type="button" onClick={openNew} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]">
            + {t("addLine")}
          </button>
        )}
      </div>

      <ListTable
        columns={cols}
        rows={lines}
        getKey={(l) => l.id}
        actions={locked ? undefined : (l) => <RowActions onEdit={() => openEdit(l)} onDelete={() => delLine(l)} />}
      />

      {/* Totals */}
      <div className="mt-4 flex flex-col items-end gap-1 text-[14px]">
        <div className="flex gap-6"><span className="text-ink-3">{t("totalHT")}</span><span className="w-32 text-end tabular-nums">{money(invoice.total_ht)}</span></div>
        <div className="flex gap-6"><span className="text-ink-3">{t("totalTVA")} ({invoice.tax_rate}%)</span><span className="w-32 text-end tabular-nums">{money(invoice.total_tax)}</span></div>
        <div className="flex gap-6 text-[15px] font-semibold text-ink"><span>{t("totalTTC")}</span><span className="w-32 text-end tabular-nums">{money(invoice.total_ttc)}</span></div>
      </div>

      {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}

      {/* Validate / locked notice */}
      <div className="mt-6 flex items-center gap-3 border-t border-line-2 pt-5">
        {locked ? (
          <>
            <span className="text-[13px] font-medium text-brand">✓ {t("stockPosted")}</span>
            {invoice.stock_entry_id && (
              <button type="button" onClick={() => router.push("/stock/entries")} className="text-[13px] text-ink-3 underline hover:text-brand">
                {t("viewStockEntry")}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={validate}
              disabled={busy || lines.length === 0}
              className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-5 py-2.5 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
            >
              {busy ? t("validating") : t("validate")}
            </button>
            <span className="text-[12px] text-ink-3">{t("validateHint")}</span>
          </>
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
              onChange={(e) => {
                const it = items.find((x) => x.id === e.target.value);
                setForm({ ...form, item_id: e.target.value, rate: form.rate || defaultRate(it) });
              }}
              className={field}
            >
              <option value="">—</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("quantity")}
              <input type="number" step="0.001" required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("unitPrice")}
              <input type="number" step="0.01" required value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className={field} />
            </label>
          </div>
          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.item_id || !form.qty} />
        </form>
      </Modal>
    </div>
  );
}
