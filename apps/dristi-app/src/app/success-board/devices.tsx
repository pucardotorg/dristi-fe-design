"use client";

import * as React from "react";
import { CheckCircle2Icon, CircleCheckIcon, DownloadIcon, MenuIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";

import { ToastBox } from "./frames";
import { ConfirmToast, Hero } from "./proposed";

/* The bail application success (the reference dialog) on real device sizes.
   Below 640px a flow dialog is a full-screen window (useFlowWindow); above it is the
   centred dialog at sm:max-w-2xl. Toasts sit 64px up and full width on a phone,
   56px up and 356px wide above. Both sides keep today's container; only the look changes. */

export type Device = { name: string; w: number; h: number };
export const DEVICES: Device[] = [
  { name: "Phone · 375 × 812", w: 375, h: 812 },
  { name: "iPad mini portrait · 768 × 1024", w: 768, h: 1024 },
  { name: "iPad mini landscape · 1024 × 768", w: 1024, h: 768 },
  { name: "iPad Pro 12.9 portrait · 1024 × 1366", w: 1024, h: 1366 },
  { name: "iPad Pro 12.9 landscape · 1366 × 1024", w: 1366, h: 1024 },
];

const phone = (d: Device) => d.w < 640;

function DeviceFaux({ d }: { d: Device }) {
  const rail = d.w >= 1024;
  return (
    <div aria-hidden className="absolute inset-0 flex">
      {rail ? (
        <div className="flex w-56 flex-col gap-3 border-r border-hairline bg-card p-4">
          <div className="h-5 w-24 rounded bg-surface-sunken" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-3.5 rounded bg-surface-sunken" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
          ))}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          {!rail ? <MenuIcon className="size-5 text-muted-foreground" /> : null}
          <div className="h-5 w-40 rounded bg-surface-sunken" />
        </div>
        {Array.from({ length: phone(d) ? 6 : 9 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-hairline bg-card p-4">
            <div className="h-3.5 w-2/3 rounded bg-surface-sunken" />
            <div className="h-3 w-1/2 rounded bg-surface-sunken" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Frame({ d, children, scrim = true }: { d: Device; children: React.ReactNode; scrim?: boolean }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[28px] border-[6px] border-foreground/80 bg-background"
      style={{ width: d.w + 12, height: d.h + 12 }}
    >
      <DeviceFaux d={d} />
      {scrim && !phone(d) ? <div className="absolute inset-0 bg-black/40" /> : null}
      {children}
    </div>
  );
}

const Facts = () => (
  <DescriptionList>
    {[
      ["Submitted on", "24-08-2026"],
      ["Submission ID", "KL-000847-2026-AP1"],
      ["Court fee", "₹50 paid"],
    ].map(([t, v]) => (
      <DescriptionRow key={t} className="border-hairline">
        <DescriptionTerm>{t}</DescriptionTerm>
        <DescriptionDetails className="tabular-nums">{v}</DescriptionDetails>
      </DescriptionRow>
    ))}
  </DescriptionList>
);

const Close = () => (
  <span className="absolute top-2 right-2 z-10 flex size-10 items-center justify-center text-muted-foreground">
    <XIcon className="size-4" />
  </span>
);

/** Today's container for the device: full-screen window on a phone, centred dialog above. */
function Surface({ d, children }: { d: Device; children: React.ReactNode }) {
  if (phone(d)) {
    return <div className="absolute inset-0 flex flex-col bg-popover text-sm">{children}</div>;
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-popover text-sm shadow-modal ring-1 ring-hairline">
        {children}
      </div>
    </div>
  );
}

const Foot = ({ d }: { d: Device }) => (
  <footer
    className={
      "flex shrink-0 gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 " +
      (phone(d) ? "mt-auto flex-col-reverse pb-10" : "items-center justify-between")
    }
  >
    <Button variant="outline"><DownloadIcon data-icon="inline-start" />Download application</Button>
    <Button>Done</Button>
  </footer>
);

export function BailToday({ d }: { d: Device }) {
  return (
    <Frame d={d}>
      <Surface d={d}>
        <Close />
        <div className="flex shrink-0 items-center gap-4 border-b border-hairline px-6 py-5 pr-14">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-success-muted text-success-muted-foreground">
            <CheckCircle2Icon className="size-7" />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="text-title-s font-semibold text-balance">Bail application submitted</h2>
            <p className="text-pretty text-muted-foreground">The court has received your application. You will be told by SMS when a decision is made.</p>
          </div>
        </div>
        <div className="px-6 py-5"><Facts /></div>
        <Foot d={d} />
      </Surface>
    </Frame>
  );
}

export function BailProposed({ d }: { d: Device }) {
  return (
    <Frame d={d}>
      <Surface d={d}>
        <Close />
        <Hero
          compact={phone(d)}
          title="Bail application submitted"
          body="The court has received your application. You will be told by SMS when a decision is made."
        />
        <div className="sb-rise px-6 py-4" style={{ animationDelay: `calc(var(--sb-start, 0ms) + 320ms)` }}><Facts /></div>
        <Foot d={d} />
      </Surface>
    </Frame>
  );
}

function ToastSlot({ d, children }: { d: Device; children: React.ReactNode }) {
  return phone(d) ? (
    <div className="absolute inset-x-4 bottom-[64px] flex justify-center [&>*]:w-full">{children}</div>
  ) : (
    <div className="absolute inset-x-0 bottom-[56px] flex justify-center" style={{ paddingLeft: d.w >= 1024 ? 224 : 0 }}>
      {children}
    </div>
  );
}

export function ToastToday({ d }: { d: Device }) {
  return (
    <Frame d={d} scrim={false}>
      <ToastSlot d={d}>
        <ToastBox tone="success" icon={<CircleCheckIcon className="size-4" />} title="Access given to Adv. Meera Nair" />
      </ToastSlot>
    </Frame>
  );
}

export function ToastProposed({ d }: { d: Device }) {
  return (
    <Frame d={d} scrim={false}>
      <ToastSlot d={d}>
        <ConfirmToast title="Access given to Adv. Meera Nair" />
      </ToastSlot>
    </Frame>
  );
}
