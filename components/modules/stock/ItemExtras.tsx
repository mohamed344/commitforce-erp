"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";

type Batch = { id: string; batch_no: string; expiry_date: string | null };
type Serial = { id: string; serial_no: string; status: string };
type Price = { id: string; rate: number; min_qty: number; price_list: { name: string } | null };
type Opt = { id: string; name: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[13px] text-ink outline-none focus:border-brand-100";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-line bg-white p-5">
      <h2 className="mb-3 text-[14px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function ItemExtras({ itemId }: { itemId: string }) {
  const t = useTranslations("stock");
  const tu = useTranslations("ui");
  const supabase = createClient();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [serials, setSerials] = useState<Serial[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [priceLists, setPriceLists] = useState<Opt[]>([]);

  const [batch, setBatch] = useState({ batch_no: "", expiry_date: "" });
  const [serial, setSerial] = useState("");
  const [price, setPrice] = useState({ price_list_id: "", rate: "", min_qty: "0" });
  const [newPl, setNewPl] = useState("");

  async function load() {
    const [{ data: b }, { data: s }, { data: p }, { data: pl }] = await Promise.all([
      supabase.from("batches").select("id,batch_no,expiry_date").eq("item_id", itemId).order("batch_no"),
      supabase.from("serial_nos").select("id,serial_no,status").eq("item_id", itemId).order("serial_no"),
      supabase.from("item_prices").select("id,rate,min_qty, price_list:price_lists(name)").eq("item_id", itemId),
      supabase.from("price_lists").select("id,name").order("name"),
    ]);
    setBatches((b as Batch[]) ?? []);
    setSerials((s as Serial[]) ?? []);
    setPrices((p as unknown as Price[]) ?? []);
    setPriceLists((pl as Opt[]) ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function addBatch() {
    if (!batch.batch_no.trim()) return;
    await supabase.from("batches").insert({ item_id: itemId, batch_no: batch.batch_no.trim(), expiry_date: batch.expiry_date || null });
    setBatch({ batch_no: "", expiry_date: "" });
    load();
  }
  async function addSerial() {
    if (!serial.trim()) return;
    await supabase.from("serial_nos").insert({ item_id: itemId, serial_no: serial.trim() });
    setSerial("");
    load();
  }
  async function addPriceList() {
    const n = newPl.trim();
    if (!n) return;
    const { data } = await supabase.from("price_lists").insert({ name: n }).select("id,name").single();
    if (data) {
      setPriceLists((p) => [...p, data as Opt]);
      setPrice((pr) => ({ ...pr, price_list_id: (data as Opt).id }));
      setNewPl("");
    }
  }
  async function addPrice() {
    if (!price.price_list_id || !price.rate) return;
    await supabase.from("item_prices").insert({
      item_id: itemId,
      price_list_id: price.price_list_id,
      rate: Number(price.rate),
      min_qty: Number(price.min_qty || 0),
    });
    setPrice({ price_list_id: "", rate: "", min_qty: "0" });
    load();
  }
  async function delFrom(table: string, id: string) {
    await supabase.from(table).delete().eq("id", id);
    load();
  }

  const delBtn = (table: string, id: string) => (
    <button type="button" onClick={() => delFrom(table, id)} className="text-[12px] text-ink-3 hover:text-red-600">✕</button>
  );

  return (
    <>
      <Section title={t("hasBatch")}>
        <div className="flex flex-col gap-1.5">
          {batches.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-[13px] text-ink-2">
              <span className="flex-1">{b.batch_no}{b.expiry_date ? ` · ${b.expiry_date}` : ""}</span>
              {delBtn("batches", b.id)}
            </div>
          ))}
          <div className="flex gap-2">
            <input placeholder={t("batchNo")} value={batch.batch_no} onChange={(e) => setBatch({ ...batch, batch_no: e.target.value })} className={`${field} flex-1`} />
            <input type="date" value={batch.expiry_date} onChange={(e) => setBatch({ ...batch, expiry_date: e.target.value })} className={field} />
            <button type="button" onClick={addBatch} disabled={!batch.batch_no.trim()} className="shrink-0 rounded-[10px] border border-line px-3 text-[13px] font-medium text-brand hover:bg-line-2 disabled:opacity-50">+ {tu("add")}</button>
          </div>
        </div>
      </Section>

      <Section title={t("hasSerial")}>
        <div className="flex flex-col gap-1.5">
          {serials.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-[13px] text-ink-2">
              <span className="flex-1">{s.serial_no} · {s.status}</span>
              {delBtn("serial_nos", s.id)}
            </div>
          ))}
          <div className="flex gap-2">
            <input placeholder={t("serialNo")} value={serial} onChange={(e) => setSerial(e.target.value)} className={`${field} flex-1`} />
            <button type="button" onClick={addSerial} disabled={!serial.trim()} className="shrink-0 rounded-[10px] border border-line px-3 text-[13px] font-medium text-brand hover:bg-line-2 disabled:opacity-50">+ {tu("add")}</button>
          </div>
        </div>
      </Section>

      <Section title={t("priceList")}>
        <div className="flex flex-col gap-1.5">
          {prices.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-[13px] text-ink-2">
              <span className="flex-1">{p.price_list?.name ?? "—"} · {p.rate}{p.min_qty ? ` (≥${p.min_qty})` : ""}</span>
              {delBtn("item_prices", p.id)}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <select value={price.price_list_id} onChange={(e) => setPrice({ ...price, price_list_id: e.target.value })} className={`${field} min-w-[120px] flex-1`}>
              <option value="">{t("priceList")}</option>
              {priceLists.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
            </select>
            <input type="number" step="0.01" placeholder={t("price")} value={price.rate} onChange={(e) => setPrice({ ...price, rate: e.target.value })} className={`${field} w-28`} />
            <input type="number" step="0.01" placeholder={t("minQty")} value={price.min_qty} onChange={(e) => setPrice({ ...price, min_qty: e.target.value })} className={`${field} w-24`} />
            <button type="button" onClick={addPrice} disabled={!price.price_list_id || !price.rate} className="shrink-0 rounded-[10px] border border-line px-3 text-[13px] font-medium text-brand hover:bg-line-2 disabled:opacity-50">+ {tu("add")}</button>
          </div>
          <div className="flex gap-2">
            <input placeholder={t("priceList")} value={newPl} onChange={(e) => setNewPl(e.target.value)} className={`${field} flex-1`} />
            <button type="button" onClick={addPriceList} disabled={!newPl.trim()} className="shrink-0 rounded-[10px] border border-line px-3 text-[12px] font-medium text-ink-3 hover:bg-line-2 disabled:opacity-50">+ {t("priceList")}</button>
          </div>
        </div>
      </Section>
    </>
  );
}
