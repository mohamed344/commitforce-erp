"use client";

import { useTranslations } from "next-intl";
import TreeMasterView from "./TreeMasterView";

export default function WarehousesView() {
  const t = useTranslations("stock");
  return <TreeMasterView table="warehouses" newLabel={t("warehouse")} hasIsGroup />;
}
