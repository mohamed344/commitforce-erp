"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { OPTION_DEFAULTS, type OptionSetKey } from "@/lib/options";

export type ResolvedOption = {
  value: string;
  label: string;
  tone: string;
  isDefault: boolean;
};

type DbRow = {
  key: string;
  label: string;
  tone: string | null;
  sort_order: number;
  is_default: boolean;
};

/**
 * Resolve a domain option set for the active company: the per-company
 * `domain_options` rows if any exist, otherwise the code defaults from
 * lib/options.ts (with translated labels). Tolerates the table not existing
 * yet (migration 24 not applied) by falling back to defaults.
 */
export function useOptionSet(setKey: OptionSetKey) {
  const t = useTranslations();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<DbRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("domain_options")
        .select("key,label,tone,sort_order,is_default")
        .eq("set_key", setKey)
        .order("sort_order");
      setRows(error ? [] : ((data as DbRow[]) ?? []));
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [supabase, setKey]);

  useEffect(() => {
    load();
  }, [load]);

  const def = OPTION_DEFAULTS[setKey];

  const options: ResolvedOption[] = useMemo(() => {
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        value: r.key,
        label: r.label,
        tone: r.tone ?? "gray",
        isDefault: r.is_default,
      }));
    }
    // Fall back to code defaults with translated labels.
    return def.options.map((o) => ({
      value: o.key,
      label: t(o.labelKey),
      tone: o.tone,
      isDefault: o.key === def.defaultKey,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, setKey]);

  const byValue = useMemo(() => {
    const m = new Map<string, ResolvedOption>();
    for (const o of options) m.set(o.value, o);
    return m;
  }, [options]);

  const defaultValue =
    options.find((o) => o.isDefault)?.value ?? options[0]?.value ?? def.defaultKey;

  return { options, byValue, defaultValue, loading, reload: load };
}
