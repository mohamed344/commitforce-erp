"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import { useOptionSet } from "@/components/options/useOptionSet";
import InlineCreateSelect, { type Opt } from "@/components/modules/stock/InlineCreateSelect";
import type { Tone } from "@/lib/options";
import { type TabProps, field, labelCls, sectionCls, money } from "@/components/modules/crm/types";

type Customer = { id: string; name: string; email: string | null; phone: string | null; address: string | null };
type Activity = {
  id: string;
  activity_type: string;
  description: string | null;
  from_stage: string | null;
  to_stage: string | null;
  occurred_at: string;
  created_by: string | null;
  author: { full_name: string | null } | null;
};

const TYPE_TONE: Record<string, Tone> = {
  call: "blue",
  meeting: "violet",
  email: "amber",
  note: "gray",
  milestone: "violet",
  stage_change: "green",
  materials_imported: "blue",
};
const DOT_BG: Record<Tone, string> = {
  gray: "bg-gray-400",
  green: "bg-green-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
};
const MANUAL_TYPES = ["call", "meeting", "email", "note", "milestone"] as const;

/** A Date's local wall-clock as a value for <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-ink-4">{label}</span>
      <span className="text-[14px] text-ink">{children}</span>
    </div>
  );
}

export default function OverviewTab({ projectId, project, reload }: TabProps) {
  const t = useTranslations("project");
  const tu = useTranslations("ui");
  const supabase = createClient();
  const { options: statusOptions, byValue: statusBy } = useOptionSet("project_status");
  const { options: typeOptions, byValue: typeBy } = useOptionSet("project_type");
  const { options: priorityOptions, byValue: priorityBy } = useOptionSet("project_priority");

  const [activities, setActivities] = useState<Activity[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Opt[]>([]);

  // Edit-project modal
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", code: "", status: "", project_type: "", priority: "", customer_id: "",
    client_name: "", client_email: "", client_phone: "", client_address: "", site_address: "",
    project_manager_id: "", budget_amount: "", currency: "", daily_rate: "", payment_terms: "",
    start_date: "", end_date: "", deadline: "", description: "",
  });

  // Log-step modal
  const [stepOpen, setStepOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingStep, setEditingStep] = useState<Activity | null>(null);
  const [stepForm, setStepForm] = useState({ activity_type: "milestone", occurred_at: "", description: "" });

  async function loadAux() {
    const [{ data: acts }, { data: cust }, { data: emp }] = await Promise.all([
      supabase.from("project_activities").select("*, author:profiles(full_name)").eq("project_id", projectId).order("occurred_at", { ascending: false }),
      supabase.from("customers").select("id,name,email,phone,address").order("name"),
      supabase.from("employees").select("id,full_name").eq("status", "active").order("full_name"),
    ]);
    setActivities((acts as unknown as Activity[]) ?? []);
    setCustomers((cust as Customer[]) ?? []);
    setEmployees(((emp as { id: string; full_name: string }[]) ?? []).map((e) => ({ id: e.id, name: e.full_name })));
  }
  useEffect(() => {
    loadAux();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function openEdit() {
    setForm({
      name: project.name,
      code: project.code ?? "",
      status: project.status,
      project_type: project.project_type ?? "",
      priority: project.priority ?? "",
      customer_id: project.customer_id ?? "",
      client_name: project.client_name ?? "",
      client_email: project.client_email ?? "",
      client_phone: project.client_phone ?? "",
      client_address: project.client_address ?? "",
      site_address: project.site_address ?? "",
      project_manager_id: project.project_manager_id ?? "",
      budget_amount: project.budget_amount != null ? String(project.budget_amount) : "",
      currency: project.currency ?? "",
      daily_rate: project.daily_rate != null ? String(project.daily_rate) : "",
      payment_terms: project.payment_terms ?? "",
      start_date: project.start_date ?? "",
      end_date: project.end_date ?? "",
      deadline: project.deadline ?? "",
      description: project.description ?? "",
    });
    setError(null);
    setEditOpen(true);
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

  async function saveProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await supabase
      .from("projects")
      .update({
        name: form.name,
        code: form.code || null,
        status: form.status,
        project_type: form.project_type || null,
        priority: form.priority || null,
        customer_id: form.customer_id || null,
        client_name: form.client_name || null,
        client_email: form.client_email || null,
        client_phone: form.client_phone || null,
        client_address: form.client_address || null,
        site_address: form.site_address || null,
        project_manager_id: form.project_manager_id || null,
        budget_amount: form.budget_amount ? Number(form.budget_amount) : null,
        currency: form.currency || null,
        daily_rate: form.daily_rate ? Number(form.daily_rate) : null,
        payment_terms: form.payment_terms || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        deadline: form.deadline || null,
        description: form.description || null,
      })
      .eq("id", projectId);
    setSaving(false);
    if (res.error) return setError(res.error.message);
    setEditOpen(false);
    await reload(); // refresh header + summary; picks up an auto-logged stage_change if the status moved
    loadAux();
  }

  function openNewStep() {
    setEditingStep(null);
    setStepForm({ activity_type: "milestone", occurred_at: toLocalInput(new Date()), description: "" });
    setStepOpen(true);
  }
  function openEditStep(a: Activity) {
    setEditingStep(a);
    setStepForm({ activity_type: a.activity_type, occurred_at: toLocalInput(new Date(a.occurred_at)), description: a.description ?? "" });
    setStepOpen(true);
  }

  async function submitStep(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const occurredISO = stepForm.occurred_at ? new Date(stepForm.occurred_at).toISOString() : new Date().toISOString();
    const res = editingStep
      ? await supabase.from("project_activities").update({ activity_type: stepForm.activity_type, description: stepForm.description || null, occurred_at: occurredISO }).eq("id", editingStep.id)
      : await supabase.from("project_activities").insert({ project_id: projectId, activity_type: stepForm.activity_type, description: stepForm.description || null, occurred_at: occurredISO });
    setBusy(false);
    if (!res.error) {
      setStepOpen(false);
      loadAux();
    }
  }

  async function delStep(a: Activity) {
    await supabase.from("project_activities").delete().eq("id", a.id);
    loadAux();
  }

  const typeLabel = (key: string) => t(`activityTypes.${key}`);
  const when = (iso: string) => new Date(iso).toLocaleString();
  const managerName = employees.find((e) => e.id === project.project_manager_id)?.name ?? null;

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left — client + project summary */}
        <aside className="h-fit divide-y divide-line-2 overflow-hidden rounded-[14px] border border-line bg-white">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-ink-4">{t("type")}</span>
            <button type="button" onClick={openEdit} className="rounded-[8px] border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-2 transition-colors hover:border-brand-100 hover:text-brand">
              {tu("edit")}
            </button>
          </div>
          <div className="px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {project.project_type && <Badge tone={typeBy.get(project.project_type)?.tone ?? "gray"}>{typeBy.get(project.project_type)?.label ?? project.project_type}</Badge>}
              {project.priority && <Badge tone={priorityBy.get(project.priority)?.tone ?? "gray"}>{priorityBy.get(project.priority)?.label ?? project.priority}</Badge>}
              {!project.project_type && !project.priority && "—"}
            </div>
          </div>
          <SummaryRow label={t("clientName")}>{project.client_name ?? "—"}</SummaryRow>
          <SummaryRow label={t("clientEmail")}>
            {project.client_email ? <a href={`mailto:${project.client_email}`} className="text-brand hover:underline">{project.client_email}</a> : "—"}
          </SummaryRow>
          <SummaryRow label={t("clientPhone")}>
            {project.client_phone ? <a href={`tel:${project.client_phone}`} className="text-brand hover:underline">{project.client_phone}</a> : "—"}
          </SummaryRow>
          <SummaryRow label={t("clientAddress")}>{project.client_address ?? "—"}</SummaryRow>
          <SummaryRow label={t("manager")}>{managerName ?? "—"}</SummaryRow>
          <SummaryRow label={t("siteAddress")}>{project.site_address ?? "—"}</SummaryRow>
          <SummaryRow label={t("budget")}>
            <span className="font-semibold tabular-nums">{project.budget_amount == null ? "—" : `${money(project.budget_amount)}${project.currency ? ` ${project.currency}` : ""}`}</span>
          </SummaryRow>
          <SummaryRow label={t("dailyRate")}>
            <span className="font-semibold tabular-nums">{money(project.daily_rate)}</span>
          </SummaryRow>
          {project.payment_terms && <SummaryRow label={t("paymentTerms")}>{project.payment_terms}</SummaryRow>}
          {(project.start_date || project.end_date) && (
            <SummaryRow label={`${t("startDate")} → ${t("endDate")}`}>
              {(project.start_date ?? "…") + " → " + (project.end_date ?? "…")}
            </SummaryRow>
          )}
          {project.deadline && <SummaryRow label={t("deadline")}>{project.deadline}</SummaryRow>}
          {project.description && (
            <SummaryRow label={t("description")}>
              <span className="whitespace-pre-wrap text-[13.5px] text-ink-2">{project.description}</span>
            </SummaryRow>
          )}
        </aside>

        {/* Right — advancement timeline */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">{t("advancement")}</h2>
            <button type="button" onClick={openNewStep} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]">
              + {t("logStep")}
            </button>
          </div>

          {activities.length === 0 ? (
            <p className="rounded-[12px] border border-line bg-white px-4 py-3 text-[13px] text-ink-3">{t("noSteps")}</p>
          ) : (
            <ol className="relative ms-1.5 border-s border-line-2">
              {activities.map((a) => {
                const tone = TYPE_TONE[a.activity_type] ?? "gray";
                const isAuto = a.activity_type === "stage_change" || a.activity_type === "materials_imported";
                return (
                  <li key={a.id} className="relative ms-5 pb-5 last:pb-0">
                    <span className={`absolute -start-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${DOT_BG[tone]}`} />
                    <div className="rounded-[12px] border border-line bg-white px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Badge tone={tone}>{typeLabel(a.activity_type)}</Badge>
                            {a.activity_type === "stage_change" && (
                              <span className="flex items-center gap-1.5">
                                <Badge tone={statusBy.get(a.from_stage ?? "")?.tone ?? "gray"}>{statusBy.get(a.from_stage ?? "")?.label ?? a.from_stage}</Badge>
                                <span className="text-ink-4">→</span>
                                <Badge tone={statusBy.get(a.to_stage ?? "")?.tone ?? "gray"}>{statusBy.get(a.to_stage ?? "")?.label ?? a.to_stage}</Badge>
                              </span>
                            )}
                            <span className="text-[12px] text-ink-3">{when(a.occurred_at)}</span>
                            <span className="text-[12px] text-ink-4">· {t("byAgent")} {a.author?.full_name ?? "—"}</span>
                          </div>
                          {a.description && <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] text-ink-2">{a.description}</p>}
                        </div>
                        {!isAuto && <RowActions onEdit={() => openEditStep(a)} onDelete={() => delStep(a)} />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* Edit-project modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={tu("edit")}>
        <form onSubmit={saveProject} className="flex flex-col gap-3">
          <div className={sectionCls}>{t("sections.project")}</div>
          <label className={labelCls}>
            {t("name")}
            <input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("type")}
              <select value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} className={field}>
                {typeOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </label>
            <label className={labelCls}>
              {t("priority")}
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={field}>
                {priorityOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </label>
            <label className={labelCls}>
              {t("status")}
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={field}>
                {statusOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
            </label>
            <label className={labelCls}>
              {t("code")}
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={field} />
            </label>
          </div>

          <div className={sectionCls}>{t("sections.client")}</div>
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

          <div className={sectionCls}>{t("sections.planning")}</div>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("manager")}
              <select value={form.project_manager_id} onChange={(e) => setForm({ ...form, project_manager_id: e.target.value })} className={field}>
                <option value="">—</option>
                {employees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
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

          <div className={sectionCls}>{t("sections.financial")}</div>
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
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <div className="mt-1 flex items-center gap-2">
            <button type="submit" disabled={saving || !form.name.trim()} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60">
              {saving ? tu("creating") : tu("save")}
            </button>
            <button type="button" onClick={() => setEditOpen(false)} className="rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-ink-2 hover:bg-line-2">
              {tu("cancel")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Log-step modal */}
      <Modal open={stepOpen} onClose={() => setStepOpen(false)} title={editingStep ? tu("edit") : t("logStep")}>
        <form onSubmit={submitStep} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("stepType")}
              <select value={stepForm.activity_type} onChange={(e) => setStepForm({ ...stepForm, activity_type: e.target.value })} className={field}>
                {MANUAL_TYPES.map((k) => (<option key={k} value={k}>{typeLabel(k)}</option>))}
              </select>
            </label>
            <label className={labelCls}>
              {t("when")}
              <input type="datetime-local" value={stepForm.occurred_at} onChange={(e) => setStepForm({ ...stepForm, occurred_at: e.target.value })} className={field} />
            </label>
          </div>
          <label className={labelCls}>
            {t("description")}
            <textarea rows={4} autoFocus value={stepForm.description} onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })} className={field} />
          </label>
          <div className="mt-1 flex items-center gap-2">
            <button type="submit" disabled={busy || !stepForm.activity_type} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60">
              {busy ? tu("creating") : tu("create")}
            </button>
            <button type="button" onClick={() => setStepOpen(false)} className="rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-ink-2 hover:bg-line-2">
              {tu("cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
