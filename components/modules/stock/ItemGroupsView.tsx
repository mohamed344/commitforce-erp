"use client";

import { useTranslations } from "next-intl";
import TreeMasterView from "./TreeMasterView";

export default function ItemGroupsView() {
  const t = useTranslations("stock");
  return <TreeMasterView table="categories" newLabel={t("itemGroup")} hasDescription />;
}
