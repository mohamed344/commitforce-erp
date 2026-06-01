"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import InlineCreateSelect, { type Opt } from "./InlineCreateSelect";
import ItemExtras from "./ItemExtras";
import { UploadIcon } from "@/components/dashboard/icons";
import { useOptionSet } from "@/components/options/useOptionSet";

type Spec = { id?: string; label: string; value: string };
type Attr = { id: string; name: string };
type Val = { id: string; attribute_id: string; value: string };

const IMAGE_BUCKET = "item-images";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-line bg-white p-5">
      <h2 className="mb-4 text-[14px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function ItemForm({ itemId }: { itemId?: string }) {
  const t = useTranslations("stock");
  const tu = useTranslations("ui");
  const router = useRouter();
  const supabase = createClient();
  const { options: typeOptions } = useOptionSet("item_type");

  const [cats, setCats] = useState<Opt[]>([]);
  const [brands, setBrands] = useState<Opt[]>([]);
  const [uoms, setUoms] = useState<Opt[]>([]);
  const [attributes, setAttributes] = useState<Attr[]>([]);
  const [valuesByAttr, setValuesByAttr] = useState<Record<string, Val[]>>({});
  const [templates, setTemplates] = useState<Opt[]>([]);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    item_type: "template",
    template_id: "",
    category_id: "",
    brand_id: "",
    stock_uom_id: "",
    is_stock_item: true,
    description: "",
    image_url: "",
    manufacturer: "",
    manufacturer_part_no: "",
    barcode: "",
    weight_per_unit: "",
    has_batch_no: false,
    has_serial_no: false,
    reorder_level: "",
    reorder_qty: "",
    min_order_qty: "",
    valuation_rate: "",
    standard_buying_rate: "",
    standard_selling_rate: "",
  });
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);
  const [variantCount, setVariantCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product image: keep the stored URL, or replace it with a freshly uploaded file.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Stock quantity (per warehouse). Editing this posts an adjustment entry.
  const [whs, setWhs] = useState<Opt[]>([]);
  const [balByWh, setBalByWh] = useState<Map<string, number>>(new Map());
  const [stockWh, setStockWh] = useState("");
  const [qtyOnHand, setQtyOnHand] = useState("0");

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: b }, { data: u }, { data: a }, { data: v }, { data: tpl }, { data: w }] = await Promise.all([
        supabase.from("categories").select("id,name").order("name"),
        supabase.from("brands").select("id,name").order("name"),
        supabase.from("uoms").select("id,name").order("name"),
        supabase.from("item_attributes").select("id,name").order("name"),
        supabase.from("item_attribute_values").select("id,attribute_id,value").order("sort_order"),
        supabase.from("items").select("id,name").eq("item_type", "template").order("name"),
        supabase.from("warehouses").select("id,name").order("name"),
      ]);
      setCats((c as Opt[]) ?? []);
      setBrands((b as Opt[]) ?? []);
      setUoms((u as Opt[]) ?? []);
      setAttributes((a as Attr[]) ?? []);
      setTemplates((tpl as Opt[]) ?? []);
      const warehouses = (w as Opt[]) ?? [];
      setWhs(warehouses);
      const firstWh = warehouses[0]?.id ?? "";
      setStockWh(firstWh);
      const map: Record<string, Val[]> = {};
      ((v as Val[]) ?? []).forEach((row) => {
        (map[row.attribute_id] ??= []).push(row);
      });
      setValuesByAttr(map);

      if (itemId) {
        const { data: it } = await supabase.from("items").select("*").eq("id", itemId).single();
        if (it) {
          const r = it as Record<string, unknown>;
          setForm((f) => ({
            ...f,
            ...Object.fromEntries(
              Object.keys(f).map((k) => {
                const val = r[k];
                if (typeof f[k as keyof typeof f] === "boolean") return [k, !!val];
                return [k, val == null ? "" : String(val)];
              }),
            ),
          }) as typeof f);
          setImagePreview(r.image_url ? String(r.image_url) : null);
        }

        // Current on-hand per warehouse for this item (drives the quantity field).
        const { data: bal } = await supabase
          .from("stock_balances")
          .select("warehouse_id,qty")
          .eq("item_id", itemId);
        const byWh = new Map<string, number>();
        for (const row of (bal as { warehouse_id: string; qty: number }[]) ?? []) {
          byWh.set(row.warehouse_id, Number(row.qty));
        }
        setBalByWh(byWh);
        // Default to the warehouse that actually holds this item's stock (the
        // one with the largest balance), so the qty doesn't read 0 just because
        // the first warehouse alphabetically happens to be empty.
        let bestWh = firstWh;
        let bestQty = -Infinity;
        for (const wh of warehouses) {
          const q = byWh.get(wh.id) ?? 0;
          if (q > bestQty) {
            bestQty = q;
            bestWh = wh.id;
          }
        }
        setStockWh(bestWh);
        setQtyOnHand(String(byWh.get(bestWh) ?? 0));
        const [{ data: sp }, { data: ta }, { count }] = await Promise.all([
          supabase.from("item_specs").select("id,label,value").eq("item_id", itemId).order("sort_order"),
          supabase.from("template_attributes").select("attribute_id").eq("item_id", itemId),
          supabase.from("items").select("id", { count: "exact", head: true }).eq("template_id", itemId),
        ]);
        setSpecs(((sp as Spec[]) ?? []).map((s) => ({ id: s.id, label: s.label, value: s.value ?? "" })));
        setSelectedAttrs(((ta as { attribute_id: string }[]) ?? []).map((x) => x.attribute_id));
        setVariantCount(count ?? 0);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  function acceptImage(file: File | null) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t("imageHint"));
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setForm((f) => ({ ...f, image_url: "" }));
    if (fileRef.current) fileRef.current.value = "";
  }

  function onWarehouseChange(id: string) {
    setStockWh(id);
    setQtyOnHand(String(balByWh.get(id) ?? 0));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
    // Upload a freshly picked image and use its public URL.
    let imageUrl = form.image_url.trim();
    if (imageFile) {
      const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, imageFile, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      imageUrl = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      item_type: form.item_type,
      template_id: form.item_type === "variant" ? form.template_id || null : null,
      category_id: form.category_id || null,
      brand_id: form.brand_id || null,
      stock_uom_id: form.stock_uom_id || null,
      is_stock_item: form.is_stock_item,
      description: form.description.trim() || null,
      image_url: imageUrl || null,
      manufacturer: form.manufacturer.trim() || null,
      manufacturer_part_no: form.manufacturer_part_no.trim() || null,
      barcode: form.barcode.trim() || null,
      weight_per_unit: num(form.weight_per_unit),
      has_batch_no: form.has_batch_no,
      has_serial_no: form.has_serial_no,
      reorder_level: num(form.reorder_level),
      reorder_qty: num(form.reorder_qty),
      min_order_qty: num(form.min_order_qty),
      valuation_rate: num(form.valuation_rate),
      standard_buying_rate: num(form.standard_buying_rate),
      standard_selling_rate: num(form.standard_selling_rate),
    };

    let id = itemId;
    if (id) {
      const { error } = await supabase.from("items").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("items").insert(payload).select("id").single();
      if (error || !data) throw error ?? new Error("insert failed");
      id = (data as { id: string }).id;
    }

    // Quantity: post a stock adjustment for the delta vs the current on-hand
    // at the selected warehouse (receipt when increasing, issue when decreasing).
    if (stockWh) {
      const desired = Number(qtyOnHand || 0);
      const current = balByWh.get(stockWh) ?? 0;
      const delta = desired - current;
      if (Math.abs(delta) > 1e-9) {
        const isReceipt = delta > 0;
        const { data: ent, error: entErr } = await supabase
          .from("stock_entries")
          .insert({ entry_type: isReceipt ? "receipt" : "issue", reference: `ADJ-${payload.sku ?? payload.name}` })
          .select("id")
          .single();
        if (entErr) throw entErr;
        const entryId = (ent as { id: string }).id;
        const { error: lineErr } = await supabase.from("stock_entry_lines").insert({
          stock_entry_id: entryId,
          item_id: id,
          qty: Math.abs(delta),
          rate: payload.valuation_rate,
          source_warehouse_id: isReceipt ? null : stockWh,
          target_warehouse_id: isReceipt ? stockWh : null,
        });
        if (lineErr) throw lineErr;
      }
    }

    // specs: replace all
    await supabase.from("item_specs").delete().eq("item_id", id);
    const specRows = specs
      .filter((s) => s.label.trim())
      .map((s, i) => ({ item_id: id, label: s.label.trim(), value: s.value.trim() || null, sort_order: i }));
    if (specRows.length) await supabase.from("item_specs").insert(specRows);

    // template attributes: replace all (templates only)
    if (form.item_type === "template") {
      await supabase.from("template_attributes").delete().eq("item_id", id);
      if (selectedAttrs.length)
        await supabase.from("template_attributes").insert(selectedAttrs.map((aid) => ({ item_id: id, attribute_id: aid })));
    }

    router.push("/stock");
    router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function generateVariants() {
    if (!itemId) return;
    const chosen = attributes.filter((a) => selectedAttrs.includes(a.id));
    const lists = chosen.map((a) => valuesByAttr[a.id] ?? []);
    if (lists.some((l) => l.length === 0)) return;

    let combos: { attribute_id: string; value_id: string; value: string }[][] = [[]];
    chosen.forEach((a, idx) => {
      const next: typeof combos = [];
      combos.forEach((combo) => {
        lists[idx].forEach((val) => next.push([...combo, { attribute_id: a.id, value_id: val.id, value: val.value }]));
      });
      combos = next;
    });

    setBusy(true);
    for (const combo of combos) {
      const vname = `${form.name} - ${combo.map((c) => c.value).join(" / ")}`;
      const { data: v } = await supabase
        .from("items")
        .insert({
          name: vname,
          item_type: "variant",
          template_id: itemId,
          category_id: form.category_id || null,
          brand_id: form.brand_id || null,
          stock_uom_id: form.stock_uom_id || null,
        })
        .select("id")
        .single();
      const vid = (v as { id: string } | null)?.id;
      if (vid)
        await supabase
          .from("item_variant_attributes")
          .insert(combo.map((c) => ({ item_id: vid, attribute_id: c.attribute_id, attribute_value_id: c.value_id })));
    }
    setBusy(false);
    setVariantCount((n) => n + combos.length);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold text-ink">{itemId ? t("editItem") : t("newItem")}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push("/stock")} className="rounded-[10px] border border-line px-4 py-2 text-[14px] font-medium text-ink-2 hover:bg-line-2">
            {tu("cancel")}
          </button>
          <button type="submit" disabled={busy || !form.name.trim()} className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60">
            {busy ? tu("creating") : tu("save")}
          </button>
        </div>
      </div>

      {error && <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}

      {/* General */}
      <Section title={t("sections.general")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            {t("item") /* name */}
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          </label>
          <label className={labelCls}>
            {t("code")}
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={field} />
          </label>
          <label className={labelCls}>
            {tu("list") /* type */}
            <select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })} className={field}>
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {form.item_type === "variant" && (
            <label className={labelCls}>
              Template
              <select required value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })} className={field}>
                <option value="">—</option>
                {templates.filter((tp) => tp.id !== itemId).map((tp) => (
                  <option key={tp.id} value={tp.id}>{tp.name}</option>
                ))}
              </select>
            </label>
          )}
          <InlineCreateSelect table="categories" label={t("itemGroup")} value={form.category_id} onChange={(v) => setForm({ ...form, category_id: v })} options={cats} onCreated={(o) => setCats((p) => [...p, o])} />
          <InlineCreateSelect table="brands" label={t("brand")} value={form.brand_id} onChange={(v) => setForm({ ...form, brand_id: v })} options={brands} onCreated={(o) => setBrands((p) => [...p, o])} />
          <InlineCreateSelect table="uoms" label={t("stockUom")} value={form.stock_uom_id} onChange={(v) => setForm({ ...form, stock_uom_id: v })} options={uoms} onCreated={(o) => setUoms((p) => [...p, o])} />
          <div className={labelCls}>
            {t("image")}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              onChange={(e) => acceptImage(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            {imagePreview ? (
              <div className="flex items-center gap-3 rounded-[10px] border border-line bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="" className="h-14 w-14 shrink-0 rounded-[8px] border border-line-2 object-cover" />
                <div className="flex gap-3">
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-[12px] font-medium text-brand hover:underline">
                    {t("changeImage")}
                  </button>
                  <button type="button" onClick={removeImage} className="text-[12px] font-medium text-ink-3 hover:text-ink">
                    {t("removeImage")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-line px-3 py-3 text-[13px] text-ink-2 transition-colors hover:border-brand-100 hover:bg-line-2"
              >
                <UploadIcon /> {t("uploadImage")}
              </button>
            )}
            <span className="text-[11px] font-normal text-ink-4">{t("imageHint")}</span>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={form.is_stock_item} onChange={(e) => setForm({ ...form, is_stock_item: e.target.checked })} />
          {t("isStockItem")}
        </label>
        <label className={`${labelCls} mt-3`}>
          {t("notes")}
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
        </label>
      </Section>

      {/* Variants (templates only) */}
      {form.item_type === "template" && (
        <Section title={t("sections.variants")}>
          <p className="mb-2 text-[12px] text-ink-3">{t("selectAttributes")}</p>
          <div className="flex flex-wrap gap-2">
            {attributes.map((a) => {
              const on = selectedAttrs.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAttrs((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}
                  className={`rounded-full border px-3 py-1.5 text-[13px] ${on ? "border-brand bg-brand-50 text-brand" : "border-line text-ink-2 hover:bg-line-2"}`}
                >
                  {a.name} {valuesByAttr[a.id]?.length ? `(${valuesByAttr[a.id].length})` : ""}
                </button>
              );
            })}
            {attributes.length === 0 && <span className="text-[13px] text-ink-3">{tu("empty")}</span>}
          </div>
          {itemId ? (
            <div className="mt-4 flex items-center gap-3">
              <button type="button" onClick={generateVariants} disabled={busy || selectedAttrs.length === 0} className="rounded-[10px] border border-brand px-3.5 py-2 text-[13px] font-semibold text-brand hover:bg-brand-50 disabled:opacity-50">
                {t("generateVariants")}
              </button>
              <span className="text-[12px] text-ink-3">{t("variantsGenerated", { count: variantCount })}</span>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-ink-4">{tu("save")} →</p>
          )}
        </Section>
      )}

      {/* Specs */}
      <Section title={t("sections.specs")}>
        <div className="flex flex-col gap-2">
          {specs.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input placeholder={t("specLabel")} value={s.label} onChange={(e) => setSpecs((p) => p.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} className={`${field} flex-1`} />
              <input placeholder={t("specValue")} value={s.value} onChange={(e) => setSpecs((p) => p.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))} className={`${field} flex-1`} />
              <button type="button" onClick={() => setSpecs((p) => p.filter((_, idx) => idx !== i))} className="shrink-0 rounded-[10px] border border-line px-3 text-[13px] text-ink-3 hover:text-red-600">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setSpecs((p) => [...p, { label: "", value: "" }])} className="w-fit rounded-[10px] border border-line px-3 py-1.5 text-[13px] font-medium text-brand hover:bg-line-2">
            + {t("addSpec")}
          </button>
        </div>
      </Section>

      {/* Stock */}
      <Section title={t("sections.stock")}>
        {whs.length > 0 ? (
          <div className="mb-4 grid items-end gap-3 sm:grid-cols-3">
            <label className={labelCls}>
              {t("warehouse")}
              <select value={stockWh} onChange={(e) => onWarehouseChange(e.target.value)} className={field}>
                {whs.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t("onHand")}
              <input type="number" step="0.001" value={qtyOnHand} onChange={(e) => setQtyOnHand(e.target.value)} className={field} />
              <span className="text-[11px] font-normal text-ink-4">
                {t("currentHere", { qty: balByWh.get(stockWh) ?? 0 })}
                {whs.length > 1 && <> · {t("totalAllWh", { qty: Array.from(balByWh.values()).reduce((a, b) => a + b, 0) })}</>}
              </span>
            </label>
            <p className="pb-2 text-[11px] text-ink-4">{t("qtyHint")}</p>
          </div>
        ) : (
          <p className="mb-4 text-[12px] text-ink-4">{t("noWarehouses")}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelCls}>{t("reorderLevel")}<input type="number" step="0.01" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} className={field} /></label>
          <label className={labelCls}>{t("reorderQty")}<input type="number" step="0.01" value={form.reorder_qty} onChange={(e) => setForm({ ...form, reorder_qty: e.target.value })} className={field} /></label>
          <label className={labelCls}>{t("minOrderQty")}<input type="number" step="0.01" value={form.min_order_qty} onChange={(e) => setForm({ ...form, min_order_qty: e.target.value })} className={field} /></label>
        </div>
        <div className="mt-3 flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={form.has_batch_no} onChange={(e) => setForm({ ...form, has_batch_no: e.target.checked })} />{t("hasBatch")}</label>
          <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={form.has_serial_no} onChange={(e) => setForm({ ...form, has_serial_no: e.target.checked })} />{t("hasSerial")}</label>
        </div>
      </Section>

      {/* Pricing */}
      <Section title={t("sections.pricing")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelCls}>{t("valuationRate")}<input type="number" step="0.01" value={form.valuation_rate} onChange={(e) => setForm({ ...form, valuation_rate: e.target.value })} className={field} /></label>
          <label className={labelCls}>{t("buyingRate")}<input type="number" step="0.01" value={form.standard_buying_rate} onChange={(e) => setForm({ ...form, standard_buying_rate: e.target.value })} className={field} /></label>
          <label className={labelCls}>{t("sellingRate")}<input type="number" step="0.01" value={form.standard_selling_rate} onChange={(e) => setForm({ ...form, standard_selling_rate: e.target.value })} className={field} /></label>
        </div>
      </Section>

      {/* Manufacturer */}
      <Section title={t("sections.manufacturer")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>{t("manufacturer")}<input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className={field} /></label>
          <label className={labelCls}>{t("manufacturerPartNo")}<input value={form.manufacturer_part_no} onChange={(e) => setForm({ ...form, manufacturer_part_no: e.target.value })} className={field} /></label>
          <label className={labelCls}>{t("barcode")}<input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className={field} /></label>
          <label className={labelCls}>{t("weight")}<input type="number" step="0.001" value={form.weight_per_unit} onChange={(e) => setForm({ ...form, weight_per_unit: e.target.value })} className={field} /></label>
        </div>
      </Section>

      {/* Batches / serial numbers / price lists (existing items only) */}
      {itemId && <ItemExtras itemId={itemId} />}
    </form>
  );
}
