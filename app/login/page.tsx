"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { config } from "@/lib/config";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === "signUp";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isSignUp && password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }

    setBusy(true);
    const { error } = isSignUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, phone } },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const field =
    "rounded-[10px] border border-line bg-[#f6f6f8] px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brand-100";
  const label = "flex flex-col gap-1.5 text-[12px] font-medium text-ink-2";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-10 sm:px-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          {config.enterprise.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.enterprise.logoUrl}
              alt={config.appName}
              className="h-[34px] w-[34px] rounded-[9px] object-cover"
            />
          ) : (
            <div className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-gradient-to-br from-brand to-brand-700 text-[12px] font-bold tracking-[0.04em] text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.12)]">
              {config.enterprise.short}
            </div>
          )}
          <span className="text-[15px] font-semibold text-ink">{config.appName}</span>
        </div>

        <h1 className="mb-5 text-center text-[20px] font-semibold text-ink">
          {isSignUp ? t("signUpTitle") : t("signInTitle")}
        </h1>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {isSignUp && (
            <>
              <label className={label}>
                {t("fullName")}
                <input
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={field}
                />
              </label>
              <label className={label}>
                {t("phone")}
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={field}
                />
              </label>
            </>
          )}

          <label className={label}>
            {t("email")}
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </label>

          <label className={label}>
            {t("password")}
            <input
              required
              type="password"
              minLength={6}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          </label>

          {isSignUp && (
            <label className={label}>
              {t("confirmPassword")}
              <input
                required
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={field}
              />
            </label>
          )}

          {error && <p className="text-[12px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2.5 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
          >
            {busy ? t("signingIn") : isSignUp ? t("signUp") : t("signIn")}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isSignUp ? "signIn" : "signUp");
            setError(null);
          }}
          className="mt-4 w-full text-center text-[13px] text-ink-3 hover:text-brand"
        >
          {isSignUp ? t("toSignIn") : t("toSignUp")}
        </button>
      </div>
    </main>
  );
}
