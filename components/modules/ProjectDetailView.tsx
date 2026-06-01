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
import { FormActions } from "./ProjectsView";

type Project = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};
type ItemOpt = { id: string; name: string; uom: string | null; standard_buying_rate: number | null };
type Line = { id: string; item_id: string; qty: number; rate: number | null; item: { name: string; uom: string | null } | null };
type Opt = { id: string; name: string };
type ConsumeLine = { item_id: string; name: string; uom: string | null; required: number; consumed: number; remaining: number; issue: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function ProjectDetailView({ projectId }: { projectId: string }) {
  const tp = useTranslations("project");
  const tu = useTranslations("ui");
  const router = useRouter();
  const supabase = createClient();
  const { byValue: statusBy } = useOptionSet("project_status");

  const [project, setProject] = useState<Project | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [consumedBy, setConsumedBy] = useState<Map<string, number>>(new Map());
  const [whs, setWhs] = useState<Opt[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Line | null>(null);
  const [form, setForm] = useState({ item_id: "", qty: "1", rate: "" });

  // Consume materials → stock issue
  const [consumeOpen, setConsumeOpen] = useState(false);
  const [consumeWh, setConsumeWh] = useState("");
  const [consumeLines, setConsumeLines] = useState<ConsumeLine[]>([]);
  const [consumeErr, setConsumeErr] = useState<string | null>(null);

  async function load() {
    const [{ data: p }, { data: pi }, { data: it }, { data: cons }, { data: w }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("project_items").select("id,item_id,qty,rate, item:items(name,uom)").eq("project_id", projectId),
      supabase.from("items").select("id,name,uom,standard_buying_rate").order("name"),
      supabase.from("project_item_consumption").select("item_id,consumed_qty").eq("project_id", projectId),
      supabase.from("warehouses").select("id,name").order("name"),
    ]);
    setProject((p as Project) ?? null);
    setLines((pi as unknown as Line[]) ?? []);
    setItems((it as ItemOpt[]) ?? []);
    setConsumedBy(new Map(((cons as { item_id: string; consumed_qty: number }[]) ?? []).map((c) => [c.item_id, Number(c.consumed_qty)])));
    setWhs((w as Opt[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function openNew() {
    setEditing(null);
    setForm({ item_id: "", qty: "1", rate: "" });
    setOpen(true);
  }
  function openEdit(l: Line) {
    setEditing(l);
    setForm({ item_id: l.item_id, qty: String(l.qty), rate: l.rate != null ? String(l.rate) : "" });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      project_id: projectId,
      item_id: form.item_id,
      qty: Number(form.qty || 0),
      rate: form.rate ? Number(form.rate) : null,
    };
    const res = editing
      ? await supabase.from("project_items").update({ qty: payload.qty, rate: payload.rate }).eq("id", editing.id)
      : await supabase.from("project_items").insert(payload);
    setBusy(false);
    if (!res.error) {
      setOpen(false);
      load();
    }
  }

  async function del(l: Line) {
    await supabase.from("project_items").delete().eq("id", l.id);
    load();
  }

  function remainingOf(l: Line): number {
    return Math.max(0, l.qty - (consumedBy.get(l.item_id) ?? 0));
  }

  function openConsume() {
    setConsumeErr(null);
    setConsumeWh(whs[0]?.id ?? "");
    setConsumeLines(
      lines
        .map((l) => {
          const consumed = consumedBy.get(l.item_id) ?? 0;
          const remaining = Math.max(0, l.qty - consumed);
          return { item_id: l.item_id, name: l.item?.name ?? "—", uom: l.item?.uom ?? null, required: l.qty, consumed, remaining, issue: String(remaining) };
        })
        .filter((c) => c.remaining > 0),
    );
    setConsumeOpen(true);
  }

  async function submitConsume(e: React.FormEvent) {
    e.preventDefault();
    setConsumeErr(null);
    const rows = consumeLines
      .map((c) => ({ item_id: c.item_id, qty: Number(c.issue || 0) }))
      .filter((r) => r.qty > 0);
    if (!consumeWh || rows.length === 0) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("stock_entries")
      .insert({ entry_type: "issue", project_id: projectId, reference: `CONS-${project?.code ?? projectId.slice(0, 8)}` })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      setConsumeErr(error?.message ?? "error");
      return;
    }
    const entryId = (data as { id: string }).id;
    const res = await supabase.from("stock_entry_lines").insert(
      rows.map((r) => ({ stock_entry_id: entryId, item_id: r.item_id, qty: r.qty, source_warehouse_id: consumeWh })),
    );
    setBusy(false);
    if (res.error) {
      setConsumeErr(res.error.message);
      return;
    }
    setConsumeOpen(false);
    load();
  }

  const money = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString());
  const total = lines.reduce((sum, l) => sum + l.qty * (l.rate ?? 0), 0);

  const cols: Column<Line>[] = [
    { header: tp("products"), cell: (l) => <span className="font-medium text-ink">{l.item?.name ?? "—"}</span> },
    { header: tp("quantity"), cell: (l) => <span className="tabular-nums">{l.qty}</span> },
    { header: tp("unit"), cell: (l) => l.item?.uom ?? "—" },
    {
      header: tp("consumed"),
      className: "text-end",
      cell: (l) => {
        const consumed = consumedBy.get(l.item_id) ?? 0;
        const remaining = remainingOf(l);
        return (
          <span className="tabular-nums">
            {consumed}
            {remaining > 0 && <span className="text-ink-4"> / {tp("remaining")} {remaining}</span>}
          </span>
        );
      },
    },
    { header: tp("unitPrice"), className: "text-end", cell: (l) => <span className="tabular-nums">{money(l.rate)}</span> },
    { header: tp("amount"), className: "text-end", cell: (l) => <span className="tabular-nums font-medium">{money(l.qty * (l.rate ?? 0))}</span> },
  ];

  const hasRemaining = lines.some((l) => remainingOf(l) > 0);

  if (!project) return <div className="p-8 text-[14px] text-ink-3">{tu("loading")}</div>;

  return (
    <div className="mx-auto w-full max-w-[1000px] p-5 sm:p-8">
      <button type="button" onClick={() => router.push("/projects")} className="mb-4 text-[13px] text-ink-3 hover:text-brand">
        ← {tu("back")}
      </button>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold text-ink">{project.name}</h1>
        <Badge tone={statusBy.get(project.status)?.tone ?? "gray"}>{statusBy.get(project.status)?.label ?? project.status}</Badge>
        {project.code && <span className="text-[13px] text-ink-3">{project.code}</span>}
      </div>

      {(project.start_date || project.end_date || project.description) && (
        <div className="mb-6 rounded-[14px] border border-line bg-white p-4 text-[13px] text-ink-2">
          {(project.start_date || project.end_date) && (
            <div>{project.start_date ?? "…"} → {project.end_date ?? "…"}</div>
          )}
          {project.description && <p className="mt-1 text-ink-3">{project.description}</p>}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">{tp("products")}</h2>
        <div className="flex items-center gap-2">
          {hasRemaining && (
            <button type="button" onClick={openConsume} className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:border-brand-100 hover:text-brand">
              {tp("consume")}
            </button>
          )}
          <button type="button" onClick={openNew} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]">
            + {tp("addProduct")}
          </button>
        </div>
      </div>

      <ListTable columns={cols} rows={lines} getKey={(l) => l.id} actions={(l) => <RowActions onEdit={() => openEdit(l)} onDelete={() => del(l)} />} />

      {lines.length > 0 && (
        <div className="mt-3 flex justify-end gap-6 pe-14 text-[14px]">
          <span className="text-ink-3">{tp("amount")}</span>
          <span className="font-semibold text-ink tabular-nums">{total.toLocaleString()}</span>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={tp("addProduct")}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {tp("products")}
            <select
              required
              disabled={!!editing}
              value={form.item_id}
              onChange={(e) => {
                const it = items.find((x) => x.id === e.target.value);
                setForm({ ...form, item_id: e.target.value, rate: form.rate || (it?.standard_buying_rate != null ? String(it.standard_buying_rate) : "") });
              }}
              className={field}
            >
              <option value="">—</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {tp("quantity")}
              <input type="number" step="0.001" required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {tp("unitPrice")}
              <input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className={field} />
            </label>
          </div>
          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!form.item_id || !form.qty} />
        </form>
      </Modal>

      <Modal open={consumeOpen} onClose={() => setConsumeOpen(false)} title={tp("consumeTitle")}>
        <form onSubmit={submitConsume} className="flex flex-col gap-3">
          <p className="text-[12.5px] text-ink-3">{tp("consumeHint")}</p>
          <label className={labelCls}>
            {tp("chooseWarehouse")}
            <select required value={consumeWh} onChange={(e) => setConsumeWh(e.target.value)} className={field}>
              <option value="">—</option>
              {whs.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2">
            {consumeLines.length === 0 && <p className="text-[13px] text-ink-3">{tp("nothingToConsume")}</p>}
            {consumeLines.map((c, i) => (
              <div key={c.item_id} className="flex items-center gap-2 rounded-[10px] border border-line-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{c.name}</div>
                  <div className="text-[11px] text-ink-3">{tp("required")} {c.required} · {tp("consumed")} {c.consumed} · {tp("remaining")} {c.remaining}</div>
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max={c.remaining}
                  value={c.issue}
                  onChange={(e) => setConsumeLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, issue: e.target.value } : x)))}
                  className={`${field} w-24`}
                />
                <span className="w-10 text-[12px] text-ink-3">{c.uom ?? ""}</span>
              </div>
            ))}
          </div>
          {consumeErr && <p className="text-[12px] text-red-600">{consumeErr}</p>}
          <FormActions busy={busy} onCancel={() => setConsumeOpen(false)} disabled={!consumeWh || consumeLines.every((c) => Number(c.issue || 0) <= 0)} />
        </form>
      </Modal>
    </div>
  );
}
