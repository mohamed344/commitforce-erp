import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { isRtlLocale } from "@/lib/config";
import { getEffectiveSettings } from "@/lib/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getEffectiveSettings();
  return {
    title: s.appName,
    description: `${s.appName} — ${s.enterprise.name}`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  // Effective (DB > env) branding drives the theme tokens at runtime.
  const s = await getEffectiveSettings();
  const family = s.font.family;
  const fontHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  ).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;

  // Override the design tokens at runtime; brand tints are derived from the
  // brand color so re-branding stays coherent.
  const themeVars = `:root{
    --brand:${s.brand.color};
    --brand-700:${s.brand.colorDark};
    --brand-50:color-mix(in srgb, ${s.brand.color} 10%, white);
    --brand-100:color-mix(in srgb, ${s.brand.color} 22%, white);
    --font-sans:'${family}', system-ui, sans-serif;
  }`;

  return (
    <html lang={locale} dir={dir} className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link href={fontHref} rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: themeVars }} />
      </head>
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
