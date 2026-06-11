"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";

type Company = { enterprise_name: string | null; enterprise_short: string | null; enterprise_email: string | null; logo_url: string | null };
type Project = { name: string; code: string | null; site_address: string | null };
type QteLine = { id: string; designation: string };
type MaterialLine = { qte_line_id: string | null; raw_name: string; raw_ref: string | null; uom: string | null; qty: number; matched_item_id: string | null; unit_rate: number | null; status: string };

function needsPrice(m: MaterialLine): boolean {
  return m.status === "not_found" || m.unit_rate == null || m.unit_rate === 0;
}

export default function PrintConsultationView({ projectId }: { projectId: string }) {
  const t = useTranslations("project");
  const supabase = createClient();
  const [company, setCompany] = useState<Company | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [qteLines, setQteLines] = useState<QteLine[]>([]);
  const [materials, setMaterials] = useState<MaterialLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: comp }, { data: proj }, { data: qte }, { data: mats }] = await Promise.all([
        supabase.from("company_settings").select("enterprise_name,enterprise_short,enterprise_email,logo_url").maybeSingle(),
        supabase.from("projects").select("name,code,site_address").eq("id", projectId).single(),
        supabase.from("project_qte_lines").select("id,designation").eq("project_id", projectId),
        supabase.from("project_material_lines").select("qte_line_id,raw_name,raw_ref,uom,qty,matched_item_id,unit_rate,status").eq("project_id", projectId).order("line_no"),
      ]);
      setCompany((comp as Company) ?? null);
      setProject((proj as Project) ?? null);
      setQteLines((qte as QteLine[]) ?? []);
      setMaterials((mats as MaterialLine[]) ?? []);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (ready) setTimeout(() => window.print(), 300);
  }, [ready]);

  if (!ready || !project) return <div className="p-8 text-[14px]">…</div>;

  const pending = materials.filter(needsPrice);
  const qteName = (id: string | null) => qteLines.find((q) => q.id === id)?.designation ?? "—";

  return (
    <div className="mx-auto max-w-[820px] bg-white p-8 text-[13px] text-black print:p-0">
      <style>{`@media print { @page { margin: 16mm; } .no-print { display: none; } }`}</style>

      <div className="no-print mb-4 flex justify-end">
        <button type="button" onClick={() => window.print()} className="rounded border border-gray-300 px-3 py-1.5 text-[13px] font-semibold">{t("printConsultation")}</button>
      </div>

      <div className="mb-6 flex items-start justify-between border-b border-gray-300 pb-4">
        <div>
          {company?.logo_url && <img src={company.logo_url} alt="" className="mb-2 h-12" />}
          <div className="text-[16px] font-bold">{company?.enterprise_name ?? company?.enterprise_short ?? ""}</div>
          {company?.enterprise_email && <div className="text-gray-500">{company.enterprise_email}</div>}
        </div>
        <div className="text-end">
          <div className="text-[18px] font-bold uppercase">{t("ficheConsultation")}</div>
          <div className="text-gray-500">{project.code ?? project.name}</div>
        </div>
      </div>

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b-2 border-gray-400 text-gray-600">
            <th className="px-2 py-1.5 text-start">{t("qte")}</th>
            <th className="px-2 py-1.5 text-start">{t("designation")}</th>
            <th className="px-2 py-1.5 text-start">{t("reference")}</th>
            <th className="px-2 py-1.5 text-end">{t("requiredQty")}</th>
            <th className="px-2 py-1.5 text-end">{t("supplierPrice")}</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((m, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="px-2 py-2 text-gray-500">{qteName(m.qte_line_id)}</td>
              <td className="px-2 py-2 font-medium">{m.raw_name}</td>
              <td className="px-2 py-2">{m.raw_ref ?? ""}</td>
              <td className="px-2 py-2 text-end tabular-nums">{m.qty}{m.uom ? ` ${m.uom}` : ""}</td>
              <td className="px-2 py-2 text-end">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pending.length === 0 && <p className="mt-4 text-gray-500">{t("noConsultation")}</p>}
    </div>
  );
}
