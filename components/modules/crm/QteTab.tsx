"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import ListTable, { type Column } from "@/components/data/ListTable";
import RowActions from "@/components/data/RowActions";
import type { Tone } from "@/lib/options";
import { type TabProps, field, labelCls, money } from "@/components/modules/crm/types";
import {
  type DisplayStatus,
  type ItemRow,
  type MaterialStatus,
  buildItemIndex,
  displayStatus,
  findCol,
  matchLine,
  toNum,
} from "@/lib/stockMatch";
import { downloadBlob, xlsxName } from "@/lib/csv";
import { buildStyledXlsx } from "@/lib/xlsxStyle";

type QteLine = { id: string; line_no: number; designation: string; qty: number; uom: string | null; notes: string | null; sort_order: number };
type MaterialLine = {
  id: string;
  qte_line_id: string | null;
  line_no: number;
  raw_name: string;
  raw_ref: string | null;
  uom: string | null;
  qty: number;
  matched_item_id: string | null;
  unit_rate: number | null;
  in_stock_qty: number | null;
  status: MaterialStatus;
};

const MATERIAL_TONE: Record<DisplayStatus, Tone> = { in_stock: "green", insufficient: "amber", not_found: "red", needs_price: "blue" };

export default function QteTab({ projectId, project }: TabProps) {
  const t = useTranslations("project");
  const tu = useTranslations("ui");
  const supabase = createClient();

  const [qteLines, setQteLines] = useState<QteLine[]>([]);
  const [materials, setMaterials] = useState<MaterialLine[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // QTE line modal
  const [qteOpen, setQteOpen] = useState(false);
  const [editingQte, setEditingQte] = useState<QteLine | null>(null);
  const [qteForm, setQteForm] = useState({ designation: "", qty: "", uom: "", notes: "" });

  // Material modal
  const [matOpen, setMatOpen] = useState(false);
  const [matQteId, setMatQteId] = useState<string | null>(null);
  const [editingMat, setEditingMat] = useState<MaterialLine | null>(null);
  const [matForm, setMatForm] = useState({ raw_name: "", raw_ref: "", qty: "", uom: "", matched_item_id: "", unit_rate: "" });

  // CSV import + C.D.C upload
  const fileRef = useRef<HTMLInputElement>(null);
  const cdcRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function load() {
    const [{ data: qte }, { data: mats }, { data: its }] = await Promise.all([
      supabase.from("project_qte_lines").select("*").eq("project_id", projectId).order("sort_order").order("line_no"),
      supabase.from("project_material_lines").select("*").eq("project_id", projectId).order("line_no"),
      supabase.from("items").select("id,name,sku,standard_buying_rate,valuation_rate,uom").order("name"),
    ]);
    setQteLines((qte as QteLine[]) ?? []);
    setMaterials((mats as MaterialLine[]) ?? []);
    setItems((its as ItemRow[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const matsOf = (qteId: string | null) => materials.filter((m) => m.qte_line_id === qteId);
  const orphanMaterials = matsOf(null); // legacy flat imports with no QTE line

  // ── QTE line CRUD ──
  function openNewQte() {
    setEditingQte(null);
    setQteForm({ designation: "", qty: "", uom: "", notes: "" });
    setQteOpen(true);
  }
  function openEditQte(q: QteLine) {
    setEditingQte(q);
    setQteForm({ designation: q.designation, qty: String(q.qty ?? ""), uom: q.uom ?? "", notes: q.notes ?? "" });
    setQteOpen(true);
  }
  async function submitQte(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = { designation: qteForm.designation, qty: toNum(qteForm.qty), uom: qteForm.uom || null, notes: qteForm.notes || null };
    const res = editingQte
      ? await supabase.from("project_qte_lines").update(payload).eq("id", editingQte.id)
      : await supabase.from("project_qte_lines").insert({ ...payload, project_id: projectId, line_no: qteLines.length + 1, sort_order: qteLines.length + 1 });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    setQteOpen(false);
    load();
  }
  async function delQte(q: QteLine) {
    await supabase.from("project_qte_lines").delete().eq("id", q.id); // cascade removes its materials
    load();
  }

  // ── Material CRUD ──
  function openNewMat(qteId: string) {
    setMatQteId(qteId);
    setEditingMat(null);
    setMatForm({ raw_name: "", raw_ref: "", qty: "", uom: "", matched_item_id: "", unit_rate: "" });
    setMatOpen(true);
  }
  function openEditMat(m: MaterialLine) {
    setMatQteId(m.qte_line_id);
    setEditingMat(m);
    setMatForm({
      raw_name: m.raw_name,
      raw_ref: m.raw_ref ?? "",
      qty: String(m.qty ?? ""),
      uom: m.uom ?? "",
      matched_item_id: m.matched_item_id ?? "",
      unit_rate: m.unit_rate != null ? String(m.unit_rate) : "",
    });
    setMatOpen(true);
  }
  // Selecting a catalogue item fills name/ref/uom/price from the master.
  function onPickItem(id: string) {
    const it = items.find((x) => x.id === id);
    setMatForm((f) => ({
      ...f,
      matched_item_id: id,
      raw_name: it?.name ?? f.raw_name,
      raw_ref: it?.sku ?? f.raw_ref,
      uom: it?.uom ?? f.uom,
      unit_rate: it ? String(it.standard_buying_rate ?? it.valuation_rate ?? "") : f.unit_rate,
    }));
  }
  async function submitMat(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const qty = toNum(matForm.qty);
    const unit_rate = matForm.unit_rate === "" ? null : toNum(matForm.unit_rate);
    const matchedId = matForm.matched_item_id || null;
    // Recompute status against current stock for the chosen item.
    let in_stock_qty: number | null = editingMat?.in_stock_qty ?? null;
    let status: MaterialStatus = "not_found";
    if (matchedId) {
      const { data: bal } = await supabase.from("stock_balances").select("qty").eq("item_id", matchedId);
      in_stock_qty = ((bal as { qty: number }[]) ?? []).reduce((s, b) => s + Number(b.qty), 0);
      status = qty > 0 && in_stock_qty >= qty ? "in_stock" : "insufficient";
    }
    const payload = {
      raw_name: matForm.raw_name,
      raw_ref: matForm.raw_ref || null,
      qty,
      uom: matForm.uom || null,
      matched_item_id: matchedId,
      unit_rate,
      in_stock_qty,
      status,
    };
    const res = editingMat
      ? await supabase.from("project_material_lines").update(payload).eq("id", editingMat.id)
      : await supabase.from("project_material_lines").insert({ ...payload, project_id: projectId, qte_line_id: matQteId, line_no: materials.length + 1 });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    setMatOpen(false);
    load();
  }
  async function delMat(m: MaterialLine) {
    await supabase.from("project_material_lines").delete().eq("id", m.id);
    load();
  }

  // ── Auto-price every material under a QTE line (or all lines) from stock ──
  async function autoPrice(qteId: string | null | "all") {
    setBusy(true);
    setErr(null);
    const { data: balances } = await supabase.from("stock_balances").select("item_id,qty");
    const index = buildItemIndex(items, (balances as { item_id: string; qty: number }[]) ?? []);
    const target = qteId === "all" ? materials : matsOf(qteId);
    for (const m of target) {
      const res = matchLine(m.raw_ref ?? "", m.raw_name, m.qty, index);
      await supabase
        .from("project_material_lines")
        .update({
          matched_item_id: res.matched_item_id,
          unit_rate: res.unit_rate,
          in_stock_qty: res.in_stock_qty,
          status: res.status,
        })
        .eq("id", m.id);
    }
    setBusy(false);
    setMsg(t("autoPriced", { count: target.length }));
    load();
  }

  // ── C.D.C upload → AI/OCR extraction seam ──
  async function onCdc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/cdc-extract", { method: "POST", body: fd });
      const j = await r.json();
      if (j.error) {
        setErr(String(j.error));
        return;
      }
      if (!j.configured) {
        setMsg(t("aiNotConfigured"));
        return;
      }
      const lines = (j.lines as { designation: string; qty?: number; uom?: string }[]) ?? [];
      if (lines.length === 0) {
        setMsg(t("cdcNoLines"));
        return;
      }
      let n = qteLines.length;
      for (const l of lines) {
        n += 1;
        await supabase.from("project_qte_lines").insert({ project_id: projectId, designation: l.designation, qty: l.qty ?? 0, uom: l.uom ?? null, line_no: n, sort_order: n });
      }
      await supabase.from("project_activities").insert({
        project_id: projectId,
        activity_type: "materials_imported",
        description: t("cdcScanned", { count: lines.length }),
      });
      setMsg(t("cdcScanned", { count: lines.length }));
      load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  // ── CSV/Excel import → match to stock → enriched download → store under QTE groups ──
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setMsg(null);
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();

      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][]) ?? [];
      if (aoa.length < 2) {
        setErr(t("noMaterials"));
        return;
      }
      const headers = (aoa[0] ?? []).map((h) => String(h ?? ""));
      const refCol = findCol(headers, ["reference", "ref", "sku", "code"]);
      const nameCol = findCol(headers, ["designation", "article", "libelle", "produit", "description", "nom", "name", "item"]);
      const qtyCol = findCol(headers, ["quantite", "quantity", "qte", "qty", "nombre"]);
      const uomCol = findCol(headers, ["unite", "unit", "uom"]);
      const groupCol = findCol(headers, ["lot", "poste", "section", "ouvrage", "categorie"]);

      // Fill the sheet's existing price/total columns IN PLACE (no duplicates).
      // Append a column only when the source sheet doesn't already have one.
      const outHeaders = [...headers];
      const ensureCol = (existing: number, label: string): number => {
        if (existing >= 0) return existing;
        outHeaders.push(label);
        return outHeaders.length - 1;
      };
      const priceCol = ensureCol(findCol(headers, ["prix unitaire", "prix u", "p.u", "p u", "pu", "unit price", "unitprice"]), t("unitPrice"));
      const totalCol = ensureCol(findCol(headers, ["prix total", "montant total", "montant", "total ht", "total ligne", "total"]), t("lineTotal"));
      const stockCol = ensureCol(-1, t("inStock"));
      const statutCol = ensureCol(-1, t("lineStatus"));

      const { data: balances } = await supabase.from("stock_balances").select("item_id,qty");
      const index = buildItemIndex(items, (balances as { item_id: string; qty: number }[]) ?? []);

      // Build groups of rows; one QTE line per group (or a single default group).
      type Row = { ref: string; name: string; qty: number; uom: string; cells: string[] };
      const groups = new Map<string, Row[]>();
      for (let r = 1; r < aoa.length; r++) {
        const cells = (aoa[r] ?? []).map((c) => (c == null ? "" : String(c)));
        const ref = (refCol >= 0 ? cells[refCol] ?? "" : "").trim();
        const name = (nameCol >= 0 ? cells[nameCol] ?? "" : "").trim();
        if (!ref && !name) continue;
        const groupKey = (groupCol >= 0 ? cells[groupCol] ?? "" : "").trim() || t("defaultQteLine");
        const row: Row = { ref, name, qty: toNum(qtyCol >= 0 ? cells[qtyCol] ?? "" : ""), uom: (uomCol >= 0 ? cells[uomCol] ?? "" : "").trim(), cells };
        (groups.get(groupKey) ?? groups.set(groupKey, []).get(groupKey)!).push(row);
      }
      if (groups.size === 0) {
        setErr(t("noMaterials"));
        return;
      }

      const outRows: (string | number)[][] = [];
      const statusByRow: (DisplayStatus | null)[] = [null]; // index 0 = header row
      let lineNo = qteLines.length;
      let matNo = materials.length;
      for (const [groupKey, rows] of groups) {
        lineNo += 1;
        const totalQty = rows.reduce((s, x) => s + x.qty, 0);
        const { data: qteIns } = await supabase
          .from("project_qte_lines")
          .insert({ project_id: projectId, designation: groupKey, qty: totalQty, line_no: lineNo, sort_order: lineNo })
          .select("id")
          .single();
        const qteId = (qteIns as { id: string } | null)?.id ?? null;

        const matRows = rows.map((row) => {
          const m = matchLine(row.ref, row.name, row.qty, index);
          matNo += 1;
          const hasPrice = m.unit_rate != null && m.unit_rate !== 0;
          const lineTotal = hasPrice ? row.qty * (m.unit_rate as number) : null;
          const dstatus = displayStatus({ status: m.status, matched_item_id: m.matched_item_id, unit_rate: m.unit_rate });

          // Original cells, with price/total filled IN PLACE + stock/status set.
          const out: (string | number)[] = outHeaders.map((_, i) => row.cells[i] ?? "");
          out[priceCol] = hasPrice ? (m.unit_rate as number) : "";
          out[totalCol] = lineTotal != null ? lineTotal : "";
          out[stockCol] = m.in_stock_qty != null ? m.in_stock_qty : "";
          out[statutCol] = t(`materialStatuses.${dstatus}`);
          outRows.push(out);
          statusByRow.push(dstatus);

          return {
            project_id: projectId,
            qte_line_id: qteId,
            line_no: matNo,
            raw_name: row.name || row.ref,
            raw_ref: row.ref || m.matched_item?.sku || null,
            uom: row.uom || m.matched_item?.uom || null,
            qty: row.qty,
            matched_item_id: m.matched_item_id,
            unit_rate: m.unit_rate,
            in_stock_qty: m.in_stock_qty,
            status: m.status,
          };
        });
        const ins = await supabase.from("project_material_lines").insert(matRows);
        if (ins.error) {
          setErr(ins.error.message);
          return;
        }
      }

      // Enriched, colored .xlsx download (status cells tinted by availability).
      const mod = (await import("xlsx-js-style")) as unknown as Record<string, unknown>;
      const XLSXStyle = (mod.utils ? mod : mod.default) as unknown; // UMD may nest under .default
      const aoaOut: (string | number)[][] = [outHeaders, ...outRows];
      const xbuf = buildStyledXlsx(XLSXStyle, aoaOut, { sheetName: "QTE", statusCol: statutCol, statusByRow });
      downloadBlob(xbuf, xlsxName(project.code || project.name, "qte"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      // Auto-log a timeline step.
      await supabase.from("project_activities").insert({
        project_id: projectId,
        activity_type: "materials_imported",
        description: t("importSummaryGroups", { groups: groups.size, lines: outRows.length }),
      });
      load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setImporting(false);
    }
  }

  const matCols: Column<MaterialLine>[] = [
    { header: t("designation"), cell: (m) => <span className="font-medium text-ink">{m.raw_name}</span> },
    { header: t("reference"), cell: (m) => m.raw_ref ?? "—" },
    { header: t("requiredQty"), cell: (m) => <span className="tabular-nums">{m.qty}{m.uom ? ` ${m.uom}` : ""}</span> },
    { header: t("unitPrice"), className: "text-end", cell: (m) => <span className="tabular-nums">{money(m.unit_rate)}</span> },
    { header: t("inStock"), className: "text-end", cell: (m) => <span className="tabular-nums">{m.in_stock_qty == null ? "—" : m.in_stock_qty}</span> },
    { header: t("lineTotal"), className: "text-end", cell: (m) => <span className="tabular-nums">{m.unit_rate == null ? "—" : money(m.qty * m.unit_rate)}</span> },
    { header: t("lineStatus"), cell: (m) => { const d = displayStatus(m); return <Badge tone={MATERIAL_TONE[d]}>{t(`materialStatuses.${d}`)}</Badge>; } },
    { header: "", cell: (m) => <RowActions onEdit={() => openEditMat(m)} onDelete={() => delMat(m)} /> },
  ];

  function QteCard({ q }: { q: QteLine }) {
    const list = matsOf(q.id);
    const open = expanded[q.id] ?? true;
    const lineTotal = list.reduce((s, m) => s + (m.unit_rate != null ? m.qty * m.unit_rate : 0), 0);
    return (
      <div className="rounded-[14px] border border-line bg-white">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <button type="button" onClick={() => setExpanded((e) => ({ ...e, [q.id]: !open }))} className="text-ink-3 hover:text-ink">
            {open ? "▾" : "▸"}
          </button>
          <span className="font-semibold text-ink">{q.designation}</span>
          <span className="text-[13px] text-ink-3 tabular-nums">{q.qty}{q.uom ? ` ${q.uom}` : ""}</span>
          <span className="ms-2 text-[12px] text-ink-4">· {list.length} {t("materialsOf")}</span>
          <span className="ms-auto text-[13px] font-semibold tabular-nums text-ink">{money(lineTotal)}</span>
          <button type="button" onClick={() => openNewMat(q.id)} className="rounded-[8px] border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-2 hover:border-brand-100 hover:text-brand">
            + {t("addMaterial")}
          </button>
          <button type="button" disabled={busy || !list.length} onClick={() => autoPrice(q.id)} className="rounded-[8px] border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-2 hover:border-brand-100 hover:text-brand disabled:opacity-50">
            {t("autoPrice")}
          </button>
          <RowActions onEdit={() => openEditQte(q)} onDelete={() => delQte(q)} />
        </div>
        {open && (
          <div className="border-t border-line-2 px-2 pb-2">
            {list.length === 0 ? (
              <p className="px-2 py-3 text-[13px] text-ink-3">{t("noMaterialsLine")}</p>
            ) : (
              <ListTable columns={matCols} rows={list} getKey={(m) => m.id} />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{t("tabs.qte")}</h2>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <input ref={cdcRef} type="file" accept=".pdf,image/*" onChange={onCdc} className="hidden" />
          <button type="button" disabled={busy} onClick={() => cdcRef.current?.click()} className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand-100 hover:text-brand disabled:opacity-60">
            {t("cdcUpload")}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onFile} className="hidden" />
          <button type="button" disabled={importing} onClick={() => fileRef.current?.click()} className="rounded-[10px] border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand-100 hover:text-brand disabled:opacity-60">
            {importing ? t("importing") : t("importCsv")}
          </button>
          <button type="button" onClick={openNewQte} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]">
            + {t("addQteLine")}
          </button>
        </div>
      </div>
      {msg && <p className="text-[12px] text-ink-3">{msg}</p>}
      {err && <p className="text-[12px] text-red-600">{err}</p>}

      {qteLines.length === 0 && orphanMaterials.length === 0 ? (
        <p className="rounded-[12px] border border-line bg-white px-4 py-3 text-[13px] text-ink-3">{t("qteHint")}</p>
      ) : (
        <>
          {qteLines.map((q) => <QteCard key={q.id} q={q} />)}

          {/* Legacy flat materials (imported before QTE lines existed) */}
          {orphanMaterials.length > 0 && (
            <div className="rounded-[14px] border border-dashed border-line bg-white">
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="font-semibold text-ink">{t("ungroupedMaterials")}</span>
                <button type="button" disabled={busy} onClick={() => autoPrice(null)} className="ms-auto rounded-[8px] border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-2 hover:border-brand-100 hover:text-brand disabled:opacity-50">
                  {t("autoPrice")}
                </button>
              </div>
              <div className="border-t border-line-2 px-2 pb-2">
                <ListTable columns={matCols} rows={orphanMaterials} getKey={(m) => m.id} />
              </div>
            </div>
          )}
        </>
      )}

      {/* QTE line modal */}
      <Modal open={qteOpen} onClose={() => setQteOpen(false)} title={editingQte ? t("editQteLine") : t("addQteLine")}>
        <form onSubmit={submitQte} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("designation")}
            <input required autoFocus value={qteForm.designation} onChange={(e) => setQteForm({ ...qteForm, designation: e.target.value })} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("requiredQty")}
              <input type="number" step="0.001" value={qteForm.qty} onChange={(e) => setQteForm({ ...qteForm, qty: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("unit")}
              <input value={qteForm.uom} onChange={(e) => setQteForm({ ...qteForm, uom: e.target.value })} className={field} />
            </label>
          </div>
          <label className={labelCls}>
            {t("notes")}
            <textarea rows={2} value={qteForm.notes} onChange={(e) => setQteForm({ ...qteForm, notes: e.target.value })} className={field} />
          </label>
          <div className="mt-1 flex items-center gap-2">
            <button type="submit" disabled={busy || !qteForm.designation.trim()} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60">
              {busy ? tu("creating") : tu("save")}
            </button>
            <button type="button" onClick={() => setQteOpen(false)} className="rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-ink-2 hover:bg-line-2">
              {tu("cancel")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Material modal */}
      <Modal open={matOpen} onClose={() => setMatOpen(false)} title={editingMat ? t("editMaterial") : t("addMaterial")}>
        <form onSubmit={submitMat} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("matchedItem")}
            <select value={matForm.matched_item_id} onChange={(e) => onPickItem(e.target.value)} className={field}>
              <option value="">{t("noItemMatch")}</option>
              {items.map((it) => (<option key={it.id} value={it.id}>{it.name}{it.sku ? ` (${it.sku})` : ""}</option>))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              {t("designation")}
              <input required value={matForm.raw_name} onChange={(e) => setMatForm({ ...matForm, raw_name: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("reference")}
              <input value={matForm.raw_ref} onChange={(e) => setMatForm({ ...matForm, raw_ref: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("requiredQty")}
              <input type="number" step="0.001" value={matForm.qty} onChange={(e) => setMatForm({ ...matForm, qty: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("unit")}
              <input value={matForm.uom} onChange={(e) => setMatForm({ ...matForm, uom: e.target.value })} className={field} />
            </label>
            <label className={labelCls}>
              {t("unitPrice")}
              <input type="number" step="0.01" value={matForm.unit_rate} onChange={(e) => setMatForm({ ...matForm, unit_rate: e.target.value })} className={field} />
            </label>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <button type="submit" disabled={busy || !matForm.raw_name.trim()} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60">
              {busy ? tu("creating") : tu("save")}
            </button>
            <button type="button" onClick={() => setMatOpen(false)} className="rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-ink-2 hover:bg-line-2">
              {tu("cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
