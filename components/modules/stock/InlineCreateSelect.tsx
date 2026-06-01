"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";

export type Opt = { id: string; name: string };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100";

/** A select with an inline "+ New" that inserts a name-only row into `table`. */
export default function InlineCreateSelect({
  table,
  label,
  value,
  onChange,
  options,
  onCreated,
}: {
  table: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  onCreated: (o: Opt) => void;
}) {
  const t = useTranslations("ui");
  const supabase = createClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  async function add() {
    const n = name.trim();
    if (!n) return;
    const { data, error } = await supabase.from(table).insert({ name: n }).select("id,name").single();
    if (!error && data) {
      onCreated(data as Opt);
      onChange((data as Opt).id);
      setName("");
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
      {label}
      {adding ? (
        <div className="flex gap-2">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={`${field} flex-1`} />
          <button type="button" onClick={add} disabled={!name.trim()} className="shrink-0 rounded-[10px] bg-brand px-3 text-[13px] font-medium text-white disabled:opacity-60">
            {t("create")}
          </button>
          <button type="button" onClick={() => setAdding(false)} className="shrink-0 rounded-[10px] border border-line px-3 text-[13px] text-ink-2 hover:bg-line-2">
            {t("cancel")}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select value={value} onChange={(e) => onChange(e.target.value)} className={`${field} flex-1`}>
            <option value="">—</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setAdding(true)} className="shrink-0 rounded-[10px] border border-line px-3 text-[13px] font-medium text-brand hover:bg-line-2">
            + {t("new")}
          </button>
        </div>
      )}
    </div>
  );
}
