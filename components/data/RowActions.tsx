"use client";

import { useTranslations } from "next-intl";
import { EyeIcon, PencilIcon, TrashIcon } from "@/components/dashboard/icons";

/** Compact view / edit / delete actions for a table row. Each is optional. */
export default function RowActions({
  onView,
  onEdit,
  onDelete,
}: {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("ui");
  const base =
    "grid h-7 w-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-line-2";

  return (
    <div className="flex items-center justify-end gap-1">
      {onView && (
        <button type="button" title={t("view")} aria-label={t("view")} onClick={(e) => { e.stopPropagation(); onView(); }} className={`${base} hover:text-brand`}>
          <EyeIcon />
        </button>
      )}
      {onEdit && (
        <button type="button" title={t("edit")} aria-label={t("edit")} onClick={(e) => { e.stopPropagation(); onEdit(); }} className={`${base} hover:text-brand`}>
          <PencilIcon />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          title={t("delete")}
          aria-label={t("delete")}
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(t("confirmDelete"))) onDelete();
          }}
          className={`${base} hover:text-red-600`}
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}
