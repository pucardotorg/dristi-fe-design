/** Small building blocks in Provakil's Material-flavoured style. */

import type { Stage } from "@/provakil/lib/matters";

export function Chip({
  tone = "grey",
  children,
}: {
  tone?: "grey" | "blue" | "teal" | "amber" | "red" | "plum";
  children: React.ReactNode;
}) {
  const tones = {
    grey: "bg-(--pv-ground) text-(--pv-slate)",
    blue: "bg-(--pv-blue-50) text-(--pv-blue-dark)",
    teal: "bg-(--pv-teal-50) text-[#00796b]",
    amber: "bg-(--pv-amber-50) text-(--pv-amber)",
    red: "bg-(--pv-red-50) text-(--pv-red)",
    plum: "bg-(--pv-plum-50) text-(--pv-plum)",
  };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export const STAGE_TONE: Record<Stage, "grey" | "blue" | "teal" | "amber" | "plum"> = {
  "Notice Sent": "grey",
  "Notice Served": "amber",
  "Ready for Filing": "blue",
  Filed: "teal",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" }) {
  const v = {
    primary: "bg-(--pv-blue) text-white hover:bg-(--pv-blue-dark) shadow-sm disabled:bg-(--pv-blue)/50",
    outline: "border border-(--pv-line) bg-white text-(--pv-slate) hover:bg-(--pv-ground)",
    ghost: "text-(--pv-slate) hover:bg-(--pv-ground)",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-blue) disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`}
    />
  );
}
