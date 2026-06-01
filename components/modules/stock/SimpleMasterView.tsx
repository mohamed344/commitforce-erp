"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import RowActions from "@/components/data/RowActions";
import { FormActions } from "@/components/modules/ProjectsView";

export type MasterField = { name: string; label: string; required?: boolean };
type Row = { id: string; [key: string]: string | null };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";

export default function SimpleMasterView({
  table,
  fields,
  newLabel,
}: {
  table: string;
  fields: MasterField[];
  newLabel: string;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const blank = () => Object.fromEntries(fields.map((f) => [f.name, ""]));
  const [form, setForm] = useState<Record<string, string>>(blank());

  const selectCols = ["id", ...fields.map((f) => f.name)].join(",");
  async function load() {
    const { data } = await supabase.from(table).select(selectCols).order(fields[0].name);
    setRows((data as unknown as Row[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setForm(blank());
    setOpen(true);
  }
  function openEdit(r: Row) {
    setEditing(r);
    setForm(Object.fromEntries(fields.map((f) => [f.name, r[f.name] ?? ""])));
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = Object.fromEntries(fields.map((f) => [f.name, form[f.name]?.trim() || null]));
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

  const cols: Column<Row>[] = fields.map(
    (f): Column<Row> => ({
      header: f.label,
      cell: (r) =>
        f.name === fields[0].name ? (
          <span className="font-medium text-ink">{r[f.name] ?? "—"}</span>
        ) : (
          (r[f.name] ?? "—")
        ),
    }),
  );

  const invalid = fields.some((f) => f.required && !form[f.name]?.trim());

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
        columns={cols}
        rows={rows}
        getKey={(r) => r.id}
        onRowClick={openEdit}
        actions={(r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => del(r)} />}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={newLabel}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {fields.map((f) => (
            <label key={f.name} className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
              {f.label}
              <input
                required={f.required}
                value={form[f.name] ?? ""}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                className={field}
              />
            </label>
          ))}
          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={invalid} />
        </form>
      </Modal>
    </div>
  );
}
