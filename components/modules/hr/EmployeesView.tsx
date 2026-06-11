"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import WorkspaceShell from "@/components/data/WorkspaceShell";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import { useOptionSet } from "@/components/options/useOptionSet";
import { FormActions } from "@/components/modules/ProjectsView";
import { slugify } from "@/lib/options";

type Employee = {
  id: string;
  full_name: string;
  position: string | null;
  department: string | null;
  hire_date: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  user_id: string | null;
  company_role_id: string | null;
  notes: string | null;
};
type Profile = { id: string; full_name: string | null };
type Role = { id: string; label: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function EmployeesView() {
  const t = useTranslations("hr");
  const supabase = createClient();
  const { options: statusOptions, byValue: statusBy, defaultValue: defaultStatus } = useOptionSet("employee_status");

  const [rows, setRows] = useState<Employee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleErr, setRoleErr] = useState<string | null>(null);
  const empty = {
    full_name: "",
    position: "",
    department: "",
    hire_date: "",
    phone: "",
    email: "",
    status: defaultStatus,
    user_id: "",
    company_role_id: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  async function load() {
    const [{ data: e }, { data: p }, { data: r }] = await Promise.all([
      supabase.from("employees").select("*").order("full_name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase.from("company_roles").select("id,label").order("label"),
    ]);
    setRows((e as Employee[]) ?? []);
    setProfiles((p as Profile[]) ?? []);
    setRoles((r as Role[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetRoleCreator() {
    setCreatingRole(false);
    setNewRoleName("");
    setRoleErr(null);
  }

  function openNew() {
    setEditing(null);
    setForm({ ...empty, status: defaultStatus });
    resetRoleCreator();
    setOpen(true);
  }
  function openEdit(r: Employee) {
    setEditing(r);
    resetRoleCreator();
    setForm({
      full_name: r.full_name,
      position: r.position ?? "",
      department: r.department ?? "",
      hire_date: r.hire_date ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      status: r.status,
      user_id: r.user_id ?? "",
      company_role_id: r.company_role_id ?? "",
      notes: r.notes ?? "",
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      full_name: form.full_name,
      position: form.position || null,
      department: form.department || null,
      hire_date: form.hire_date || null,
      phone: form.phone || null,
      email: form.email || null,
      status: form.status,
      user_id: form.user_id || null,
      company_role_id: form.company_role_id || null,
      notes: form.notes || null,
    };
    const res = editing
      ? await supabase.from("employees").update(payload).eq("id", editing.id)
      : await supabase.from("employees").insert(payload);
    setBusy(false);
    if (!res.error) {
      setOpen(false);
      load();
    }
  }

  async function createRole() {
    const label = newRoleName.trim();
    if (!label) return;
    setRoleBusy(true);
    setRoleErr(null);
    const { data, error } = await supabase
      .from("company_roles")
      .insert({ label, key: slugify(label) || `role_${roles.length + 1}` })
      .select("id,label")
      .single();
    setRoleBusy(false);
    if (error || !data) {
      setRoleErr(error?.message ?? "Failed to create role");
      return;
    }
    const created = data as Role;
    setRoles((rs) => [...rs, created].sort((a, b) => a.label.localeCompare(b.label)));
    setForm((f) => ({ ...f, company_role_id: created.id }));
    resetRoleCreator();
  }

  async function del(r: Employee) {
    await supabase.from("employees").delete().eq("id", r.id);
    load();
  }

  const roleLabel = (id: string | null) => roles.find((r) => r.id === id)?.label ?? "—";

  const cols: Column<Employee>[] = [
    { header: t("fullName"), cell: (r) => <span className="font-medium text-ink">{r.full_name}</span> },
    { header: t("position"), cell: (r) => r.position ?? "—" },
    { header: t("department"), cell: (r) => r.department ?? "—" },
    { header: t("role"), cell: (r) => roleLabel(r.company_role_id) },
    { header: t("hireDate"), cell: (r) => r.hire_date ?? "—" },
    { header: t("status"), cell: (r) => <Badge tone={statusBy.get(r.status)?.tone ?? "gray"}>{statusBy.get(r.status)?.label ?? r.status}</Badge> },
  ];

  return (
    <WorkspaceShell moduleKey="hr" onNew={openNew}>
      <ListTable
        columns={cols}
        rows={rows}
        getKey={(r) => r.id}
        actions={(r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => del(r)} />}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? form.full_name : t("newEmployee")}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("fullName")}
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("position")}
              <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("department")}
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("hireDate")}
              <input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("status")}
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={field}>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t("phone")}
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("email")}
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            </label>
            <div className={labelCls}>
              <span>{t("role")}</span>
              <select
                value={creatingRole ? "__new__" : form.company_role_id}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setCreatingRole(true);
                    setRoleErr(null);
                  } else {
                    setCreatingRole(false);
                    setForm({ ...form, company_role_id: e.target.value });
                  }
                }}
                className={field}
              >
                <option value="">{t("noRole")}</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
                <option value="__new__">+ {t("createRole")}</option>
              </select>
              {creatingRole && (
                <>
                  <div className="mt-1 flex gap-1.5">
                    <input
                      autoFocus
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createRole();
                        }
                      }}
                      placeholder={t("roleName")}
                      className={`${field} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={createRole}
                      disabled={roleBusy || !newRoleName.trim()}
                      className="shrink-0 rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
                    >
                      {t("add")}
                    </button>
                  </div>
                  {roleErr && <p className="text-[12px] text-red-600">{roleErr}</p>}
                </>
              )}
            </div>
            <label className={labelCls}>
              {t("userAccount")}
              <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} className={field}>
                <option value="">{t("noUser")}</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0, 8)}</option>
                ))}
              </select>
            </label>
          </div>
          <label className={labelCls}>
            {t("notes")}
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={field} />
          </label>
          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.full_name.trim()} />
        </form>
      </Modal>
    </WorkspaceShell>
  );
}
