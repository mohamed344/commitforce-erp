"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import Modal from "@/components/data/Modal";
import Badge from "@/components/data/Badge";
import RowActions from "@/components/data/RowActions";
import { FormActions } from "@/components/modules/ProjectsView";
import {
  OPTION_DEFAULTS,
  SET_USAGE,
  TONES,
  slugify,
  type OptionSetKey,
} from "@/lib/options";

type Opt = { key: string; label: string; tone: string; is_default: boolean };

const field =
  "rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2 text-[14px] text-ink outline-none focus:border-brand-100 disabled:opacity-60";
const labelCls = "flex flex-col gap-1 text-[12px] font-medium text-ink-2";

export default function OptionSetView({
  setKey,
  isAdmin,
  title,
  description,
}: {
  setKey: OptionSetKey;
  isAdmin: boolean;
  title: string;
  description?: string;
}) {
  const t = useTranslations("settings.options");
  const tt = useTranslations("settings.tones");
  const tu = useTranslations("ui");
  const td = useTranslations();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const def = OPTION_DEFAULTS[setKey];

  const [opts, setOpts] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Add/edit modal
  const [open, setOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", tone: TONES[0] as string });

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("domain_options")
      .select("key,label,tone,is_default,sort_order")
      .eq("set_key", setKey)
      .order("sort_order");
    if (!err && data && data.length > 0) {
      setOpts(
        (data as Opt[]).map((r) => ({
          key: r.key,
          label: r.label,
          tone: r.tone ?? "gray",
          is_default: r.is_default,
        })),
      );
    } else {
      // Fall back to translated code defaults (not yet persisted).
      setOpts(
        def.options.map((o) => ({
          key: o.key,
          label: td(o.labelKey),
          tone: o.tone,
          is_default: o.key === def.defaultKey,
        })),
      );
    }
    setDirty(false);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setKey]);

  function mutate(next: Opt[]) {
    setOpts(next);
    setDirty(true);
    setSaved(false);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= opts.length) return;
    const next = [...opts];
    [next[i], next[j]] = [next[j], next[i]];
    mutate(next);
  }

  function setDefault(key: string) {
    mutate(opts.map((o) => ({ ...o, is_default: o.key === key })));
  }

  function openAdd() {
    setEditingKey(null);
    setForm({ label: "", tone: TONES[0] });
    setError(null);
    setOpen(true);
  }
  function openEdit(o: Opt) {
    setEditingKey(o.key);
    setForm({ label: o.label, tone: o.tone });
    setError(null);
    setOpen(true);
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const label = form.label.trim();
    if (!label) return;
    if (editingKey) {
      mutate(opts.map((o) => (o.key === editingKey ? { ...o, label, tone: form.tone } : o)));
    } else {
      let key = slugify(label);
      if (!key) key = `opt_${opts.length + 1}`;
      if (opts.some((o) => o.key === key)) {
        setError(t("keyExists"));
        return;
      }
      mutate([
        ...opts,
        { key, label, tone: form.tone, is_default: opts.length === 0 },
      ]);
    }
    setOpen(false);
  }

  async function remove(o: Opt) {
    setError(null);
    const usage = SET_USAGE[setKey];
    if (usage) {
      const { count } = await supabase
        .from(usage.table)
        .select("id", { count: "exact", head: true })
        .eq(usage.column, o.key);
      if (count && count > 0) {
        setError(t("inUse", { label: o.label, count }));
        return;
      }
    }
    let next = opts.filter((x) => x.key !== o.key);
    // Keep a default selected.
    if (o.is_default && next.length && !next.some((x) => x.is_default)) {
      next = next.map((x, i) => (i === 0 ? { ...x, is_default: true } : x));
    }
    mutate(next);
  }

  async function save() {
    if (!isAdmin || !opts.length) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    // Replace the whole set: delete then insert (keys are stable; domain rows
    // store the key, so this is safe and makes reorder/default trivial).
    const delRes = await supabase.from("domain_options").delete().eq("set_key", setKey);
    if (delRes.error) {
      setError(delRes.error.message);
      setBusy(false);
      return;
    }
    const insRes = await supabase.from("domain_options").insert(
      opts.map((o, i) => ({
        set_key: setKey,
        key: o.key,
        label: o.label,
        tone: o.tone,
        sort_order: i,
        is_default: o.is_default,
      })),
    );
    setBusy(false);
    if (insRes.error) {
      setError(insRes.error.message);
      return;
    }
    setDirty(false);
    setSaved(true);
    router.refresh();
  }

  if (loading) {
    return <div className="p-2 text-[14px] text-ink-3">{tu("loading")}</div>;
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[20px] font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-ink-3">{description}</p>}
      </div>

      {!isAdmin && (
        <p className="mb-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          {td("settings.adminOnly")}
        </p>
      )}

      <div className="rounded-[16px] border border-line bg-white">
        {/* rows */}
        <ul className="divide-y divide-line-2">
          {opts.map((o, i) => (
            <li key={o.key} className="flex items-center gap-3 px-4 py-3">
              {/* reorder */}
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={!isAdmin || i === 0}
                  onClick={() => move(i, -1)}
                  className="text-[12px] leading-none text-ink-3 hover:text-ink disabled:opacity-30"
                  aria-label={t("moveUp")}
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={!isAdmin || i === opts.length - 1}
                  onClick={() => move(i, 1)}
                  className="text-[12px] leading-none text-ink-3 hover:text-ink disabled:opacity-30"
                  aria-label={t("moveDown")}
                >
                  ▼
                </button>
              </div>

              <Badge tone={o.tone}>{o.label}</Badge>
              <code className="text-[11px] text-ink-4">{o.key}</code>

              {/* default radio */}
              <label className="ms-auto flex items-center gap-1.5 text-[12px] text-ink-2">
                <input
                  type="radio"
                  name={`default-${setKey}`}
                  checked={o.is_default}
                  disabled={!isAdmin}
                  onChange={() => setDefault(o.key)}
                />
                {t("default")}
              </label>

              {isAdmin && (
                <RowActions
                  onEdit={() => openEdit(o)}
                  onDelete={def.open ? () => remove(o) : undefined}
                />
              )}
            </li>
          ))}
        </ul>

        {def.open && isAdmin && (
          <div className="border-t border-line-2 px-4 py-3">
            <button
              type="button"
              onClick={openAdd}
              className="text-[13px] font-medium text-brand hover:underline"
            >
              + {t("addOption")}
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}

      {isAdmin && (
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={save}
            className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-5 py-2.5 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
          >
            {busy ? td("settings.saving") : td("settings.save")}
          </button>
          {saved && <span className="text-[13px] font-medium text-brand">{td("settings.saved")}</span>}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingKey ? t("editOption") : t("addOption")}
      >
        <form onSubmit={submitForm} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("label")}
            <input
              required
              autoFocus
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className={field}
            />
          </label>
          <label className={labelCls}>
            {t("color")}
            <div className="flex items-center gap-2.5">
              <select
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
                className={`${field} flex-1`}
              >
                {TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {tt(tone)}
                  </option>
                ))}
              </select>
              <Badge tone={form.tone}>{form.label.trim() || t("preview")}</Badge>
            </div>
          </label>
          <FormActions
            busy={false}
            onCancel={() => setOpen(false)}
            disabled={!form.label.trim()}
          />
        </form>
      </Modal>
    </div>
  );
}
