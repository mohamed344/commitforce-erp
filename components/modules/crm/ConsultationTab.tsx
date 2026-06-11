"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import Badge from "@/components/data/Badge";
import { type TabProps, field } from "@/components/modules/crm/types";
import { type MaterialStatus } from "@/lib/stockMatch";
import { csvName, downloadCsv, toCsv } from "@/lib/csv";

type MaterialLine = {
  id: string;
  qte_line_id: string | null;
  raw_name: string;
  raw_ref: string | null;
  uom: string | null;
  qty: number;
  matched_item_id: string | null;
  unit_rate: number | null;
  in_stock_qty: number | null;
  status: MaterialStatus;
};
type QteLine = { id: string; designation: string };

/** A material needs a consultation when it has no price yet. */
function needsPrice(m: MaterialLine): boolean {
  return m.status === "not_found" || m.unit_rate == null || m.unit_rate === 0;
}

export default function ConsultationTab({ projectId, project }: TabProps) {
  const t = useTranslations("project");
  const router = useRouter();
  const supabase = createClient();

  const [materials, setMaterials] = useState<MaterialLine[]>([]);
  const [qteLines, setQteLines] = useState<QteLine[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const [{ data: mats }, { data: qte }] = await Promise.all([
      supabase.from("project_material_lines").select("*").eq("project_id", projectId).order("line_no"),
      supabase.from("project_qte_lines").select("id,designation").eq("project_id", projectId),
    ]);
    setMaterials((mats as MaterialLine[]) ?? []);
    setQteLines((qte as QteLine[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const pending = materials.filter(needsPrice);
  const qteName = (id: string | null) => qteLines.find((q) => q.id === id)?.designation ?? "—";

  // Enter a supplier price → update the material AND the matched item's buying rate.
  async function savePrice(m: MaterialLine) {
    const raw = draft[m.id];
    if (raw == null || raw === "") return;
    const price = Number(raw.replace(",", "."));
    if (!Number.isFinite(price)) return setErr(t("invalidPrice"));
    setSavingId(m.id);
    setErr(null);

    // Recompute status against stock now that we have a price.
    const inStock = m.in_stock_qty ?? 0;
    const status: MaterialStatus = m.matched_item_id ? (m.qty > 0 && inStock >= m.qty ? "in_stock" : "insufficient") : "not_found";

    const res = await supabase.from("project_material_lines").update({ unit_rate: price, status }).eq("id", m.id);
    if (res.error) {
      setSavingId(null);
      return setErr(res.error.message);
    }
    // Write the supplier price back to the items master (plan: update standard_buying_rate).
    if (m.matched_item_id) {
      await supabase.from("items").update({ standard_buying_rate: price }).eq("id", m.matched_item_id);
    }
    setSavingId(null);
    setDraft((d) => { const n = { ...d }; delete n[m.id]; return n; });
    load();
  }

  async function exportCsv() {
    const XLSX = await import("xlsx");
    const header = [t("qte"), t("designation"), t("reference"), t("requiredQty"), t("unit"), t("supplierPrice")];
    const rows = pending.map((m) => [qteName(m.qte_line_id), m.raw_name, m.raw_ref ?? "", m.qty, m.uom ?? "", m.unit_rate ?? ""]);
    downloadCsv(toCsv(XLSX, [header, ...rows], ";"), csvName(project.code || project.name, "consultation"));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{t("consultation")}</h2>
        <span className="text-[12px] text-ink-4">· {pending.length} {t("itemsToPrice")}</span>
        <div className="ms-auto flex items-center gap-2">
          <button type="button" disabled={!pending.length} onClick={exportCsv} className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand-100 hover:text-brand disabled:opacity-50">
            {t("downloadCsv")}
          </button>
          <button type="button" disabled={!pending.length} onClick={() => router.push(`/crm/${projectId}/consultation`)} className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand-100 hover:text-brand disabled:opacity-50">
            {t("printConsultation")}
          </button>
        </div>
      </div>
      {err && <p className="text-[12px] text-red-600">{err}</p>}

      {pending.length === 0 ? (
        <p className="rounded-[12px] border border-line bg-white px-4 py-3 text-[13px] text-ink-3">{t("noConsultation")}</p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-line bg-white">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-line-2 text-[12px] uppercase tracking-[0.04em] text-ink-4">
                <th className="px-4 py-2.5 text-start font-medium">{t("qte")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("designation")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("reference")}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t("requiredQty")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("status")}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t("supplierPrice")}</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              {pending.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 text-ink-3">{qteName(m.qte_line_id)}</td>
                  <td className="px-4 py-2.5 font-medium text-ink">{m.raw_name}</td>
                  <td className="px-4 py-2.5 text-ink-3">{m.raw_ref ?? "—"}</td>
                  <td className="px-4 py-2.5 text-end tabular-nums">{m.qty}{m.uom ? ` ${m.uom}` : ""}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={m.matched_item_id ? "blue" : "red"}>{m.matched_item_id ? t("materialStatuses.needs_price") : t("materialStatuses.not_found")}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <input
                      type="number"
                      step="0.01"
                      value={draft[m.id] ?? (m.unit_rate ? String(m.unit_rate) : "")}
                      onChange={(e) => setDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                      className={`${field} w-28 text-end`}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <button type="button" disabled={savingId === m.id || (draft[m.id] ?? "") === ""} onClick={() => savePrice(m)} className="rounded-[8px] bg-gradient-to-b from-brand to-brand-700 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">
                      {savingId === m.id ? "…" : t("savePrice")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px] text-ink-4">{t("consultationHint")}</p>
    </div>
  );
}
