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
  invoice_date: string;
  status: string;
  total_ttc: number;
  partner: { name: string } | null;
};
type Opt = { id: string; name: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function InvoiceListView({ kind }: { kind: InvoiceKind }) {
  const cfg = INVOICE_KINDS[kind];
  const t = useTranslations("sales");
  const router = useRouter();
  const supabase = createClient();
  const { byValue: statusBy } = useOptionSet("invoice_status");

  const [rows, setRows] = useState<Invoice[]>([]);
  const [partners, setPartners] = useState<Opt[]>([]);
  const [whs, setWhs] = useState<Opt[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const empty = { partner_id: "", warehouse_id: "", invoice_date: today, tax_rate: "19" };
  const [form, setForm] = useState(empty);

  async function load() {
    const [{ data: inv }, { data: p }, { data: w }] = await Promise.all([
      supabase
        .from(cfg.table)
        .select(`id,invoice_no,invoice_date,status,total_ttc, ${cfg.partnerSelect}`)
        .order("created_at", { ascending: false }),
      supabase.from(cfg.partnerTable).select("id,name").order("name"),
      supabase.from("warehouses").select("id,name").order("name"),
    ]);
    setRows((inv as unknown as Invoice[]) ?? []);
    setPartners((p as Opt[]) ?? []);
    setWhs((w as Opt[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function openNew() {
    setForm(empty);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from(cfg.table)
      .insert({
        [cfg.partnerCol]: form.partner_id,
        warehouse_id: form.warehouse_id || null,
        invoice_date: form.invoice_date,
        tax_rate: Number(form.tax_rate || 0),
      })
      .select("id")
      .single();
    setBusy(false);
    if (!error && data) {
      setOpen(false);
      router.push(cfg.detailHref((data as { id: string }).id));
    }
  }

  async function del(r: Invoice) {
    await supabase.from(cfg.table).delete().eq("id", r.id);
    load();
  }

  const money = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString());

  const cols: Column<Invoice>[] = [
    { header: t("invoiceNo"), cell: (r) => <span className="font-medium text-ink">{r.invoice_no ?? "—"}</span> },
    { header: t(cfg.partnerLabelKey), cell: (r) => r.partner?.name ?? "—" },
    { header: t("invoiceDate"), cell: (r) => r.invoice_date },
    { header: t("status"), cell: (r) => <Badge tone={statusBy.get(r.status)?.tone ?? "gray"}>{statusBy.get(r.status)?.label ?? r.status}</Badge> },
    { header: t("totalTTC"), className: "text-end", cell: (r) => <span className="tabular-nums font-medium">{money(r.total_ttc)}</span> },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]"
        >
          + {t(cfg.newTitleKey)}
        </button>
      </div>

      <ListTable
        columns={cols}
        rows={rows}
        getKey={(r) => r.id}
        onRowClick={(r) => router.push(cfg.detailHref(r.id))}
        actions={(r) => (
          <RowActions
            onView={() => router.push(cfg.detailHref(r.id))}
            onDelete={r.status === "draft" ? () => del(r) : undefined}
          />
        )}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t(cfg.newTitleKey)}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t(cfg.partnerLabelKey)}
            <select required value={form.partner_id} onChange={(e) => setForm({ ...form, partner_id: e.target.value })} className={field}>
              <option value="">—</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            {t(cfg.warehouseLabelKey)}
            <select value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} className={field}>
              <option value="">—</option>
              {whs.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("invoiceDate")}
              <input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("taxRate")}
              <input type="number" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} className={field} />
            </label>
          </div>
          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.partner_id} />
        </form>
      </Modal>
    </div>
  );
}
