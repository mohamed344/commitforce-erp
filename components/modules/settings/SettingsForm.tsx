"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { moduleCatalog } from "@/config/modules";
import type { ModuleKey } from "@/lib/config";
import { UploadIcon } from "@/components/dashboard/icons";

const LOGO_BUCKET = "company-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Curated Google fonts offered in the picker (Arabic-friendly ones included). */
const FONT_OPTIONS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Work Sans",
  "Source Sans 3",
  "Manrope",
  "IBM Plex Sans",
  "Cairo",
  "Tajawal",
];

export type SettingsInitial = {
  companyId: string | null;
  appName: string;
  enterprise: { name: string; short: string; email: string; logoUrl: string };
  brand: { color: string; colorDark: string };
  font: { family: string };
  defaultLocale: string;
  locales: string[];
  defaultCurrency: string;
  lowStockThreshold: number;
  modules: Record<ModuleKey, boolean>;
};

/** Derive the brand tints exactly as app/layout.tsx does, for live preview. */
function applyThemePreview(color: string, colorDark: string, family: string) {
  const root = document.documentElement.style;
  root.setProperty("--brand", color);
  root.setProperty("--brand-700", colorDark);
  root.setProperty("--brand-50", `color-mix(in srgb, ${color} 10%, white)`);
  root.setProperty("--brand-100", `color-mix(in srgb, ${color} 22%, white)`);
  root.setProperty("--font-sans", `'${family}', system-ui, sans-serif`);
}

function clearThemePreview() {
  const root = document.documentElement.style;
  for (const v of ["--brand", "--brand-700", "--brand-50", "--brand-100", "--font-sans"]) {
    root.removeProperty(v);
  }
}

export default function SettingsForm({
  initial,
  isAdmin,
}: {
  initial: SettingsInitial;
  isAdmin: boolean;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("company");
  const tm = useTranslations("modules");
  const tl = useTranslations("locale");
  const router = useRouter();
  const supabase = createClient();

  // Editable state
  const [brandColor, setBrandColor] = useState(initial.brand.color);
  const [brandColorDark, setBrandColorDark] = useState(initial.brand.colorDark);
  const [fontFamily, setFontFamily] = useState(initial.font.family);
  const [appName, setAppName] = useState(initial.appName);
  const [entName, setEntName] = useState(initial.enterprise.name);
  const [entShort, setEntShort] = useState(initial.enterprise.short);
  const [entEmail, setEntEmail] = useState(initial.enterprise.email);
  const [defaultLocale, setDefaultLocale] = useState(initial.defaultLocale);
  const [defaultCurrency, setDefaultCurrency] = useState(initial.defaultCurrency);
  const [lowStockThreshold, setLowStockThreshold] = useState(String(initial.lowStockThreshold));
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>(initial.modules);

  // Logo: keep the current URL, or replace it with a freshly uploaded file.
  const [logoUrl, setLogoUrl] = useState(initial.enterprise.logoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.enterprise.logoUrl || null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Live theme preview while editing; restored when leaving the page.
  useEffect(() => {
    applyThemePreview(brandColor, brandColorDark, fontFamily);
    return () => clearThemePreview();
  }, [brandColor, brandColorDark, fontFamily]);

  function acceptFile(file: File | null) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_LOGO_BYTES) {
      setError(tc("logoHint"));
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoUrl("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function toggleModule(key: ModuleKey) {
    if (key === "settings") return; // control panel stays reachable
    setModules((m) => ({ ...m, [key]: !m[key] }));
  }

  /** "" → null so the column falls back to the env default. */
  const orNull = (v: string) => {
    const s = v.trim();
    return s ? s : null;
  };

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !initial.companyId) return;
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      // 1) Upload a new logo if one was picked.
      let finalLogoUrl = logoUrl;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(LOGO_BUCKET)
          .upload(path, logoFile, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        finalLogoUrl = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
      }

      // 2) Upsert the single settings row (NULL = fall back to env default).
      const { error: setErr } = await supabase.from("company_settings").upsert(
        {
          company_id: initial.companyId,
          brand_color: orNull(brandColor),
          brand_color_dark: orNull(brandColorDark),
          font_family: orNull(fontFamily),
          app_name: orNull(appName),
          enterprise_name: orNull(entName),
          enterprise_short: orNull(entShort),
          enterprise_email: orNull(entEmail),
          logo_url: orNull(finalLogoUrl),
          default_locale: orNull(defaultLocale),
          default_currency: orNull(defaultCurrency),
        },
        { onConflict: "company_id" },
      );
      if (setErr) throw setErr;

      // 3) Upsert module toggles.
      const rows = (Object.keys(modules) as ModuleKey[]).map((key) => ({
        company_id: initial.companyId,
        module_key: key,
        enabled: modules[key],
      }));
      const { error: modErr } = await supabase
        .from("company_modules")
        .upsert(rows, { onConflict: "company_id,module_key" });
      if (modErr) throw modErr;

      // 4) Low-stock threshold — separate, tolerant write so the rest of the
      //    save still succeeds if migration 30 hasn't been applied yet.
      const parsedThreshold = Math.max(0, Math.floor(Number(lowStockThreshold) || 0));
      const { error: thErr } = await supabase
        .from("company_settings")
        .update({ low_stock_threshold: parsedThreshold })
        .eq("company_id", initial.companyId);
      if (thErr && !/low_stock_threshold|column|schema cache/i.test(thErr.message)) throw thErr;

      setLogoUrl(finalLogoUrl);
      setLogoFile(null);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "rounded-[10px] border border-line bg-[#f6f6f8] px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brand-100 disabled:opacity-60";
  const labelCls = "flex flex-col gap-1.5 text-[12px] font-medium text-ink-2";
  const disabled = !isAdmin || busy;

  return (
    <div>
      <p className="text-[13px] text-ink-3">{t("subtitle")}</p>

      {!isAdmin && (
        <p className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          {t("adminOnly")}
        </p>
      )}

      <form onSubmit={onSave} className="mt-6 flex flex-col gap-7">
        {/* ── Branding & theme ───────────────────────────────── */}
        <Section title={t("sections.branding")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label={t("brandColor")}
              value={brandColor}
              onChange={setBrandColor}
              disabled={disabled}
            />
            <ColorField
              label={t("brandColorDark")}
              value={brandColorDark}
              onChange={setBrandColorDark}
              disabled={disabled}
            />
            <label className={labelCls}>
              {t("font")}
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                disabled={disabled}
                className={field}
              >
                {(FONT_OPTIONS.includes(fontFamily) ? FONT_OPTIONS : [fontFamily, ...FONT_OPTIONS]).map(
                  (f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        </Section>

        {/* ── Identity & logo ────────────────────────────────── */}
        <Section title={t("sections.identity")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              {t("appName")}
              <input value={appName} onChange={(e) => setAppName(e.target.value)} disabled={disabled} className={field} />
            </label>
            <label className={labelCls}>
              {t("enterpriseName")}
              <input value={entName} onChange={(e) => setEntName(e.target.value)} disabled={disabled} className={field} />
            </label>
            <label className={labelCls}>
              {t("enterpriseShort")}
              <input
                value={entShort}
                onChange={(e) => setEntShort(e.target.value)}
                disabled={disabled}
                maxLength={4}
                className={field}
              />
            </label>
            <label className={labelCls}>
              {t("enterpriseEmail")}
              <input
                type="email"
                value={entEmail}
                onChange={(e) => setEntEmail(e.target.value)}
                disabled={disabled}
                className={field}
              />
            </label>
          </div>

          {/* Logo upload (mirrors the new-company flow) */}
          <div className={`${labelCls} mt-4`}>
            {t("logo")}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
              disabled={disabled}
              className="hidden"
            />
            {logoPreview ? (
              <div className="flex items-center gap-3 rounded-[14px] border border-line bg-white p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreview}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-[12px] border border-line-2 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">
                    {logoFile?.name ?? t("currentLogo")}
                  </div>
                  {!disabled && (
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="text-[12px] font-medium text-brand hover:underline"
                      >
                        {tc("change")}
                      </button>
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="text-[12px] font-medium text-ink-3 hover:text-ink"
                      >
                        {tc("remove")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-line px-4 py-7 text-center transition-colors hover:border-brand-100 hover:bg-line-2 disabled:opacity-60"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand">
                  <UploadIcon />
                </span>
                <span className="text-[13px] font-medium text-ink-2">{tc("dropLogo")}</span>
                <span className="text-[11px] text-ink-4">{tc("logoHint")}</span>
              </button>
            )}
          </div>
        </Section>

        {/* ── Modules ────────────────────────────────────────── */}
        <Section title={t("sections.modules")}>
          <div className="grid gap-2 sm:grid-cols-2">
            {moduleCatalog.map((m) => {
              const on = modules[m.key];
              const locked = m.key === "settings";
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={disabled || locked}
                  onClick={() => toggleModule(m.key)}
                  className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-white px-3.5 py-2.5 text-start disabled:opacity-60"
                >
                  <span className="flex items-center gap-2.5 text-[13.5px] text-ink">
                    <m.Icon width={18} height={18} className="shrink-0 text-ink-3" />
                    {tm(m.key)}
                  </span>
                  <Switch on={on} />
                </button>
              );
            })}
          </div>
        </Section>

        {/* ── Localization ───────────────────────────────────── */}
        <Section title={t("sections.localization")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              {t("defaultLanguage")}
              <select
                value={defaultLocale}
                onChange={(e) => setDefaultLocale(e.target.value)}
                disabled={disabled}
                className={field}
              >
                {initial.locales.map((l) => (
                  <option key={l} value={l}>
                    {tl(l)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              {t("defaultCurrency")}
              <input
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
                disabled={disabled}
                maxLength={6}
                className={field}
              />
            </label>
          </div>
        </Section>

        {/* ── Inventory ──────────────────────────────────────── */}
        <Section title={t("sections.inventory")}>
          <label className={labelCls}>
            {t("lowStockThreshold")}
            <input
              type="number"
              min="0"
              step="1"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              disabled={disabled}
              className={`${field} sm:max-w-[220px]`}
            />
            <span className="text-[11px] font-normal text-ink-4">{t("lowStockThresholdHint")}</span>
          </label>
        </Section>

        {error && <p className="text-[12px] text-red-600">{error}</p>}

        {isAdmin && (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-5 py-2.5 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
            >
              {busy ? t("saving") : t("save")}
            </button>
            {saved && <span className="text-[13px] font-medium text-brand">{t("saved")}</span>}
          </div>
        )}
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border border-line bg-white p-5 sm:p-6">
      <h2 className="mb-4 text-[15px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-2">
      {label}
      <span className="flex items-center gap-2.5 rounded-[10px] border border-line bg-[#f6f6f8] px-3 py-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-7 w-9 shrink-0 rounded border border-line bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full bg-transparent text-[13px] text-ink outline-none disabled:opacity-60"
        />
      </span>
    </label>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${
        on ? "bg-brand" : "bg-line"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${
          on ? "start-[18px]" : "start-[2px]"
        }`}
      />
    </span>
  );
}
