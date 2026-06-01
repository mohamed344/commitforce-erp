"use client";

import { useTranslations } from "next-intl";
import SimpleMasterView from "./SimpleMasterView";

export default function BrandsView() {
  const t = useTranslations("stock");
  return <SimpleMasterView table="brands" newLabel={t("brand")} fields={[{ name: "name", label: t("name"), required: true }]} />;
}
