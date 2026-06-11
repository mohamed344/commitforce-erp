"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import InlineCreateSelect, { type Opt } from "@/components/modules/stock/InlineCreateSelect";

// The CRM module is a PROJECT pipeline: each card is a project carrying the
// client (linked to the customers master), a project manager, budget, site and
// schedule, moving through the project_status stages (default 'nouveau').
type Project = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  client_name: string | null;
  customer_id: string | null;
  daily_rate: number | null;
  budget_amount: number | null;
  currency: string | null;
};
// A customer record we can link a project to (and autofill contact details from).
type Customer = { id: string; name: string; email: string | null; phone: string | null; address: string | null };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function CrmView() {
  const t = useTranslations("project");
  const tu = useTranslations("ui");
  const router = useRouter();
  const supabase = createClient();
  const { options: statusOptions, byValue: statusBy, defaultValue: defaultStatus } = useOptionSet("project_status");
  const { options: typeOptions, defaultValue: defaultType } = useOptionSet("project_type");
  const { options: priorityOptions, defaultValue: defaultPriority } = useOptionSet("project_priority");

  const [rows, setRows] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Opt[]>([]);
  const [companyCurrency, setCompanyCurrency] = useState("");
  const [view, setView] = useState<ViewMode>("board");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const empty = {
    name: "",
    code: "",
    project_type: defaultType,
    priority: defaultPriority,
    status: defaultStatus,
    customer_id: "",
    client_name: "",
    client_email: "",
    client_phone: "",
    client_address: "",
    site_address: "",
    start_date: "",
    end_date: "",
    deadline: "",
    project_manager_id: "",
    budget_amount: "",
    currency: companyCurrency,
    daily_rate: "",
    payment_terms: "",
    description: "",
  };
  const [form, setForm] = useState(empty);

  async function load() {
    const [{ data: projects }, { data: cust }, { data: emp }, { data: settings }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name,email,phone,address").order("name"),
      supabase.from("employees").select("id,full_name").eq("status", "active").order("full_name"),
      supabase.from("company_settings").select("default_currency").maybeSingle(),
    ]);
    setRows((projects as Project[]) ?? []);
    setCustomers((cust as Customer[]) ?? []);
    setEmployees(((emp as { id: string; full_name: string }[]) ?? []).map((e) => ({ id: e.id, name: e.full_name })));
    setCompanyCurrency((settings as { default_currency: string | null } | null)?.default_currency ?? "");
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setError(null);
    setStep(0);
    setForm(empty);
    setOpen(true);
  }
  function openProject(r: Project) {
    router.push(`/crm/${r.id}`);
  }

  // Picking a customer autofills the editable client snapshot fields.
  function onCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      customer_id: id,
      client_name: c?.name ?? f.client_name,
      client_email: c?.email ?? f.client_email,
      client_phone: c?.phone ?? f.client_phone,
      client_address: c?.address ?? f.client_address,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // The form spans a stepper; Enter / the primary button advances until the
    // last step, and only then inserts.
    if (step === 0 && !form.name.trim()) return;
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    setError(null);
    setBusy(true);
    const payload = {
      name: form.name,
      code: form.code || null,
      project_type: form.project_type || null,
      priority: form.priority || null,
      status: form.status,
      customer_id: form.customer_id || null,
      client_name: form.client_name || null,
      client_email: form.client_email || null,
      client_phone: form.client_phone || null,
      client_address: form.client_address || null,
      site_address: form.site_address || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      deadline: form.deadline || null,
      project_manager_id: form.project_manager_id || null,
      budget_amount: form.budget_amount ? Number(form.budget_amount) : null,
      currency: form.currency || null,
      daily_rate: form.daily_rate ? Number(form.daily_rate) : null,
      payment_terms: form.payment_terms || null,
      description: form.description || null,
    };
    const res = await supabase.from("projects").insert(payload);
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setOpen(false);
    setForm(empty);
    load();
  }

  async function del(r: Project) {
    await supabase.from("projects").delete().eq("id", r.id);
    load();
  }

  async function move(id: string, status: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    await supabase.from("projects").update({ status }).eq("id", id);
  }

  // Board columns are the configured pipeline stages, plus any leftover status
  // found on a project that isn't a configured stage — so a project can never
  // silently vanish from the board (e.g. rows still on a legacy status).
  const knownKeys = new Set(statusOptions.map((o) => o.value));
  const extraKeys = Array.from(new Set(rows.map((r) => r.status).filter((s) => s && !knownKeys.has(s))));
  const columns = [
    ...statusOptions.map((o) => ({ key: o.value, label: o.label })),
    ...extraKeys.map((k) => ({ key: k, label: statusBy.get(k)?.label ?? k })),
  ];

  const STEPS = [
    { key: "project", label: t("sections.project") },
    { key: "client", label: t("sections.client") },
    { key: "planning", label: t("sections.planning") },
    { key: "financial", label: t("sections.financial") },
  ];

  const money = (v: number | null) => (v == null ? "—" : v.toLocaleString());
  const listCols: Column<Project>[] = [
    { header: t("name"), cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { header: t("clientName"), cell: (r) => r.client_name ?? "—" },
    { header: t("budget"), cell: (r) => (r.budget_amount == null ? "—" : `${money(r.budget_amount)}${r.currency ? ` ${r.currency}` : ""}`) },
    { header: t("dailyRate"), cell: (r) => money(r.daily_rate) },
    { header: t("status"), cell: (r) => <Badge tone={statusBy.get(r.status)?.tone ?? "gray"}>{statusBy.get(r.status)?.label ?? r.status}</Badge> },
  ];

  return (
    <WorkspaceShell moduleKey="crm" view={view} onView={setView} onNew={openNew}>
      {view === "list" ? (
        <ListTable
          columns={listCols}
          rows={rows}
          getKey={(r) => r.id}
          onRowClick={openProject}
          actions={(r) => (
            <RowActions onView={() => openProject(r)} onEdit={() => openProject(r)} onDelete={() => del(r)} />
          )}
        />
      ) : (
        <KanbanBoard
          columns={columns}
          items={rows}
          getId={(r) => r.id}
          getColumn={(r) => r.status}
          onMove={move}
          renderCard={(r) => (
            <div onClick={() => openProject(r)}>
              <div className="text-[13px] font-semibold text-ink">{r.name}</div>
              {r.client_name && <div className="mt-0.5 text-[11px] text-ink-3">{r.client_name}</div>}
              {r.budget_amount != null && (
                <div className="mt-1 text-[12px] font-medium text-brand">{money(r.budget_amount)}{r.currency ? ` ${r.currency}` : ""}</div>
              )}
            </div>
          )}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t("newTitle")}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {/* Stepper header */}
          <div className="flex items-center">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex flex-1 items-center last:flex-none">
                <button
                  type="button"
                  onClick={() => { if (i === 0 || form.name.trim()) setStep(i); }}
                  className="flex items-center gap-2"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                      i === step ? "bg-brand text-white" : i < step ? "bg-brand-100 text-brand" : "bg-line-2 text-ink-3"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`hidden text-[12px] font-medium sm:inline ${i === step ? "text-ink" : "text-ink-3"}`}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className="mx-2 h-px flex-1 bg-line" />}
              </div>
            ))}
          </div>

          {/* Step 1 — Project */}
          {step === 0 && (
            <div className="flex flex-col gap-3">
              <label className={labelCls}>
                {t("name")}
                <input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  {t("type")}
                  <select value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} className={field}>
                    {typeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className={labelCls}>
                  {t("priority")}
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={field}>
                    {priorityOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
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
                  {t("code")}
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={field} />
                </label>
              </div>
            </div>
          )}

          {/* Step 2 — Client */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <InlineCreateSelect
                table="customers"
                label={t("customer")}
                value={form.customer_id}
                options={customers.map((c) => ({ id: c.id, name: c.name }))}
                onChange={onCustomer}
                onCreated={(o) => {
                  setCustomers((prev) => [...prev, { id: o.id, name: o.name, email: null, phone: null, address: null }]);
                  setForm((f) => ({ ...f, customer_id: o.id, client_name: o.name }));
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  {t("clientName")}
                  <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className={field} />
                </label>
                <label className={labelCls}>
                  {t("clientPhone")}
                  <input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} className={field} />
                </label>
                <label className={labelCls}>
                  {t("clientEmail")}
                  <input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className={field} />
                </label>
                <label className={labelCls}>
                  {t("clientAddress")}
                  <input value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} className={field} />
                </label>
              </div>
            </div>
          )}

          {/* Step 3 — Planning */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <label className={labelCls}>
                {t("manager")}
                <select value={form.project_manager_id} onChange={(e) => setForm({ ...form, project_manager_id: e.target.value })} className={field}>
                  <option value="">—</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </label>
              <label className={labelCls}>
                {t("siteAddress")}
                <input value={form.site_address} onChange={(e) => setForm({ ...form, site_address: e.target.value })} className={field} />
              </label>
              <label className={labelCls}>
                {t("startDate")}
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={field} />
              </label>
              <label className={labelCls}>
                {t("endDate")}
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={field} />
              </label>
              <label className={labelCls}>
                {t("deadline")}
                <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={field} />
              </label>
            </div>
          )}

          {/* Step 4 — Financial */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  {t("budget")}
                  <input type="number" step="0.01" value={form.budget_amount} onChange={(e) => setForm({ ...form, budget_amount: e.target.value })} className={field} />
                </label>
                <label className={labelCls}>
                  {t("currency")}
                  <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={field} />
                </label>
                <label className={labelCls}>
                  {t("dailyRate")}
                  <input type="number" step="0.01" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} className={field} />
                </label>
                <label className={labelCls}>
                  {t("paymentTerms")}
                  <input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className={field} />
                </label>
              </div>
              <label className={labelCls}>
                {t("description")}
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
              </label>
            </div>
          )}

          {error && <p className="text-[13px] text-red-600">{error}</p>}

          {/* Footer — Back / Cancel / Next|Create */}
          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-ink-2 hover:bg-line-2 disabled:opacity-40"
            >
              {tu("back")}
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-ink-2 hover:bg-line-2">
                {tu("cancel")}
              </button>
              <button
                type="submit"
                disabled={busy || (step === 0 && !form.name.trim())}
                className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
              >
                {step < STEPS.length - 1 ? tu("next") : busy ? tu("creating") : tu("create")}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </WorkspaceShell>
  );
}
