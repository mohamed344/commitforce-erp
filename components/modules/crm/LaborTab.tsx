"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import Modal from "@/components/data/Modal";
import ListTable, { type Column } from "@/components/data/ListTable";
import RowActions from "@/components/data/RowActions";
import { type TabProps, field, labelCls, money } from "@/components/modules/crm/types";
import { toNum } from "@/lib/stockMatch";

type LaborLine = { id: string; line_no: number; description: string; days: number; daily_rate: number; amount: number };

export default function LaborTab({ projectId, project }: TabProps) {
  const t = useTranslations("project");
  const tu = useTranslations("ui");
  const supabase = createClient();

  const [lines, setLines] = useState<LaborLine[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<LaborLine | null>(null);
  const [form, setForm] = useState({ description: "", days: "", daily_rate: "" });

  async function load() {
    const { data } = await supabase.from("project_labor_lines").select("*").eq("project_id", projectId).order("line_no");
    setLines((data as LaborLine[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function openNew() {
    setEditing(null);
    setForm({ description: "", days: "", daily_rate: project.daily_rate != null ? String(project.daily_rate) : "" });
    setOpen(true);
  }
  function openEdit(l: LaborLine) {
    setEditing(l);
    setForm({ description: l.description, days: String(l.days ?? ""), daily_rate: String(l.daily_rate ?? "") });
    setOpen(true);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload = { description: form.description, days: toNum(form.days), daily_rate: toNum(form.daily_rate) };
    const res = editing
      ? await supabase.from("project_labor_lines").update(payload).eq("id", editing.id)
      : await supabase.from("project_labor_lines").insert({ ...payload, project_id: projectId, line_no: lines.length + 1, sort_order: lines.length + 1 });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    setOpen(false);
    load();
  }
  async function del(l: LaborLine) {
    await supabase.from("project_labor_lines").delete().eq("id", l.id);
    load();
  }

  const subtotal = lines.reduce((s, l) => s + Number(l.amount ?? 0), 0);

  const cols: Column<LaborLine>[] = [
    { header: t("description"), cell: (l) => <span className="font-medium text-ink">{l.description}</span> },
    { header: t("days"), className: "text-end", cell: (l) => <span className="tabular-nums">{l.days}</span> },
    { header: t("dailyRate"), className: "text-end", cell: (l) => <span className="tabular-nums">{money(l.daily_rate)}</span> },
    { header: t("amount"), className: "text-end", cell: (l) => <span className="tabular-nums font-semibold">{money(l.amount)}</span> },
    { header: "", cell: (l) => <RowActions onEdit={() => openEdit(l)} onDelete={() => del(l)} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{t("prestations")}</h2>
        <button type="button" onClick={openNew} className="ms-auto rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]">
          + {t("addLabor")}
        </button>
      </div>
      {err && <p className="text-[12px] text-red-600">{err}</p>}

      {lines.length === 0 ? (
        <p className="rounded-[12px] border border-line bg-white px-4 py-3 text-[13px] text-ink-3">{t("noLabor")}</p>
      ) : (
        <>
          <ListTable columns={cols} rows={lines} getKey={(l) => l.id} />
          <div className="flex justify-end gap-8 rounded-[12px] border border-line bg-white px-4 py-3">
            <span className="text-[13px] font-medium text-ink-3">{t("laborTotal")}</span>
            <span className="text-[15px] font-semibold tabular-nums text-ink">{money(subtotal)}{project.currency ? ` ${project.currency}` : ""}</span>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t("editLabor") : t("addLabor")}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("description")}
            <input required autoFocus value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("days")}
              <input type="number" step="0.01" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("dailyRate")}
              <input type="number" step="0.01" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} className={field} />
            </label>
          </div>
          <p className="text-[12px] text-ink-4">{t("amount")}: <span className="font-semibold tabular-nums">{money(toNum(form.days) * toNum(form.daily_rate))}</span></p>
          <div className="mt-1 flex items-center gap-2">
            <button type="submit" disabled={busy || !form.description.trim()} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60">
              {busy ? tu("creating") : tu("save")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-ink-2 hover:bg-line-2">
              {tu("cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
