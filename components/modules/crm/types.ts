// Shared types + form styling for the CRM project-detail tabs.

export type Project = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  customer_id: string | null;
  project_manager_id: string | null;
  project_type: string | null;
  priority: string | null;
  budget_amount: number | null;
  currency: string | null;
  site_address: string | null;
  deadline: string | null;
  payment_terms: string | null;
  daily_rate: number | null;
  margin_pct: number | null;
  transport_amount: number | null;
  offer_ref: string | null;
  offer_validity: string | null;
  offer_notes: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

export type TabProps = {
  projectId: string;
  project: Project;
  reload: () => void | Promise<void>;
};

export const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100 disabled:opacity-60";
export const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";
export const sectionCls = "mt-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-4";

export const money = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString());
