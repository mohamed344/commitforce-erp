"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import { useOptionSet } from "@/components/options/useOptionSet";
import type { Tone } from "@/lib/options";

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
  stage_change: "green",
};
const DOT_BG: Record<Tone, string> = {
  gray: "bg-gray-400",
  green: "bg-green-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
};
const MANUAL_TYPES = ["call", "meeting", "email", "note"] as const;

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100 disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

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

export default function LeadDetailView({ leadId }: { leadId: string }) {
  const t = useTranslations("lead");
  const tu = useTranslations("ui");
  const router = useRouter();
  const supabase = createClient();
  const { options: stageOptions, byValue: stageBy } = useOptionSet("crm_stage");

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [form, setForm] = useState({ title: "", contact_name: "", email: "", phone: "", value: "", stage: "", notes: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Log-activity modal
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [actForm, setActForm] = useState({ activity_type: "call", occurred_at: "", description: "" });

  async function load() {
    const [{ data: l }, { data: acts }] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).single(),
      supabase
        .from("lead_activities")
        .select("*, author:profiles(full_name)")
        .eq("lead_id", leadId)
        .order("occurred_at", { ascending: false }),
    ]);
    setLead((l as Lead) ?? null);
    setActivities((acts as unknown as Activity[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  function openEditLead() {
    if (!lead) return;
    setForm({
      title: lead.title,
      contact_name: lead.contact_name ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      value: lead.value != null ? String(lead.value) : "",
      stage: lead.stage,
      notes: lead.notes ?? "",
    });
    setError(null);
    setEditOpen(true);
  }

  async function saveLead(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await supabase
      .from("leads")
      .update({
        title: form.title,
        contact_name: form.contact_name || null,
        email: form.email || null,
        phone: form.phone || null,
        value: form.value ? Number(form.value) : null,
        stage: form.stage,
        notes: form.notes || null,
      })
      .eq("id", leadId);
    setSaving(false);
    if (res.error) return setError(res.error.message);
    setEditOpen(false);
    load(); // refresh — picks up an auto-logged stage_change if the stage moved
  }

  function openNew() {
    setEditing(null);
    setActForm({ activity_type: "call", occurred_at: toLocalInput(new Date()), description: "" });
    setOpen(true);
  }
  function openEdit(a: Activity) {
    setEditing(a);
    setActForm({
      activity_type: a.activity_type,
      occurred_at: toLocalInput(new Date(a.occurred_at)),
      description: a.description ?? "",
    });
    setOpen(true);
  }

  async function submitActivity(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const occurredISO = actForm.occurred_at ? new Date(actForm.occurred_at).toISOString() : new Date().toISOString();
    const res = editing
      ? await supabase
          .from("lead_activities")
          .update({ activity_type: actForm.activity_type, description: actForm.description || null, occurred_at: occurredISO })
          .eq("id", editing.id)
      : await supabase
          .from("lead_activities")
          .insert({ lead_id: leadId, activity_type: actForm.activity_type, description: actForm.description || null, occurred_at: occurredISO });
    setBusy(false);
    if (!res.error) {
      setOpen(false);
      load();
    }
  }

  async function delActivity(a: Activity) {
    await supabase.from("lead_activities").delete().eq("id", a.id);
    load();
  }

  const typeLabel = (key: string) => t(`types.${key}`);
  const when = (iso: string) => new Date(iso).toLocaleString();
  const money = (v: number | null) => (v == null ? "—" : v.toLocaleString());

  if (!lead) return <div className="p-8 text-[14px] text-ink-3">{tu("loading")}</div>;

  return (
    <div className="mx-auto w-full max-w-[1100px] p-5 sm:p-8">
      <button type="button" onClick={() => router.push("/crm")} className="mb-4 text-[13px] text-ink-3 hover:text-brand">
        ← {tu("back")}
      </button>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold text-ink">{lead.title}</h1>
        <Badge tone={stageBy.get(lead.stage)?.tone ?? "gray"}>{stageBy.get(lead.stage)?.label ?? lead.stage}</Badge>
        <button
          type="button"
          onClick={openEditLead}
          className="ms-auto rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:border-brand-100 hover:text-brand"
        >
          {tu("edit")}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left — read-only lead summary */}
        <aside className="h-fit divide-y divide-line-2 overflow-hidden rounded-[14px] border border-line bg-white">
          <SummaryRow label={t("contactName")}>{lead.contact_name ?? "—"}</SummaryRow>
          <SummaryRow label={t("email")}>
            {lead.email ? <a href={`mailto:${lead.email}`} className="text-brand hover:underline">{lead.email}</a> : "—"}
          </SummaryRow>
          <SummaryRow label={t("phone")}>
            {lead.phone ? <a href={`tel:${lead.phone}`} className="text-brand hover:underline">{lead.phone}</a> : "—"}
          </SummaryRow>
          <SummaryRow label={t("value")}>
            <span className="font-semibold tabular-nums">{money(lead.value)}</span>
          </SummaryRow>
          <SummaryRow label={t("stage")}>
            <Badge tone={stageBy.get(lead.stage)?.tone ?? "gray"}>{stageBy.get(lead.stage)?.label ?? lead.stage}</Badge>
          </SummaryRow>
          <SummaryRow label={t("notes")}>
            <span className="whitespace-pre-wrap text-[13.5px] text-ink-2">{lead.notes || "—"}</span>
          </SummaryRow>
        </aside>

        {/* Right — activity timeline */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">{t("activities")}</h2>
            <button type="button" onClick={openNew} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]">
              + {t("logActivity")}
            </button>
          </div>

          {activities.length === 0 ? (
            <p className="rounded-[12px] border border-line bg-white px-4 py-3 text-[13px] text-ink-3">{t("noActivities")}</p>
          ) : (
            <ol className="relative ms-1.5 border-s border-line-2">
              {activities.map((a) => {
                const tone = TYPE_TONE[a.activity_type] ?? "gray";
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
                                <Badge tone={stageBy.get(a.from_stage ?? "")?.tone ?? "gray"}>{stageBy.get(a.from_stage ?? "")?.label ?? a.from_stage}</Badge>
                                <span className="text-ink-4">→</span>
                                <Badge tone={stageBy.get(a.to_stage ?? "")?.tone ?? "gray"}>{stageBy.get(a.to_stage ?? "")?.label ?? a.to_stage}</Badge>
                              </span>
                            )}
                            <span className="text-[12px] text-ink-3">{when(a.occurred_at)}</span>
                            <span className="text-[12px] text-ink-4">· {t("agent")} {a.author?.full_name ?? "—"}</span>
                          </div>
                          {a.description && <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] text-ink-2">{a.description}</p>}
                        </div>
                        {a.activity_type !== "stage_change" && (
                          <RowActions onEdit={() => openEdit(a)} onDelete={() => delActivity(a)} />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* Edit lead modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={tu("edit")}>
        <form onSubmit={saveLead} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("title")}
            <input required autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("contactName")}
              <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("stage")}
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className={field}>
                {stageOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t("email")}
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("phone")}
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("value")}
              <input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={field} />
            </label>
          </div>
          <label className={labelCls}>
            {t("notes")}
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={field} />
          </label>
          {error && <p className="text-[13px] text-red-600">{error}</p>}
          <div className="mt-1 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
            >
              {saving ? t("saving") : t("save")}
            </button>
            <button type="button" onClick={() => setEditOpen(false)} className="rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-ink-2 hover:bg-line-2">
              {tu("cancel")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Log-activity modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? tu("edit") : t("logActivity")}>
        <form onSubmit={submitActivity} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("activityType")}
              <select value={actForm.activity_type} onChange={(e) => setActForm({ ...actForm, activity_type: e.target.value })} className={field}>
                {MANUAL_TYPES.map((k) => (
                  <option key={k} value={k}>{typeLabel(k)}</option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t("when")}
              <input type="datetime-local" value={actForm.occurred_at} onChange={(e) => setActForm({ ...actForm, occurred_at: e.target.value })} className={field} />
            </label>
          </div>
          <label className={labelCls}>
            {t("description")}
            <textarea rows={4} autoFocus value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} className={field} />
          </label>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || !actForm.activity_type}
              className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
            >
              {busy ? tu("creating") : tu("create")}
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
