import type { ReactNode } from "react";

const tones: Record<string, string> = {
  gray: "bg-line-2 text-ink-2",
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
};

export default function Badge({
  tone = "gray",
  children,
}: {
  tone?: keyof typeof tones | string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${
        tones[tone] ?? tones.gray
      }`}
    >
      {children}
    </span>
  );
}
