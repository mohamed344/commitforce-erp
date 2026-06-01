"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import { useOptionSet } from "@/components/options/useOptionSet";
import { FormActions } from "@/components/modules/ProjectsView";

type Entry = { id: string; entry_type: string; posting_date: string; reference: string | null };
type Opt = { id: string; name: string };
type Line = { item_id: string; qty: string; rate: string; source_warehouse_id: string; target_warehouse_id: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function StockEntriesView() {
  const t = useTranslations("stock");
  const tu = useTranslations("ui");
  const supabase = createClient();
  const { options: typeOptions, byValue: typeBy } = useOptionSet("stock_entry_type");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [items, setItems] = useState<Opt[]>([]);
  const [whs, setWhs] = useState<Opt[]>([]);
  const [projects, setProjects] = useState<Opt[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const emptyLine: Line = { item_id: "", qty: "", rate: "", source_warehouse_id: "", target_warehouse_id: "" };
  const [header, setHeader] = useState({ entry_type: "receipt", posting_date: new Date().toISOString().slice(0, 10), project_id: "", reference: "", notes: "" });
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);

  async function load() {
    const [{ data: e }, { data: it }, { data: w }, { data: p }] = await Promise.all([
      supabase.from("stock_entries").select("id,entry_type,posting_date,reference").order("posting_date", { ascending: false }),
      supabase.from("items").select("id,name").order("name"),
      supabase.from("warehouses").select("id,name").order("name"),
      supabase.from("projects").select("id,name").order("name"),
    ]);
    setEntries((e as Entry[]) ?? []);
    setItems((it as Opt[]) ?? []);
    setWhs((w as Opt[]) ?? []);
    setProjects((p as Opt[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setHeader({ entry_type: "receipt", posting_date: new Date().toISOString().slice(0, 10), project_id: "", reference: "", notes: "" });
    setLines([{ ...emptyLine }]);
    setOpen(true);
  }

  const showSource = header.entry_type === "issue" || header.entry_type === "transfer";
  const showTarget = header.entry_type === "receipt" || header.entry_type === "transfer" || header.entry_type === "adjustment";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("stock_entries")
      .insert({
        entry_type: header.entry_type,
        posting_date: header.posting_date,
        project_id: header.project_id || null,
        reference: header.reference.trim() || null,
        notes: header.notes.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      return;
    }
    const entryId = (data as { id: string }).id;
    const rows = lines
      .filter((l) => l.item_id && Number(l.qty) > 0)
      .map((l) => ({
        stock_entry_id: entryId,
        item_id: l.item_id,
        qty: Number(l.qty),
        rate: l.rate ? Number(l.rate) : null,
        source_warehouse_id: showSource ? l.source_warehouse_id || null : null,
        target_warehouse_id: showTarget ? l.target_warehouse_id || null : null,
      }));
    if (rows.length) await supabase.from("stock_entry_lines").insert(rows);
    setBusy(false);
    setOpen(false);
    load();
  }

  async function del(r: Entry) {
    await supabase.from("stock_entries").delete().eq("id", r.id);
    load();
  }

  const cols: Column<Entry>[] = [
    { header: t("entryType"), cell: (r) => <Badge tone={typeBy.get(r.entry_type)?.tone ?? "gray"}>{typeBy.get(r.entry_type)?.label ?? r.entry_type}</Badge> },
    { header: t("postingDate"), cell: (r) => r.posting_date },
    { header: t("reference"), cell: (r) => r.reference ?? "—" },
  ];

  const validLines = lines.some((l) => l.item_id && Number(l.qty) > 0);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={openNew} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]">
          + {tu("new")}
        </button>
      </div>

      <ListTable columns={cols} rows={entries} getKey={(r) => r.id} actions={(r) => <RowActions onDelete={() => del(r)} />} />

      <Modal open={open} onClose={() => setOpen(false)} title={tu("new")}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("entryType")}
              <select value={header.entry_type} onChange={(e) => setHeader({ ...header, entry_type: e.target.value })} className={field}>
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t("postingDate")}
              <input type="date" value={header.posting_date} onChange={(e) => setHeader({ ...header, posting_date: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("project")}
              <select value={header.project_id} onChange={(e) => setHeader({ ...header, project_id: e.target.value })} className={field}>
                <option value="">—</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className={labelCls}>
              {t("reference")}
              <input value={header.reference} onChange={(e) => setHeader({ ...header, reference: e.target.value })} className={field} />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-medium text-ink-2">{t("lines")}</span>
            {lines.map((l, i) => (
              <div key={i} className="rounded-[10px] border border-line-2 p-2">
                <div className="flex flex-wrap items-end gap-2">
                  <select value={l.item_id} onChange={(e) => setLines((p) => p.map((x, idx) => (idx === i ? { ...x, item_id: e.target.value } : x)))} className={`${field} min-w-[140px] flex-1`}>
                    <option value="">{t("item")}</option>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                  </select>
                  <input type="number" step="0.001" placeholder={t("qty")} value={l.qty} onChange={(e) => setLines((p) => p.map((x, idx) => (idx === i ? { ...x, qty: e.target.value } : x)))} className={`${field} w-24`} />
                  <input type="number" step="0.01" placeholder={t("rate")} value={l.rate} onChange={(e) => setLines((p) => p.map((x, idx) => (idx === i ? { ...x, rate: e.target.value } : x)))} className={`${field} w-24`} />
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="rounded-[10px] border border-line px-2.5 py-2 text-[13px] text-ink-3 hover:text-red-600">✕</button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {showSource && (
                    <select value={l.source_warehouse_id} onChange={(e) => setLines((p) => p.map((x, idx) => (idx === i ? { ...x, source_warehouse_id: e.target.value } : x)))} className={`${field} flex-1`}>
                      <option value="">{t("sourceWh")}</option>
                      {whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  )}
                  {showTarget && (
                    <select value={l.target_warehouse_id} onChange={(e) => setLines((p) => p.map((x, idx) => (idx === i ? { ...x, target_warehouse_id: e.target.value } : x)))} className={`${field} flex-1`}>
                      <option value="">{t("targetWh")}</option>
                      {whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setLines((p) => [...p, { ...emptyLine }])} className="w-fit rounded-[10px] border border-line px-3 py-1.5 text-[13px] font-medium text-brand hover:bg-line-2">
              + {t("addLine")}
            </button>
          </div>

          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!validLines} />
        </form>
      </Modal>
    </div>
  );
}
