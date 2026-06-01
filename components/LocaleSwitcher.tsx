"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { config, LOCALE_COOKIE } from "@/lib/config";
import { CheckIcon, GlobeIcon } from "@/components/dashboard/icons";

/**
 * Language picker rendered inside the user menu. Writes the NEXT_LOCALE
 * cookie and refreshes so the server re-renders with the new locale (and
 * <html dir> flips for RTL).
 */
export default function LocaleSwitcher() {
  const active = useLocale();
  const tMenu = useTranslations("menu");
  const tLocale = useTranslations("locale");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (config.i18n.locales.length < 2) return null;

  function selectLocale(locale: string) {
    if (locale === active) return;
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-4">
        {tMenu("language")}
      </div>
      {config.i18n.locales.map((locale) => {
        const current = locale === active;
        return (
          <button
            key={locale}
            type="button"
            disabled={isPending}
            onClick={() => selectLocale(locale)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-line-2 disabled:opacity-60 ${
              current ? "font-semibold text-ink" : "text-ink-2"
            }`}
          >
            <span className="grid place-items-center text-ink-3">
              <GlobeIcon />
            </span>
            {tLocale(locale)}
            {current && (
              <span className="ms-auto text-brand">
                <CheckIcon />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
