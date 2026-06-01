"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import RowActions from "@/components/data/RowActions";
import { FormActions } from "@/components/modules/ProjectsView";
import { slugify } from "@/lib/options";

type Role = { id: string; key: string; label: string; description: string | null };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100 disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function RolesView({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("roles");
  const ts = useTranslations("settings");
  const supabase = createClient();

  const [rows, setRows] = useState<Role[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ label: "", description: "" });

  async function load() {
    const { data } = await supabase.from("company_roles").select("id,key,label,description").order("label");
    setRows((data as Role[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setForm({ label: "", description: "" });
    setOpen(true);
  }
  function openEdit(r: Role) {
    setEditing(r);
    setForm({ label: r.label, description: r.description ?? "" });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const label = form.label.trim();
    const payload = { label, description: form.description.trim() || null };
    const res = editing
      ? await supabase.from("company_roles").update(payload).eq("id", editing.id)
      : await supabase.from("company_roles").insert({ ...payload, key: slugify(label) || `role_${rows.length + 1}` });
    setBusy(false);
    if (!res.error) {
      setOpen(false);
      load();
    }
  }

  async function del(r: Role) {
    await supabase.from("company_roles").delete().eq("id", r.id);
    load();
  }

  const cols: Column<Role>[] = [
    { header: t("label"), cell: (r) => <span className="font-medium text-ink">{r.label}</span> },
    { header: t("key"), cell: (r) => <code className="text-[11px] text-ink-4">{r.key}</code> },
    { header: t("description"), cell: (r) => r.description ?? "—" },
  ];

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-ink">{t("title")}</h1>
          <p className="mt-1 text-[13px] text-ink-3">{t("desc")}</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openNew}
            className="shrink-0 rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]"
          >
            + {t("newRole")}
          </button>
        )}
      </div>

      {!isAdmin && (
        <p className="mb-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          {ts("adminOnly")}
        </p>
      )}

      <ListTable
        columns={cols}
        rows={rows}
        getKey={(r) => r.id}
        actions={isAdmin ? (r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => del(r)} /> : undefined}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? form.label : t("newRole")}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("label")}
            <input required autoFocus value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={field} />
          </label>
          <label className={labelCls}>
            {t("description")}
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
          </label>
          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.label.trim()} />
        </form>
      </Modal>
    </div>
  );
}
