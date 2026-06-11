"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import { useOptionSet } from "@/components/options/useOptionSet";
import { FormActions } from "@/components/modules/ProjectsView";

type Order = {
  id: string;
  order_no: string | null;
  order_date: string;
  status: string;
  project: { name: string } | null;
};
type Opt = { id: string; name: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function PurchaseOrderListView({ canCreate }: { canCreate: boolean }) {
  const t = useTranslations("sales");
  const router = useRouter();
  const supabase = createClient();
  const { byValue: statusBy } = useOptionSet("purchase_order_status");

  const [rows, setRows] = useState<Order[]>([]);
  const [projects, setProjects] = useState<Opt[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const empty = { project_id: "", order_date: today };
  const [form, setForm] = useState(empty);

  async function load() {
    const [{ data: o }, { data: p }] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("id,order_no,order_date,status, project:projects(name)")
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name").order("name"),
    ]);
    setRows((o as unknown as Order[]) ?? []);
    setProjects((p as Opt[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setForm(empty);
    setOpen(true);
  }

  // Chiffrage create: a project + a date — products are added on the detail
  // page, and the supplier is only chosen later when generating the bon d'achat.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("purchase_orders")
      .insert({ project_id: form.project_id, order_date: form.order_date })
      .select("id")
      .single();
    setBusy(false);
    if (!error && data) {
      setOpen(false);
      router.push(`/sales/orders/${(data as { id: string }).id}`);
    }
  }

  async function del(r: Order) {
    await supabase.from("purchase_orders").delete().eq("id", r.id);
    load();
  }

  const cols: Column<Order>[] = [
    { header: t("orderNo"), cell: (r) => <span className="font-medium text-ink">{r.order_no ?? "—"}</span> },
    { header: t("project"), cell: (r) => r.project?.name ?? "—" },
    { header: t("chiffrageDate"), cell: (r) => r.order_date },
    { header: t("status"), cell: (r) => <Badge tone={statusBy.get(r.status)?.tone ?? "gray"}>{statusBy.get(r.status)?.label ?? r.status}</Badge> },
  ];

  return (
    <div>
      {canCreate && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={openNew}
            className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]"
          >
            + {t("newPurchaseOrder")}
          </button>
        </div>
      )}

      <ListTable
        columns={cols}
        rows={rows}
        getKey={(r) => r.id}
        onRowClick={(r) => router.push(`/sales/orders/${r.id}`)}
        actions={(r) => (
          <RowActions
            onView={() => router.push(`/sales/orders/${r.id}`)}
            onEdit={() => router.push(`/sales/orders/${r.id}`)}
            onDelete={canCreate && r.status !== "converted" ? () => del(r) : undefined}
          />
        )}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t("newPurchaseOrder")}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("project")}
            <select required value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className={field}>
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            {t("chiffrageDate")}
            <input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} className={field} />
          </label>
          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.project_id || !form.order_date} />
        </form>
      </Modal>
    </div>
  );
}
