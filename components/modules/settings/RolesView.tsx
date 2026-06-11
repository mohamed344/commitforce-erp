"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import RowActions from "@/components/data/RowActions";
import { FormActions } from "@/components/modules/ProjectsView";
import { slugify } from "@/lib/options";
import { moduleCatalog } from "@/config/modules";

type Role = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  permissions: string[];
};

const ACTIONS = ["view", "create", "edit", "delete"] as const;
const permKey = (moduleKey: string, action: string) => `${moduleKey}:${action}`;
const ALL_PERMS = moduleCatalog.flatMap((m) => ACTIONS.map((a) => permKey(m.key, a)));

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100 disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function RolesView({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("roles");
  const ts = useTranslations("settings");
  const tm = useTranslations("modules");
  const supabase = createClient();

  const [rows, setRows] = useState<Role[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<{ label: string; description: string; permissions: string[] }>({
    label: "",
    description: "",
    permissions: [],
  });

  async function load() {
    const { data } = await supabase.from("company_roles").select("id,key,label,description,permissions").order("label");
    setRows((data as Role[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setForm({ label: "", description: "", permissions: [] });
    setOpen(true);
  }
  function openEdit(r: Role) {
    setEditing(r);
    setForm({ label: r.label, description: r.description ?? "", permissions: r.permissions ?? [] });
    setOpen(true);
  }

  function togglePerm(key: string) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
  }
  function toggleModule(moduleKey: string, on: boolean) {
    const keys = ACTIONS.map((a) => permKey(moduleKey, a));
    setForm((f) => ({
      ...f,
      permissions: on
        ? Array.from(new Set([...f.permissions, ...keys]))
        : f.permissions.filter((p) => !keys.includes(p)),
    }));
  }
  function toggleAll(on: boolean) {
    setForm((f) => ({ ...f, permissions: on ? [...ALL_PERMS] : [] }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const label = form.label.trim();
    const payload = { label, description: form.description.trim() || null, permissions: form.permissions };
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
    {
      header: t("permissions"),
      cell: (r) => (
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
          {r.permissions?.length ?? 0}
        </span>
      ),
    },
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

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-ink-2">{t("permissions")}</span>
              <button
                type="button"
                onClick={() => toggleAll(form.permissions.length < ALL_PERMS.length)}
                className="text-[12px] font-medium text-brand hover:text-brand-700"
              >
                {form.permissions.length < ALL_PERMS.length ? t("selectAll") : t("clearAll")}
              </button>
            </div>
            <div className="overflow-hidden rounded-[10px] border border-line">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-[#f6f6f8] text-ink-3">
                    <th className="px-3 py-2 text-start font-medium">{t("module")}</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="px-2 py-2 text-center font-medium">{t(`actions.${a}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {moduleCatalog.map((m) => {
                    const moduleKeys = ACTIONS.map((a) => permKey(m.key, a));
                    const allOn = moduleKeys.every((k) => form.permissions.includes(k));
                    return (
                      <tr key={m.key} className="border-b border-line last:border-0">
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleModule(m.key, !allOn)}
                            className="font-medium text-ink hover:text-brand"
                          >
                            {tm(m.key)}
                          </button>
                        </td>
                        {ACTIONS.map((a) => {
                          const key = permKey(m.key, a);
                          return (
                            <td key={a} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(key)}
                                onChange={() => togglePerm(key)}
                                className="h-4 w-4 accent-brand"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.label.trim()} />
        </form>
      </Modal>
    </div>
  );
}
