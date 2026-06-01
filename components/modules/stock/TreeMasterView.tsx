"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import { FormActions } from "@/components/modules/ProjectsView";

type Row = {
  id: string;
  name: string;
  parent_id: string | null;
  is_group?: boolean | null;
  description?: string | null;
};

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function TreeMasterView({
  table,
  newLabel,
  hasIsGroup = false,
  hasDescription = false,
}: {
  table: string;
  newLabel: string;
  hasIsGroup?: boolean;
  hasDescription?: boolean;
}) {
  const t = useTranslations("stock");
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const blank = { name: "", parent_id: "", is_group: false, description: "" };
  const [form, setForm] = useState(blank);

  const cols = ["id", "name", "parent_id", hasIsGroup ? "is_group" : "", hasDescription ? "description" : ""]
    .filter(Boolean)
    .join(",");
  async function load() {
    const { data } = await supabase.from(table).select(cols).order("name");
    setRows((data as unknown as Row[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setForm(blank);
    setOpen(true);
  }
  function openEdit(r: Row) {
    setEditing(r);
    setForm({
      name: r.name,
      parent_id: r.parent_id ?? "",
      is_group: !!r.is_group,
      description: r.description ?? "",
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      parent_id: form.parent_id || null,
    };
    if (hasIsGroup) payload.is_group = form.is_group;
    if (hasDescription) payload.description = form.description.trim() || null;
    const res = editing
      ? await supabase.from(table).update(payload).eq("id", editing.id)
      : await supabase.from(table).insert(payload);
    setBusy(false);
    if (!res.error) {
      setOpen(false);
      load();
    }
  }

  async function del(r: Row) {
    await supabase.from(table).delete().eq("id", r.id);
    load();
  }

  const nameOf = (id: string | null) => rows.find((r) => r.id === id)?.name ?? "—";
  const listCols: Column<Row>[] = [
    { header: t("name"), cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { header: t("parent"), cell: (r) => nameOf(r.parent_id) },
    ...(hasIsGroup
      ? [{ header: t("isGroup"), cell: (r: Row) => (r.is_group ? <Badge tone="blue">✓</Badge> : "—") }]
      : []),
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]"
        >
          + {newLabel}
        </button>
      </div>

      <ListTable
        columns={listCols}
        rows={rows}
        getKey={(r) => r.id}
        onRowClick={openEdit}
        actions={(r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => del(r)} />}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={newLabel}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("name")}
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          </label>
          <label className={labelCls}>
            {t("parent")}
            <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} className={field}>
              <option value="">{t("none")}</option>
              {rows
                .filter((r) => r.id !== editing?.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </label>
          {hasDescription && (
            <label className={labelCls}>
              {t("notes")}
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
            </label>
          )}
          {hasIsGroup && (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={form.is_group} onChange={(e) => setForm({ ...form, is_group: e.target.checked })} />
              {t("isGroup")}
            </label>
          )}
          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.name.trim()} />
        </form>
      </Modal>
    </div>
  );
}
