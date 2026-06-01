"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import WorkspaceShell from "@/components/data/WorkspaceShell";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import { useOptionSet } from "@/components/options/useOptionSet";

type Project = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function ProjectsView() {
  const t = useTranslations();
  const tu = useTranslations("ui");
  const router = useRouter();
  const supabase = createClient();
  const { options: statusOptions, byValue: statusBy, defaultValue: defaultStatus } =
    useOptionSet("project_status");
  const [rows, setRows] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const empty = { name: "", code: "", status: defaultStatus, start_date: "", end_date: "", description: "" };
  const [form, setForm] = useState(empty);

  async function load() {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as Project[]) ?? []);
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
  function openRow(r: Project, ro: boolean) {
    setEditing(r);
    setReadOnly(ro);
    setForm({
      name: r.name,
      code: r.code ?? "",
      status: r.status,
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? "",
      description: r.description ?? "",
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name: form.name,
      code: form.code || null,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      description: form.description || null,
    };
    const res = editing
      ? await supabase.from("projects").update(payload).eq("id", editing.id)
      : await supabase.from("projects").insert(payload);
    setBusy(false);
    if (!res.error) {
      setOpen(false);
      setForm(empty);
      load();
    }
  }

  async function del(r: Project) {
    await supabase.from("projects").delete().eq("id", r.id);
    load();
  }

  const listCols: Column<Project>[] = [
    { header: t("project.name"), cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { header: t("project.code"), cell: (r) => r.code ?? "—" },
    { header: t("project.status"), cell: (r) => <Badge tone={statusBy.get(r.status)?.tone ?? "gray"}>{statusBy.get(r.status)?.label ?? r.status}</Badge> },
    { header: t("project.startDate"), cell: (r) => r.start_date ?? "—" },
    { header: t("project.endDate"), cell: (r) => r.end_date ?? "—" },
  ];

  return (
    <WorkspaceShell moduleKey="projects" onNew={openNew}>
      <ListTable
        columns={listCols}
        rows={rows}
        getKey={(r) => r.id}
        onRowClick={(r) => router.push(`/projects/${r.id}`)}
        actions={(r) => (
          <RowActions onView={() => router.push(`/projects/${r.id}`)} onEdit={() => openRow(r, false)} onDelete={() => del(r)} />
        )}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? (readOnly ? form.name : tu("edit")) : t("project.newTitle")}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("project.name")}
            <input required disabled={readOnly} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("project.code")}
              <input disabled={readOnly} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("project.status")}
              <select disabled={readOnly} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={field}>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t("project.startDate")}
              <input type="date" disabled={readOnly} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("project.endDate")}
              <input type="date" disabled={readOnly} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={field} />
            </label>
          </div>
          <label className={labelCls}>
            {t("project.description")}
            <textarea rows={3} disabled={readOnly} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
          </label>
          {readOnly ? (
            <div className="mt-1 flex justify-end">
              <button type="button" onClick={() => setReadOnly(false)} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white hover:brightness-[1.03]">
                {tu("edit")}
              </button>
            </div>
          ) : (
            <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.name.trim()} />
          )}
        </form>
      </Modal>
    </WorkspaceShell>
  );
}

export function FormActions({
  busy,
  onCancel,
  disabled,
}: {
  busy: boolean;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("ui");
  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        type="submit"
        disabled={busy || disabled}
        className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
      >
        {busy ? t("creating") : t("create")}
      </button>
      <button type="button" onClick={onCancel} className="rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-ink-2 hover:bg-line-2">
        {t("cancel")}
      </button>
    </div>
  );
}
