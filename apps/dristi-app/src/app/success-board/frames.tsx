"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/* Shared frames for the success board. Everything inside a frame is drawn at real size
   with the product's own tokens, so a specimen reads at the weight it has in the app. */

/** A faux page: the screen the success lands on, so prominence is judged in context. */
export function Screen({
  children,
  height = 520,
  scrim = true,
  className,
}: {
  children?: React.ReactNode;
  height?: number;
  scrim?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("relative w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background", className)}
      style={{ height }}
    >
      <FauxPage />
      {scrim ? <div className="absolute inset-0 bg-black/40" /> : null}
      <div className="absolute inset-0 flex items-center justify-center p-6">{children}</div>
    </div>
  );
}

export function FauxPage() {
  return (
    <div aria-hidden className="absolute inset-0 flex">
      <div className="flex w-44 flex-col gap-3 border-r border-hairline bg-card p-4">
        <div className="h-5 w-24 rounded bg-surface-sunken" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-3.5 rounded bg-surface-sunken" style={{ width: `${60 + ((i * 17) % 35)}%` }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="h-6 w-64 rounded bg-surface-sunken" />
        <div className="h-3.5 w-96 rounded bg-surface-sunken" />
        <div className="mt-2 flex flex-col overflow-hidden rounded-lg border border-hairline bg-card">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-0">
              <div className="h-3.5 w-40 rounded bg-surface-sunken" />
              <div className="h-3.5 flex-1 rounded bg-surface-sunken" />
              <div className="h-5 w-16 rounded-full bg-surface-sunken" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The DS dialog surface (DialogContent base), drawn statically. */
export function DialogBox({
  width,
  children,
  close = true,
  className,
}: {
  width: number;
  children: React.ReactNode;
  close?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex max-h-full flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground shadow-modal ring-1 ring-hairline",
        className,
      )}
      style={{ width }}
    >
      {close ? (
        <span className="absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-md text-muted-foreground">
          <XIcon className="size-4" />
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** Sonner's toast box with the product's AppToaster fills, pinned where it really sits. */
export function ToastBox({
  tone,
  icon,
  title,
  description,
  action,
}: {
  tone: "success" | "normal";
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: string;
}) {
  const style =
    tone === "success"
      ? { background: "var(--success-muted)", color: "var(--success-muted-foreground)", borderColor: "var(--success-7)" }
      : { background: "var(--surface-sunken)", color: "var(--popover-foreground)", borderColor: "var(--border)" };
  return (
    <div
      className="flex w-[356px] items-center gap-1.5 border p-4 text-[13px]"
      style={{ ...style, borderRadius: "var(--radius)", boxShadow: "var(--shadow-overlay)" }}
    >
      {icon ? <span className="flex size-4 shrink-0 items-center justify-center self-start pt-0.5 mr-1">{icon}</span> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="font-medium leading-normal">{title}</div>
        {description ? <div className="leading-[1.4] opacity-90">{description}</div> : null}
      </div>
      {action ? (
        <span className="ml-auto shrink-0 rounded px-2 py-1 text-xs font-medium" style={{ background: "var(--popover-foreground)", color: "var(--popover)" }}>
          {action}
        </span>
      ) : null}
    </div>
  );
}

/** Toast in context: page, no scrim, toast 56px above the bottom, centred on the column. */
export function ToastScreen({ children, height = 420 }: { children: React.ReactNode; height?: number }) {
  return (
    <div className="relative w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background" style={{ height }}>
      <FauxPage />
      <div className="absolute inset-x-0 bottom-[56px] flex justify-center pl-44">{children}</div>
    </div>
  );
}

/** A stand-in for the uploaded ID card photo the approver sees: photo, name, number lines. */
export function IdCard({ className = "h-28 w-44" }: { className?: string }) {
  return (
    <div aria-label="ID card photo" className={"flex shrink-0 flex-col gap-2 rounded-md border border-hairline bg-card p-2.5 shadow-raised " + className}>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-brand-muted" />
        <span className="h-1.5 w-16 rounded bg-surface-sunken" />
      </div>
      <div className="flex flex-1 gap-2.5">
        <span className="w-10 rounded bg-surface-sunken" />
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <span className="h-1.5 w-full rounded bg-surface-sunken" />
          <span className="h-1.5 w-3/4 rounded bg-surface-sunken" />
          <span className="h-1.5 w-1/2 rounded bg-surface-sunken" />
        </div>
      </div>
      <span className="text-[9px] font-medium tracking-wide text-muted-foreground uppercase">ID card photo</span>
    </div>
  );
}
