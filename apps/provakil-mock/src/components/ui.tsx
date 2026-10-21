/** Small building blocks in Provakil's Material-flavoured style. */

import type { Stage } from "@/lib/matters";

export function Chip({
  tone = "grey",
  children,
}: {
  tone?: "grey" | "blue" | "teal" | "amber" | "red" | "plum";
  children: React.ReactNode;
}) {
  const tones = {
    grey: "bg-ground text-slate",
    blue: "bg-blue-50 text-blue-dark",
    teal: "bg-teal-50 text-[#00796b]",
    amber: "bg-amber-50 text-amber",
    red: "bg-red-50 text-red",
    plum: "bg-plum-50 text-plum",
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
    primary: "bg-blue text-white hover:bg-blue-dark shadow-sm disabled:bg-blue/50",
    outline: "border border-line bg-white text-slate hover:bg-ground",
    ghost: "text-slate hover:bg-ground",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`}
    />
  );
}
