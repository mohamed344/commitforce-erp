"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import Badge from "@/components/data/Badge";
import { useOptionSet } from "@/components/options/useOptionSet";
import type { Project } from "@/components/modules/crm/types";
import OverviewTab from "@/components/modules/crm/OverviewTab";
import QteTab from "@/components/modules/crm/QteTab";
import ConsultationTab from "@/components/modules/crm/ConsultationTab";
import LaborTab from "@/components/modules/crm/LaborTab";
import EstimateTab from "@/components/modules/crm/EstimateTab";

type TabKey = "overview" | "qte" | "consultation" | "labor" | "estimate";
const TABS: TabKey[] = ["overview", "qte", "consultation", "labor", "estimate"];

export default function CrmProjectDetailView({ projectId }: { projectId: string }) {
  const t = useTranslations("project");
  const tu = useTranslations("ui");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { byValue: statusBy } = useOptionSet("project_status");

  const initialTab = (searchParams.get("tab") as TabKey) || "overview";
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>(TABS.includes(initialTab) ? initialTab : "overview");

  const loadProject = useCallback(async () => {
    const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
    setProject((data as Project) ?? null);
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  if (loading) return <div className="p-8 text-[14px] text-ink-3">{tu("loading")}</div>;
  if (!project) return <div className="p-8 text-[14px] text-ink-3">{tu("loading")}</div>;

  const tabProps = { projectId, project, reload: loadProject };

  return (
    <div className="mx-auto w-full max-w-[1100px] p-5 sm:p-8">
      <button type="button" onClick={() => router.push("/crm")} className="mb-4 text-[13px] text-ink-3 hover:text-brand">
        ← {tu("back")}
      </button>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold text-ink">{project.name}</h1>
        <Badge tone={statusBy.get(project.status)?.tone ?? "gray"}>{statusBy.get(project.status)?.label ?? project.status}</Badge>
        {project.code && <span className="text-[13px] text-ink-3">{project.code}</span>}
      </div>

      {/* Numbered workflow stepper (C.D.C scan → QTE → consultation → prestations → chiffrage) */}
      <div className="mb-6 flex items-stretch gap-1.5 overflow-x-auto pb-1">
        {TABS.map((k, i) => {
          const active = tab === k;
          return (
            <div key={k} className="flex items-stretch gap-1.5">
              <button
                type="button"
                onClick={() => setTab(k)}
                className={`flex min-w-[150px] items-center gap-2.5 rounded-[12px] border px-3 py-2 text-start transition-colors ${
                  active ? "border-brand bg-brand/5" : "border-line bg-white hover:border-brand-100"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
                    active ? "bg-gradient-to-b from-brand to-brand-700 text-white" : "bg-line-2 text-ink-3"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className={`text-[13px] font-semibold leading-tight ${active ? "text-brand" : "text-ink"}`}>{t(`tabs.${k}`)}</span>
                  <span className="truncate text-[11px] leading-tight text-ink-4">{t(`steps.${k}`)}</span>
                </span>
              </button>
              {i < TABS.length - 1 && <span className="flex items-center text-ink-4">→</span>}
            </div>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab {...tabProps} />}
      {tab === "qte" && <QteTab {...tabProps} />}
      {tab === "consultation" && <ConsultationTab {...tabProps} />}
      {tab === "labor" && <LaborTab {...tabProps} />}
      {tab === "estimate" && <EstimateTab {...tabProps} />}
    </div>
  );
}
