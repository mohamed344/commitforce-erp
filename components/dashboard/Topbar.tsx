import { config } from "@/lib/config";
import SearchBar from "./SearchBar";
import UserMenu from "./UserMenu";
import LowStockBell from "./LowStockBell";

type Enterprise = { name: string; short: string; logoUrl: string };

export default function Topbar({
  enterprise,
  lowStockThreshold = 5,
}: {
  enterprise?: Enterprise;
  lowStockThreshold?: number;
}) {
  const { logoUrl, short, name } = enterprise ?? config.enterprise;

  return (
    <header className="sticky top-0 z-20 grid h-16 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-line-2 bg-white px-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-0 sm:px-[22px]">
      <div className="flex items-center gap-2.5 justify-self-start">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={name}
            className="h-[34px] w-[34px] rounded-[9px] object-cover"
          />
        ) : (
          <div
            title={name}
            className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-gradient-to-br from-brand to-brand-700 text-[12px] font-bold tracking-[0.04em] text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.12)]"
          >
            {short}
          </div>
        )}
      </div>

      <SearchBar />
      <div className="flex items-center gap-2 justify-self-end">
        <LowStockBell threshold={lowStockThreshold} />
        <UserMenu />
      </div>
    </header>
  );
}
