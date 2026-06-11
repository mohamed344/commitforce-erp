"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { money } from "@/components/modules/crm/types";

type Company = { enterprise_name: string | null; enterprise_short: string | null; enterprise_email: string | null; logo_url: string | null };
type Project = {
  name: string; code: string | null;
  client_name: string | null; client_address: string | null; client_email: string | null; site_address: string | null;
  currency: string | null; margin_pct: number | null; transport_amount: number | null;
  offer_ref: string | null; offer_validity: string | null; offer_notes: string | null;
};
type QteLine = { id: string; designation: string };
type MaterialLine = { qte_line_id: string | null; raw_name: string; raw_ref: string | null; uom: string | null; qty: number; unit_rate: number | null };
type LaborLine = { description: string; days: number; daily_rate: number; amount: number };

export default function PrintDevisView({ projectId, estimateId }: { projectId: string; estimateId?: string }) {
  const t = useTranslations("project");
  const supabase = createClient();
  const [company, setCompany] = useState<Company | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [qteLines, setQteLines] = useState<QteLine[]>([]);
  const [materials, setMaterials] = useState<MaterialLine[]>([]);
  const [labor, setLabor] = useState<LaborLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: comp }, { data: proj }, { data: qte }, { data: mats }, { data: lab }] = await Promise.all([
        supabase.from("company_settings").select("enterprise_name,enterprise_short,enterprise_email,logo_url").maybeSingle(),
        supabase.from("projects").select("name,code,client_name,client_address,client_email,site_address,currency,margin_pct,transport_amount,offer_ref,offer_validity,offer_notes").eq("id", projectId).single(),
        supabase.from("project_qte_lines").select("id,designation").eq("project_id", projectId).order("sort_order").order("line_no"),
        supabase.from("project_material_lines").select("qte_line_id,raw_name,raw_ref,uom,qty,unit_rate").eq("project_id", projectId).order("line_no"),
        supabase.from("project_labor_lines").select("description,days,daily_rate,amount").eq("project_id", projectId).order("line_no"),
      ]);
      setCompany((comp as Company) ?? null);
      setProject((proj as Project) ?? null);
      setQteLines((qte as QteLine[]) ?? []);
      setMaterials((mats as MaterialLine[]) ?? []);
      setLabor((lab as LaborLine[]) ?? []);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, estimateId]);

  useEffect(() => {
    if (ready) setTimeout(() => window.print(), 400);
  }, [ready]);

  if (!ready || !project) return <div className="p-8 text-[14px]">…</div>;

  const cur = project.currency ? ` ${project.currency}` : "";
  const marginPct = Number(project.margin_pct ?? 0);
  const sell = (buy: number | null) => (buy == null ? null : Math.round(buy * (1 + marginPct / 100) * 100) / 100);

  const materialsBuying = materials.reduce((s, m) => s + (m.unit_rate != null ? m.qty * m.unit_rate : 0), 0);
  const materialsSelling = Math.round(materialsBuying * (1 + marginPct / 100) * 100) / 100;
  const laborTotal = labor.reduce((s, l) => s + Number(l.amount ?? 0), 0);
  const transportAmount = Number(project.transport_amount ?? 0);
  const grandTotal = materialsSelling + laborTotal + transportAmount;
  const matsOf = (id: string | null) => materials.filter((m) => m.qte_line_id === id);
  const orphans = matsOf(null);

  return (
    <div className="mx-auto max-w-[820px] bg-white p-8 text-[13px] text-black print:p-0">
      <style>{`@media print { @page { margin: 14mm; } .no-print { display: none; } }`}</style>

      <div className="no-print mb-4 flex justify-end">
        <button type="button" onClick={() => window.print()} className="rounded border border-gray-300 px-3 py-1.5 text-[13px] font-semibold">{t("printFacture")}</button>
      </div>

      {/* Header */}
      <div className="mb-5 flex items-start justify-between border-b border-gray-300 pb-4">
        <div>
          {company?.logo_url && <img src={company.logo_url} alt="" className="mb-2 h-12" />}
          <div className="text-[16px] font-bold">{company?.enterprise_name ?? company?.enterprise_short ?? ""}</div>
          {company?.enterprise_email && <div className="text-gray-500">{company.enterprise_email}</div>}
        </div>
        <div className="text-end">
          <div className="text-[18px] font-bold uppercase">{t("facture")}</div>
          {project.offer_ref && <div className="font-semibold">{project.offer_ref}</div>}
          {!project.offer_ref && project.code && <div className="text-gray-500">{project.code}</div>}
          {project.offer_validity && <div className="text-[12px] text-gray-500">{t("offerValidity")}: {project.offer_validity}</div>}
        </div>
      </div>

      {/* Client + project */}
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase text-gray-400">{t("clientName")}</div>
          <div className="font-semibold">{project.client_name ?? "—"}</div>
          {project.client_address && <div className="text-gray-600">{project.client_address}</div>}
          {project.client_email && <div className="text-gray-600">{project.client_email}</div>}
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase text-gray-400">{t("name")}</div>
          <div className="font-semibold">{project.name}</div>
          {project.site_address && <div className="text-gray-600">{project.site_address}</div>}
        </div>
      </div>

      {/* Materials per QTE — client sees the selling price */}
      {[...qteLines, { id: "__orphan__", designation: t("ungroupedMaterials") } as QteLine]
        .filter((q) => (q.id === "__orphan__" ? orphans.length > 0 : true))
        .map((q) => {
          const rows = q.id === "__orphan__" ? orphans : matsOf(q.id);
          if (rows.length === 0) return null;
          const lineTotal = rows.reduce((s, m) => s + (sell(m.unit_rate) != null ? m.qty * (sell(m.unit_rate) as number) : 0), 0);
          return (
            <div key={q.id} className="mb-3">
              <div className="bg-gray-100 px-2 py-1 font-semibold">{q.designation}</div>
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-500">
                    <th className="px-2 py-1 text-start">{t("designation")}</th>
                    <th className="px-2 py-1 text-start">{t("reference")}</th>
                    <th className="px-2 py-1 text-end">{t("requiredQty")}</th>
                    <th className="px-2 py-1 text-end">{t("sellingPrice")}</th>
                    <th className="px-2 py-1 text-end">{t("lineTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m, i) => {
                    const pu = sell(m.unit_rate);
                    return (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="px-2 py-1">{m.raw_name}</td>
                        <td className="px-2 py-1">{m.raw_ref ?? ""}</td>
                        <td className="px-2 py-1 text-end tabular-nums">{m.qty}{m.uom ? ` ${m.uom}` : ""}</td>
                        <td className="px-2 py-1 text-end tabular-nums">{money(pu)}</td>
                        <td className="px-2 py-1 text-end tabular-nums">{pu == null ? "—" : money(m.qty * pu)}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={4} className="px-2 py-1 text-end font-semibold">{t("subtotal")}</td>
                    <td className="px-2 py-1 text-end font-semibold tabular-nums">{money(lineTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

      {/* Prestations (labor) */}
      {labor.length > 0 && (
        <div className="mb-3">
          <div className="bg-gray-100 px-2 py-1 font-semibold">{t("prestations")}</div>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-gray-300 text-gray-500">
                <th className="px-2 py-1 text-start">{t("description")}</th>
                <th className="px-2 py-1 text-end">{t("days")}</th>
                <th className="px-2 py-1 text-end">{t("dailyRate")}</th>
                <th className="px-2 py-1 text-end">{t("amount")}</th>
              </tr>
            </thead>
            <tbody>
              {labor.map((l, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="px-2 py-1">{l.description}</td>
                  <td className="px-2 py-1 text-end tabular-nums">{l.days}</td>
                  <td className="px-2 py-1 text-end tabular-nums">{money(l.daily_rate)}</td>
                  <td className="px-2 py-1 text-end tabular-nums">{money(l.amount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="px-2 py-1 text-end font-semibold">{t("laborTotal")}</td>
                <td className="px-2 py-1 text-end font-semibold tabular-nums">{money(laborTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="mt-5 ms-auto w-[320px] text-[13px]">
        <div className="flex justify-between py-1"><span className="text-gray-500">{t("materialsSellingTotal")}</span><span className="tabular-nums">{money(materialsSelling)}{cur}</span></div>
        <div className="flex justify-between py-1"><span className="text-gray-500">{t("laborTotal")}</span><span className="tabular-nums">{money(laborTotal)}{cur}</span></div>
        <div className="flex justify-between py-1"><span className="text-gray-500">{t("transport")}</span><span className="tabular-nums">{money(transportAmount)}{cur}</span></div>
        <div className="flex justify-between border-t-2 border-black py-1.5 text-[15px] font-bold"><span>{t("grandTotal")}</span><span className="tabular-nums">{money(grandTotal)}{cur}</span></div>
      </div>

      {/* Remarks + validity footer */}
      {(project.offer_notes || project.offer_validity) && (
        <div className="mt-6 border-t border-gray-300 pt-3 text-[12px] text-gray-600">
          {project.offer_validity && <div><span className="font-semibold">{t("offerValidity")}: </span>{project.offer_validity}</div>}
          {project.offer_notes && <div className="mt-1 whitespace-pre-wrap"><span className="font-semibold">{t("offerNotes")}: </span>{project.offer_notes}</div>}
        </div>
      )}
    </div>
  );
}
