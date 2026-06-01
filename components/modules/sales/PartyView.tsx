"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import { FormActions } from "@/components/modules/ProjectsView";

type Party = {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  notes: string | null;
  is_active: boolean;
};

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

/** Shared CRUD master for customers (clients) and suppliers (fournisseurs). */
export default function PartyView({ kind }: { kind: "customer" | "supplier" }) {
  const t = useTranslations("sales");
  const supabase = createClient();
  const table = kind === "customer" ? "customers" : "suppliers";

  const [rows, setRows] = useState<Party[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const empty = { name: "", code: "", email: "", phone: "", address: "", tax_id: "", notes: "" };
  const [form, setForm] = useState(empty);

  async function load() {
    const { data } = await supabase.from(table).select("*").order("name");
    setRows((data as Party[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(r: Party) {
    setEditing(r);
    setForm({
      name: r.name,
      code: r.code ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      address: r.address ?? "",
      tax_id: r.tax_id ?? "",
      notes: r.notes ?? "",
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name: form.name,
      code: form.code || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      tax_id: form.tax_id || null,
      notes: form.notes || null,
    };
    const res = editing
      ? await supabase.from(table).update(payload).eq("id", editing.id)
      : await supabase.from(table).insert(payload);
    setBusy(false);
    if (!res.error) {
      setOpen(false);
      setForm(empty);
      load();
    }
  }

  async function del(r: Party) {
    await supabase.from(table).delete().eq("id", r.id);
    load();
  }

  const cols: Column<Party>[] = [
    { header: t("name"), cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { header: t("code"), cell: (r) => r.code ?? "—" },
    { header: t("phone"), cell: (r) => r.phone ?? "—" },
    { header: t("email"), cell: (r) => r.email ?? "—" },
    {
      header: t("active"),
      cell: (r) => <Badge tone={r.is_active ? "green" : "gray"}>{r.is_active ? "✓" : "—"}</Badge>,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]"
        >
          + {kind === "customer" ? t("newCustomer") : t("newSupplier")}
        </button>
      </div>

      <ListTable
        columns={cols}
        rows={rows}
        getKey={(r) => r.id}
        actions={(r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => del(r)} />}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? form.name : kind === "customer" ? t("newCustomer") : t("newSupplier")}
      >
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("name")}
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("code")}
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("taxId")}
              <input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("phone")}
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("email")}
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            </label>
          </div>
          <label className={labelCls}>
            {t("address")}
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={field} />
          </label>
          <label className={labelCls}>
            {t("notes")}
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={field} />
          </label>
          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.name.trim()} />
        </form>
      </Modal>
    </div>
  );
}
