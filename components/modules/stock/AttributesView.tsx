"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import ListTable, { type Column } from "@/components/data/ListTable";
import Modal from "@/components/data/Modal";
import RowActions from "@/components/data/RowActions";
import { FormActions } from "@/components/modules/ProjectsView";

type Attr = { id: string; name: string };
type Val = { id?: string; value: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";

export default function AttributesView() {
  const t = useTranslations("stock");
  const supabase = createClient();
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Attr | null>(null);
  const [name, setName] = useState("");
  const [vals, setVals] = useState<Val[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  const [newVal, setNewVal] = useState("");

  async function load() {
    const [{ data: a }, { data: v }] = await Promise.all([
      supabase.from("item_attributes").select("id,name").order("name"),
      supabase.from("item_attribute_values").select("attribute_id"),
    ]);
    setAttrs((a as Attr[]) ?? []);
    const c: Record<string, number> = {};
    ((v as { attribute_id: string }[]) ?? []).forEach((row) => {
      c[row.attribute_id] = (c[row.attribute_id] ?? 0) + 1;
    });
    setCounts(c);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setEditing(null);
    setName("");
    setVals([]);
    setDeleted([]);
    setNewVal("");
    setOpen(true);
  }
  async function openEdit(a: Attr) {
    setEditing(a);
    setName(a.name);
    setDeleted([]);
    setNewVal("");
    const { data } = await supabase
      .from("item_attribute_values")
      .select("id,value,sort_order")
      .eq("attribute_id", a.id)
      .order("sort_order");
    setVals(((data as { id: string; value: string }[]) ?? []).map((r) => ({ id: r.id, value: r.value })));
    setOpen(true);
  }

  function addLocalValue() {
    const v = newVal.trim();
    if (!v) return;
    setVals((vs) => [...vs, { value: v }]);
    setNewVal("");
  }
  function removeValue(i: number) {
    const v = vals[i];
    if (v.id) setDeleted((d) => [...d, v.id!]);
    setVals((vs) => vs.filter((_, idx) => idx !== i));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let attrId = editing?.id;
    if (editing) {
      await supabase.from("item_attributes").update({ name: name.trim() }).eq("id", editing.id);
    } else {
      const { data } = await supabase.from("item_attributes").insert({ name: name.trim() }).select("id").single();
      attrId = (data as { id: string } | null)?.id;
    }
    if (attrId) {
      if (deleted.length) await supabase.from("item_attribute_values").delete().in("id", deleted);
      const toInsert = vals
        .filter((v) => !v.id)
        .map((v, i) => ({ attribute_id: attrId, value: v.value, sort_order: i }));
      if (toInsert.length) await supabase.from("item_attribute_values").insert(toInsert);
    }
    setBusy(false);
    setOpen(false);
    load();
  }

  async function del(a: Attr) {
    await supabase.from("item_attributes").delete().eq("id", a.id);
    load();
  }

  const cols: Column<Attr>[] = [
    { header: t("name"), cell: (r) => <span className="font-medium text-ink">{r.name}</span> },
    { header: t("values"), cell: (r) => counts[r.id] ?? 0 },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.03]"
        >
          + {t("tabs.attributes")}
        </button>
      </div>

      <ListTable
        columns={cols}
        rows={attrs}
        getKey={(r) => r.id}
        onRowClick={openEdit}
        actions={(r) => <RowActions onEdit={() => openEdit(r)} onDelete={() => del(r)} />}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={t("tabs.attributes")}>
        <form onSubmit={save} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
            {t("name")}
            <input required value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Couleur, Calibre…" />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink-2">{t("values")}</span>
            {vals.map((v, i) => (
              <div key={v.id ?? `new-${i}`} className="flex items-center gap-2">
                <span className="flex-1 rounded-[8px] bg-line-2 px-3 py-1.5 text-[13px] text-ink">{v.value}</span>
                <button type="button" onClick={() => removeValue(i)} className="text-[12px] text-ink-3 hover:text-red-600">
                  {t("delete")}
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLocalValue();
                  }
                }}
                placeholder={t("value")}
                className={`${field} flex-1`}
              />
              <button type="button" onClick={addLocalValue} disabled={!newVal.trim()} className="shrink-0 rounded-[10px] border border-line px-3 text-[13px] font-medium text-brand hover:bg-line-2 disabled:opacity-50">
                + {t("addValue")}
              </button>
            </div>
          </div>

          <FormActions busy={busy} onCancel={() => setOpen(false)} disabled={!name.trim()} />
        </form>
      </Modal>
    </div>
  );
}
