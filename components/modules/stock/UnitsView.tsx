"use client";

import { useTranslations } from "next-intl";
import SimpleMasterView from "./SimpleMasterView";

export default function UnitsView() {
  const t = useTranslations("stock");
  return (
    <SimpleMasterView
      table="uoms"
      newLabel={t("tabs.units")}
      fields={[
        { name: "name", label: t("name"), required: true },
        { name: "abbr", label: t("abbr") },
      ]}
    />
  );
}
