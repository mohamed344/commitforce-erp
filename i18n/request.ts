import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { config, LOCALE_COOKIE } from "../lib/config";

/**
 * next-intl "without i18n routing" mode: the active locale comes from the
 * NEXT_LOCALE cookie, falling back to the env-configured default. The
 * LocaleSwitcher writes that cookie.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale =
    cookieLocale && config.i18n.locales.includes(cookieLocale)
      ? cookieLocale
      : config.i18n.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
