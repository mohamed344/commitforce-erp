/**
 * Central, env-driven configuration for the ERP shell.
 *
 * Every branding/modular setting is controlled through NEXT_PUBLIC_* env vars
 * (see .env.example) and read here once, with defaults that reproduce the
 * original IMAB design. Import `config` anywhere instead of touching
 * process.env directly.
 */

export type ModuleKey =
  | "stock"
  | "sales"
  | "crm"
  | "production"
  | "projects"
  | "hr"
  | "reports"
  | "settings";

/** Parse a "true"/"false"/"1"/"0" env string into a boolean. */
export function parseBool(value: string | undefined, fallback = false): boolean {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function str(value: string | undefined, fallback: string): string {
  const v = value?.trim();
  return v ? v : fallback;
}

const defaultLocale = str(process.env.NEXT_PUBLIC_DEFAULT_LOCALE, "fr");
const locales = str(process.env.NEXT_PUBLIC_LOCALES, "fr,en,ar")
  .split(",")
  .map((l) => l.trim())
  .filter(Boolean);

export const config = {
  appName: str(process.env.NEXT_PUBLIC_APP_NAME, "IMAB ERP"),
  appVersion: str(process.env.NEXT_PUBLIC_APP_VERSION, "0.1.0"),

  enterprise: {
    name: str(process.env.NEXT_PUBLIC_ENTERPRISE_NAME, "IMAB Engineering"),
    short: str(process.env.NEXT_PUBLIC_ENTERPRISE_SHORT, "IM"),
    email: str(process.env.NEXT_PUBLIC_ENTERPRISE_EMAIL, "admin@imab-engineering.dz"),
    logoUrl: str(process.env.NEXT_PUBLIC_LOGO_URL, ""),
  },

  brand: {
    color: str(process.env.NEXT_PUBLIC_BRAND_COLOR, "#16a34a"),
    colorDark: str(process.env.NEXT_PUBLIC_BRAND_COLOR_DARK, "#0f7235"),
  },

  font: {
    family: str(process.env.NEXT_PUBLIC_FONT_FAMILY, "Inter"),
  },

  i18n: {
    defaultLocale,
    locales: locales.length ? locales : [defaultLocale],
  },

  modules: {
    stock: parseBool(process.env.NEXT_PUBLIC_MODULE_STOCK),
    sales: parseBool(process.env.NEXT_PUBLIC_MODULE_SALES),
    crm: parseBool(process.env.NEXT_PUBLIC_MODULE_CRM),
    production: parseBool(process.env.NEXT_PUBLIC_MODULE_PRODUCTION),
    projects: parseBool(process.env.NEXT_PUBLIC_MODULE_PROJECTS),
    hr: parseBool(process.env.NEXT_PUBLIC_MODULE_HR),
    reports: parseBool(process.env.NEXT_PUBLIC_MODULE_REPORTS),
    settings: parseBool(process.env.NEXT_PUBLIC_MODULE_SETTINGS),
  } satisfies Record<ModuleKey, boolean>,
} as const;

export type AppConfig = typeof config;

/** RTL locales — used to set <html dir>. */
export const RTL_LOCALES = ["ar", "he", "fa", "ur"];
export const isRtlLocale = (locale: string) => RTL_LOCALES.includes(locale);

/** Cookie that stores the active locale (written by the LocaleSwitcher). */
export const LOCALE_COOKIE = "NEXT_LOCALE";
