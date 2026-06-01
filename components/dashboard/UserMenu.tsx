"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { config } from "@/lib/config";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import {
  ChevronDownIcon,
  CheckIcon,
  PlusCircleIcon,
  GearIcon,
  LogoutIcon,
} from "./icons";

type Company = { id: string; name: string; email: string | null };

export default function UserMenu() {
  const t = useTranslations("menu");
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Load the signed-in user, their companies, and the active one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setEmail(user.email ?? null);

      const [{ data: profile }, { data: list }] = await Promise.all([
        supabase.from("profiles").select("company_id").eq("id", user.id).single(),
        supabase.from("companies").select("id, name, email").order("name"),
      ]);
      if (cancelled) return;
      setActiveId(profile?.company_id ?? null);
      setCompanies((list as Company[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function switchCompany(id: string) {
    if (id === activeId) return;
    await supabase.rpc("set_active_company", { c: id });
    setActiveId(id);
    setOpen(false);
    router.refresh();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const active = companies.find((c) => c.id === activeId) ?? null;
  const companyName = active?.name ?? config.enterprise.name;
  const monogram = (active?.name ?? config.enterprise.short)
    .slice(0, 2)
    .toUpperCase();
  const displayName = companyName.split(" ")[0];

  return (
    <div ref={ref} className="relative justify-self-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`flex items-center gap-2 rounded-full border py-1 pe-2.5 ps-1 transition-colors hover:border-brand-100 hover:bg-brand-50 ${
          open ? "border-brand-100 bg-brand-50" : "border-line bg-white"
        }`}
      >
        <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-gradient-to-br from-[#22c55e] to-brand-700 text-[11px] font-bold tracking-[0.04em] text-white shadow-[inset_0_-1px_0_rgba(0,0,0,.18)]">
          {monogram}
        </span>
        <span className="text-[13px] font-semibold text-ink max-[720px]:hidden">
          {displayName}
        </span>
        <ChevronDownIcon
          className={`text-ink-3 transition-transform duration-200 ${open ? "rotate-180 text-brand" : ""}`}
        />
      </button>

      <div
        role="menu"
        aria-hidden={!open}
        className={`absolute end-0 top-[calc(100%+8px)] z-30 w-[280px] rounded-xl border border-line bg-white p-1.5 text-start shadow-[0_12px_32px_-8px_rgba(20,22,30,.16),0_2px_6px_rgba(20,22,30,.06)] transition-[opacity,transform] duration-150 ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-[.98] opacity-0"
        }`}
      >
        {/* Account header */}
        <div className="mb-1.5 flex items-center gap-3 border-b border-line-2 px-3 pb-2.5 pt-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#22c55e] to-brand-700 text-[12px] font-bold tracking-[0.04em] text-white shadow-[inset_0_-1px_0_rgba(0,0,0,.18)]">
            {monogram}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-[1.2] text-ink">
              {active ? companyName : t("noCompany")}
            </div>
            {email && <div className="mt-0.5 truncate text-[11px] text-ink-3">{email}</div>}
          </div>
        </div>

        {/* Company switcher */}
        <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-4">
          {t("switchAccount")}
        </div>
        {companies.map((c) => (
          <button
            key={c.id}
            type="button"
            role="menuitem"
            onClick={() => switchCompany(c.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-line-2 ${
              c.id === activeId ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-[#22c55e] to-brand-700 text-[9px] font-bold text-white">
              {c.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="truncate">{c.name}</span>
            {c.id === activeId && (
              <span className="ms-auto text-brand">
                <CheckIcon />
              </span>
            )}
          </button>
        ))}
        <Link
          href="/companies/new"
          role="menuitem"
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink-2 transition-colors hover:bg-line-2 hover:text-ink"
        >
          <span className="grid place-items-center text-ink-3">
            <PlusCircleIcon />
          </span>
          {t("addCompany")}
        </Link>

        {/* Language */}
        <LocaleSwitcher />

        <div className="my-1.5 h-px bg-line-2" />

        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink-2 transition-colors hover:bg-line-2 hover:text-ink"
        >
          <span className="grid place-items-center text-ink-3">
            <GearIcon />
          </span>
          {t("accountSettings")}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink-2 transition-colors hover:bg-line-2 hover:text-ink"
        >
          <span className="grid place-items-center text-ink-3">
            <LogoutIcon />
          </span>
          {t("logout")}
        </button>
      </div>
    </div>
  );
}
