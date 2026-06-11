"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { type TabProps, field, labelCls, money } from "@/components/modules/crm/types";
import { toNum } from "@/lib/stockMatch";

type MaterialLine = { qty: number; unit_rate: number | null };
type LaborLine = { id: string; description: string; days: number; daily_rate: number; amount: number };
type Estimate = {
  id: string;
  estimate_no: string | null;
  materials_total: number;
  labor_total: number;
  margin_pct: number;
  margin_amount: number;
  transport_amount: number;
  grand_total: number;
  currency: string | null;
  created_at: string;
};

export default function EstimateTab({ projectId, project, reload }: TabProps) {
  const t = useTranslations("project");
  const tu = useTranslations("ui");
  const router = useRouter();
  const supabase = createClient();

  const [materials, setMaterials] = useState<MaterialLine[]>([]);
  const [labor, setLabor] = useState<LaborLine[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [marginPct, setMarginPct] = useState(String(project.margin_pct ?? 0));
  const [transport, setTransport] = useState(String(project.transport_amount ?? 0));
  const [offerRef, setOfferRef] = useState(project.offer_ref ?? "");
  const [offerValidity, setOfferValidity] = useState(project.offer_validity ?? "");
  const [offerNotes, setOfferNotes] = useState(project.offer_notes ?? "");
  const [savingFooter, setSavingFooter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const [{ data: mats }, { data: lab }, { data: est }] = await Promise.all([
      supabase.from("project_material_lines").select("qty,unit_rate").eq("project_id", projectId),
      supabase.from("project_labor_lines").select("id,description,days,daily_rate,amount").eq("project_id", projectId).order("line_no"),
      supabase.from("project_estimates").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    setMaterials((mats as MaterialLine[]) ?? []);
    setLabor((lab as LaborLine[]) ?? []);
    setEstimates((est as Estimate[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Right branch — materials: prix d'achat → marge → prix de vente.
  const materialsBuying = materials.reduce((s, m) => s + (m.unit_rate != null ? m.qty * m.unit_rate : 0), 0);
  const marginAmount = Math.round(((materialsBuying * toNum(marginPct)) / 100) * 100) / 100;
  const materialsSelling = materialsBuying + marginAmount;
  // Left branch — prestations (labor).
  const laborTotal = labor.reduce((s, l) => s + Number(l.amount ?? 0), 0);
  const transportAmount = toNum(transport);
  const grandTotal = materialsSelling + laborTotal + transportAmount;
  const cur = project.currency ? ` ${project.currency}` : "";

  const footerPayload = () => ({
    margin_pct: toNum(marginPct),
    transport_amount: transportAmount,
    offer_ref: offerRef || null,
    offer_validity: offerValidity || null,
    offer_notes: offerNotes || null,
  });

  async function saveFooter() {
    setSavingFooter(true);
    setErr(null);
    const res = await supabase.from("projects").update(footerPayload()).eq("id", projectId);
    setSavingFooter(false);
    if (res.error) return setErr(res.error.message);
    reload();
  }

  async function saveEstimate() {
    setSaving(true);
    setErr(null);
    await supabase.from("projects").update(footerPayload()).eq("id", projectId);
    const snapshot = {
      offer: { ref: offerRef, validity: offerValidity, notes: offerNotes },
      labor,
      computed: { materialsBuying, marginAmount, materialsSelling, laborTotal, transportAmount, grandTotal },
    };
    const res = await supabase.from("project_estimates").insert({
      project_id: projectId,
      estimate_no: offerRef || `${(project.code || project.name || "OFF").slice(0, 12)}-${estimates.length + 1}`,
      materials_total: materialsBuying,
      labor_total: laborTotal,
      margin_pct: toNum(marginPct),
      margin_amount: marginAmount,
      transport_amount: transportAmount,
      grand_total: grandTotal,
      currency: project.currency,
      snapshot,
    });
    setSaving(false);
    if (res.error) return setErr(res.error.message);
    load();
  }

  const when = (iso: string) => new Date(iso).toLocaleString();
  const Row = ({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "buy" | "sell" }) => (
    <div className={`flex items-center justify-between px-4 py-2.5 ${strong ? "bg-[#f6f6f8]" : ""}`}>
      <span className={`text-[13px] ${strong ? "font-semibold text-ink" : "text-ink-3"}`}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-[16px] font-semibold" : "text-[14px]"} ${tone === "sell" ? "text-green-700" : tone === "buy" ? "text-ink-2" : "text-ink"}`}>{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[15px] font-semibold text-ink">{t("estimate")}</h2>
      {err && <p className="text-[12px] text-red-600">{err}</p>}

      {/* Offer header fields */}
      <div className="grid gap-3 rounded-[14px] border border-line bg-white p-4 sm:grid-cols-3">
        <label className={labelCls}>
          {t("offerRef")}
          <input value={offerRef} onChange={(e) => setOfferRef(e.target.value)} className={field} placeholder={t("offerRefPlaceholder")} />
        </label>
        <label className={labelCls}>
          {t("offerValidity")}
          <input value={offerValidity} onChange={(e) => setOfferValidity(e.target.value)} className={field} placeholder={t("offerValidityPlaceholder")} />
        </label>
        <label className={`${labelCls} sm:col-span-1`}>
          {t("offerNotes")}
          <input value={offerNotes} onChange={(e) => setOfferNotes(e.target.value)} className={field} />
        </label>
      </div>

      {/* Two branches: left = prestations, right = marge & vente */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left branch — prestations (labor) */}
        <div className="flex flex-col rounded-[14px] border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line-2 px-4 py-2.5">
            <h3 className="text-[13px] font-semibold text-ink">{t("prestations")}</h3>
            <span className="text-[11px] text-ink-4">{t("steps.labor")}</span>
          </div>
          {labor.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-ink-3">{t("noLabor")}</p>
          ) : (
            <ul className="divide-y divide-line-2">
              {labor.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                  <span className="text-ink">{l.description}<span className="ms-1 text-ink-4">· {l.days} × {money(l.daily_rate)}</span></span>
                  <span className="tabular-nums font-medium text-ink">{money(l.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex items-center justify-between border-t border-line-2 bg-[#f6f6f8] px-4 py-2.5">
            <span className="text-[13px] font-semibold text-ink">{t("laborTotal")}</span>
            <span className="text-[15px] font-semibold tabular-nums text-ink">{money(laborTotal)}{cur}</span>
          </div>
        </div>

        {/* Right branch — marge & prix de vente */}
        <div className="divide-y divide-line-2 rounded-[14px] border border-line bg-white">
          <Row label={t("materialsBuyingTotal")} value={`${money(materialsBuying)}${cur}`} tone="buy" />
          <div className="grid grid-cols-2 gap-3 px-4 py-3">
            <label className={labelCls}>
              {t("margin")} (%)
              <input type="number" step="0.01" min="0" max="100000" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} className={field} />
            </label>
            <label className={labelCls}>
              {t("transport")}
              <input type="number" step="0.01" min="0" value={transport} onChange={(e) => setTransport(e.target.value)} className={field} />
            </label>
          </div>
          <Row label={t("marginAmount")} value={`${money(marginAmount)}${cur}`} />
          <Row label={t("materialsSellingTotal")} value={`${money(materialsSelling)}${cur}`} tone="sell" />
          <Row label={t("transport")} value={`${money(transportAmount)}${cur}`} />
        </div>
      </div>

      {/* Grand total (both branches converge) */}
      <div className="flex items-center justify-between rounded-[14px] border-2 border-brand bg-brand/5 px-5 py-3.5">
        <span className="text-[15px] font-semibold text-ink">{t("grandTotal")}</span>
        <span className="text-[20px] font-bold tabular-nums text-ink">{money(grandTotal)}{cur}</span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={savingFooter} onClick={saveFooter} className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand-100 hover:text-brand disabled:opacity-60">
          {savingFooter ? tu("creating") : tu("save")}
        </button>
        <button type="button" disabled={saving} onClick={saveEstimate} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60">
          {saving ? tu("creating") : t("saveEstimate")}
        </button>
        <button type="button" onClick={() => router.push(`/crm/${projectId}/devis`)} className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand-100 hover:text-brand">
          {t("printFacture")}
        </button>
      </div>

      {/* Saved snapshots */}
      <div className="flex flex-col gap-3">
        <h3 className="text-[14px] font-semibold text-ink">{t("savedEstimates")}</h3>
        {estimates.length === 0 ? (
          <p className="rounded-[12px] border border-line bg-white px-4 py-3 text-[13px] text-ink-3">{t("noEstimates")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {estimates.map((e) => (
              <li key={e.id} className="rounded-[12px] border border-line bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{e.estimate_no ?? "—"}</span>
                  <span className="text-[15px] font-semibold tabular-nums text-ink">{money(e.grand_total)}{e.currency ? ` ${e.currency}` : ""}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[12px] text-ink-4">
                  <span>{when(e.created_at)}</span>
                  <button type="button" onClick={() => router.push(`/crm/${projectId}/devis?estimate=${e.id}`)} className="font-semibold text-ink-2 hover:text-brand">
                    {t("printFacture")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
