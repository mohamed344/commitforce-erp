"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { UploadIcon } from "@/components/dashboard/icons";

const LOGO_BUCKET = "company-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export default function NewCompanyPage() {
  const t = useTranslations("company");
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function acceptFile(file: File | null) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_LOGO_BYTES) {
      setError(t("logoHint"));
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const prettySize = logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    // 1) Upload the logo (if any) to public storage, then use its public URL.
    let logoUrl: string | null = null;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, logoFile, { cacheControl: "3600", upsert: false });
      if (uploadError) {
        setError(uploadError.message);
        setBusy(false);
        return;
      }
      logoUrl = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
    }

    // 2) create_company: inserts the company, makes the caller its admin.
    const { data, error: createError } = await supabase.rpc("create_company", {
      p_name: name,
      p_slug: slug || null,
      p_email: null,
      p_logo_url: logoUrl,
    });

    if (createError || !data) {
      setError(createError?.message ?? "Failed to create company");
      setBusy(false);
      return;
    }

    // 3) Make the new company the active one, then go to the dashboard.
    const companyId = Array.isArray(data) ? data[0]?.id : (data as { id: string }).id;
    if (companyId) {
      await supabase.rpc("set_active_company", { c: companyId });
    }
    router.push("/");
    router.refresh();
  }

  const field =
    "rounded-[10px] border border-line bg-[#f6f6f8] px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brand-100";
  const labelCls = "flex flex-col gap-1.5 text-[12px] font-medium text-ink-2";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-10 sm:px-6">
      <div className="w-full max-w-[420px]">
        <h1 className="text-[20px] font-semibold text-ink">{t("newTitle")}</h1>
        <p className="mt-1 mb-5 text-[13px] text-ink-3">{t("newSubtitle")}</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className={labelCls}>
            {t("name")}
            <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className={labelCls}>
            {t("slug")}
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto" className={field} />
          </label>

          {/* Logo upload */}
          <div className={labelCls}>
            {t("logo")}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
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
                  <div className="truncate text-[13px] font-medium text-ink">{logoFile?.name}</div>
                  <div className="text-[11px] text-ink-4">{prettySize}</div>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="text-[12px] font-medium text-brand hover:underline"
                    >
                      {t("change")}
                    </button>
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="text-[12px] font-medium text-ink-3 hover:text-ink"
                    >
                      {t("remove")}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  acceptFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`flex flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed px-4 py-7 text-center transition-colors ${
                  dragging
                    ? "border-brand bg-brand-50"
                    : "border-line hover:border-brand-100 hover:bg-line-2"
                }`}
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand">
                  <UploadIcon />
                </span>
                <span className="text-[13px] font-medium text-ink-2">{t("dropLogo")}</span>
                <span className="text-[11px] text-ink-4">{t("logoHint")}</span>
              </button>
            )}
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}

          <div className="mt-1 flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-[10px] bg-gradient-to-b from-brand to-brand-700 px-4 py-2.5 text-[14px] font-semibold text-white transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
            >
              {busy ? t("creating") : t("create")}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-[10px] border border-line px-4 py-2.5 text-[14px] font-medium text-ink-2 hover:bg-line-2"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
