"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import WorkspaceShell from "@/components/data/WorkspaceShell";
import ListTable, { type Column } from "@/components/data/ListTable";
import KanbanBoard from "@/components/data/KanbanBoard";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import type { ViewMode } from "@/components/data/ViewSwitch";
import { useOptionSet } from "@/components/options/useOptionSet";
import { FormActions } from "./ProjectsView";

type Lead = {
  id: string;
  title: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  value: number | null;
  stage: string;
  notes: string | null;
};

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function CrmView() {
  const t = useTranslations();
  const tu = useTranslations("ui");
  const supabase = createClient();
  const { options: stageOptions, byValue: stageBy, defaultValue: defaultStage } =
    useOptionSet("crm_stage");
  const [rows, setRows] = useState<Lead[]>([]);
  const [view, setView] = useState<ViewMode>("board");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const empty = { title: "", contact_name: "", email: "", phone: "", value: "", stage: defaultStage, notes: "" };
  const [form, setForm] = useState(empty);

  async function load() {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setRows((data as Lead[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setReadOnly(false);
    setForm(empty);
    setOpen(true);
  }
  function openRow(r: Lead, ro: boolean) {
    setEditing(r);
    setReadOnly(ro);
    setForm({
      title: r.title,
      contact_name: r.contact_name ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      value: r.value != null ? String(r.value) : "",
      stage: r.stage,
      notes: r.notes ?? "",
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      title: form.title,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      value: form.value ? Number(form.value) : null,
      stage: form.stage,
      notes: form.notes || null,
    };
    const res = editing
      ? await supabase.from("leads").update(payload).eq("id", editing.id)
      : await supabase.from("leads").insert(payload);
    setBusy(false);
    if (!res.error) {
      setOpen(false);
      setForm(empty);
      load();
    }
  }

  async function del(r: Lead) {
    await supabase.from("leads").delete().eq("id", r.id);
    load();
  }

  async function move(id: string, stage: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, stage } : r)));
    await supabase.from("leads").update({ stage }).eq("id", id);
  }

  const columns = stageOptions.map((o) => ({ key: o.value, label: o.label }));
  const money = (v: number | null) => (v == null ? "—" : v.toLocaleString());
  const listCols: Column<Lead>[] = [
    { header: t("lead.title"), cell: (r) => <span className="font-medium text-ink">{r.title}</span> },
    { header: t("lead.contactName"), cell: (r) => r.contact_name ?? "—" },
    { header: t("lead.email"), cell: (r) => r.email ?? "—" },
    { header: t("lead.phone"), cell: (r) => r.phone ?? "—" },
    { header: t("lead.value"), cell: (r) => money(r.value) },
    { header: t("lead.stage"), cell: (r) => <Badge tone={stageBy.get(r.stage)?.tone ?? "gray"}>{stageBy.get(r.stage)?.label ?? r.stage}</Badge> },
  ];

  return (
    <WorkspaceShell moduleKey="crm" view={view} onView={setView} onNew={openNew}>
      {view === "list" ? (
        <ListTable
          columns={listCols}
          rows={rows}
          getKey={(r) => r.id}
          onRowClick={(r) => openRow(r, true)}
          actions={(r) => (
            <RowActions onView={() => openRow(r, true)} onEdit={() => openRow(r, false)} onDelete={() => del(r)} />
          )}
        />
      ) : (
        <KanbanBoard
          columns={columns}
          items={rows}
          getId={(r) => r.id}
          getColumn={(r) => r.stage}
          onMove={move}
          renderCard={(r) => (
            <div onClick={() => openRow(r, false)}>
              <div className="text-[13px] font-semibold text-ink">{r.title}</div>
              {r.contact_name && <div className="mt-0.5 text-[11px] text-ink-3">{r.contact_name}</div>}
              {r.value != null && <div className="mt-1 text-[12px] font-medium text-brand">{money(r.value)}</div>}
            </div>
          )}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? (readOnly ? form.title : tu("edit")) : t("lead.newTitle")}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("lead.title")}
            <input required disabled={readOnly} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("lead.contactName")}
              <input disabled={readOnly} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("lead.stage")}
              <select disabled={readOnly} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className={field}>
                {stageOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t("lead.email")}
              <input type="email" disabled={readOnly} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("lead.phone")}
              <input disabled={readOnly} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("lead.value")}
              <input type="number" step="0.01" disabled={readOnly} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={field} />
            </label>
          </div>
          <label className={labelCls}>
            {t("lead.notes")}
            <textarea rows={3} disabled={readOnly} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={field} />
          </label>
          {readOnly ? (
            <div className="mt-1 flex justify-end">
              <button type="button" onClick={() => setReadOnly(false)} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white hover:brightness-[1.03]">
                {tu("edit")}
              </button>
            </div>
          ) : (
            <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.title.trim()} />
          )}
        </form>
      </Modal>
    </WorkspaceShell>
  );
}
