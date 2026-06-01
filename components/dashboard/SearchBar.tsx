import { useTranslations } from "next-intl";
import { SearchIcon } from "./icons";

export default function SearchBar() {
  const t = useTranslations("search");
  return (
    <div
      role="search"
      className="flex w-[min(520px,60vw)] items-center gap-2.5 justify-self-center rounded-[10px] border border-line bg-[#f6f6f8] px-[14px] py-[9px] text-[13.5px] text-ink-3 max-[720px]:w-[min(380px,56vw)] max-[520px]:px-3 max-[520px]:py-2 max-[520px]:text-[13px]"
    >
      <SearchIcon className="shrink-0" />
      <input
        placeholder={t("placeholder")}
        aria-label={t("placeholder")}
        className="w-full border-0 bg-transparent font-[inherit] text-ink outline-none placeholder:text-ink-3"
      />
      <span className="ms-auto text-[11.5px] font-medium text-ink-3 max-[520px]:hidden">
        {t("shortcut")}
      </span>
    </div>
  );
}
