"use client";

import * as React from "react";

/* TEMPORARY: static screenshots of every batch 1 feedback state, captured from the real
   product (feature/feedback-states-rollout) at phone, iPad mini, iPad Pro and desktop,
   plus dark on phone and desktop. Remove this section once batch 1 has been looked over.
   Images live in public/success-board/product/<screen>-<device>[-dark].png at 2x. */

type Shot = { device: string; file: string; w: number };

const VIEWS: Shot[] = [
  { device: "Phone · 375 × 812", file: "phone", w: 375 },
  { device: "iPad mini portrait · 768 × 1024", file: "ipadmini", w: 768 },
  { device: "iPad Pro landscape · 1366 × 1024", file: "ipadpro", w: 1366 },
  { device: "Desktop · 1440 × 900", file: "desktop", w: 1440 },
  { device: "Phone, dark", file: "phone-dark", w: 375 },
  { device: "Desktop, dark", file: "desktop-dark", w: 1440 },
];

type Screen = { id: string; name: string; path: string; note: string; views?: string[] };

export const PRODUCT_SCREENS: Screen[] = [
  {
    id: "batch-pay",
    name: "Batch pay: ₹452 paid",
    path: "/filings?tab=pendingPayment",
    note: "Both cards ticked, Pay from the selection bar, confirmed. Takeover; a bottom sheet on the phone.",
  },
  {
    id: "batch-sign",
    name: "Batch sign: document signed",
    path: "/filings?tab=pendingSignature",
    note: "Only one filing in the sandbox can be signed from the queue, so the takeover reads “Document signed” rather than “N documents signed”.",
  },
  {
    id: "discard-drafts",
    name: "Discard drafts? confirm",
    path: "/filings?tab=drafts",
    note: "Drafts selected, Discard from the selection bar. Soft red button, bin mark, lock line.",
  },
  {
    id: "efiling-signed",
    name: "E-filing sign: every party has signed",
    path: "/filings/sample-draft-13/sign",
    note: "The green inline line in the signatures rail, after a sandbox reset.",
  },
  {
    id: "efiling-paid",
    name: "E-filing: payment successful",
    path: "/filings/sample-draft-13/sign",
    note: "Continue to pay fees, then Pay ₹226 online. Amount, case file number and payment reference.",
  },
  {
    id: "efiling-filed",
    name: "E-filing: the filed record",
    path: "/filings/sample-draft-13/sign",
    note: "The same URL after paying.",
  },
  {
    id: "signing-added",
    name: "Signing window: signature added",
    path: "/filings/sample-draft-7/sign",
    note: "Add your e-signature, Aadhaar OTP, Verify and sign. The done stage.",
  },
  {
    id: "signing-sent",
    name: "Signing window: sent for signature",
    path: "/filings/sample-draft-1/sign",
    note: "Continue to signing, Sign digitally. The green notice that the other party has their link, above your own e-sign choice.",
  },
  {
    id: "dead-link",
    name: "Dead signing link",
    path: "/sign?draft=does-not-exist&as=x",
    note: "A signing link for a filing that does not exist.",
  },
  {
    id: "bail-bond-done",
    name: "Bail bond submitted",
    path: "/cases/c-847",
    note: "The bond flow from the case header, finished.",
  },
  {
    id: "bail-bond-edit",
    name: "Edit the bail bond? confirm",
    path: "/cases/c-847",
    note: "Bond status, Edit details. Neutral pen mark, teal button.",
  },
  {
    id: "remove-witness",
    name: "Remove witness confirm",
    path: "/filings/sample-draft-1/witnesses",
    note: "Add witness, then remove witness 2. Soft red button, bin mark, lock line.",
  },
  {
    id: "restore-affidavit",
    name: "Restore the standard affidavit? confirm",
    path: "/filings/sample-draft-1/affidavit",
    note: "Edit the affidavit text, then Restore standard text. This confirm has no lock line in the product.",
  },
  {
    id: "feedback-kit",
    name: "Kit reference",
    path: "/feedback-kit",
    note: "Full length. Pieces the sandbox cannot reach: bail application paid and filed, batch “Nothing was signed”.",
    views: ["desktop", "phone", "desktop-dark", "phone-dark"],
  },
];

export const NOT_CAPTURED: { name: string; path: string; why: string }[] = [
  {
    name: "Signing window done stage: “Sent for signature” in the info hourglass tone",
    path: "/filings/sample-draft-1/sign",
    why: "That stage shows only when the person sending has no signature of their own to add. The sandbox advocate always has one, so the window goes to Add your e-signature instead. Captured that stage’s green notice above; the hourglass is on the kit page.",
  },
  {
    name: "Batch sign with more than one document (“N documents signed”)",
    path: "/filings?tab=pendingSignature",
    why: "Only one filing in the sandbox can be signed from the queue, so the takeover says “Document signed”.",
  },
];

/** One screenshot at its natural aspect. Click opens it full size; a drag still pans. */
function Tile({ screen, view }: { screen: Screen; view: Shot }) {
  const down = React.useRef<{ x: number; y: number } | null>(null);
  const src = `/success-board/product/${screen.id}-${view.file}.png`;
  return (
    <figure className="flex shrink-0 flex-col gap-3" style={{ width: view.w }}>
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-body font-semibold">{view.device}</span>
        <span className="font-mono text-caption text-muted-foreground">{screen.path}</span>
      </figcaption>
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        draggable={false}
        onPointerDownCapture={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}
        onClick={(e) => {
          const d = down.current;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) e.preventDefault();
        }}
        className="block overflow-hidden rounded-lg border border-hairline bg-background shadow-raised"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static board screenshots */}
        <img src={src} alt={`${screen.name}, ${view.device}`} draggable={false} className="block h-auto w-full" />
      </a>
    </figure>
  );
}

export function ProductSection() {
  return (
    <>
      {PRODUCT_SCREENS.map((s) => {
        const views = s.views ? VIEWS.filter((v) => s.views!.includes(v.file)) : VIEWS;
        return (
          <section key={s.id} className="flex items-start gap-10">
            <div className="flex w-[420px] shrink-0 flex-col gap-2 rounded-xl border border-hairline bg-card p-6 shadow-raised">
              <h2 className="text-title-s font-semibold">{s.name}</h2>
              <span className="font-mono text-caption text-muted-foreground">{s.path}</span>
              <p className="text-body-compact text-pretty text-muted-foreground">{s.note}</p>
            </div>
            <div className="flex items-start gap-10">
              {views.map((v) => <Tile key={v.file} screen={s} view={v} />)}
            </div>
          </section>
        );
      })}
      {NOT_CAPTURED.length > 0 ? (
        <section className="flex w-[1600px] flex-col gap-4 rounded-xl border border-hairline bg-card p-6 shadow-raised">
          <h2 className="text-title-s font-semibold">Not captured</h2>
          <ul className="flex flex-col divide-y divide-hairline">
            {NOT_CAPTURED.map((n) => (
              <li key={n.name} className="flex flex-col gap-1 py-3">
                <span className="text-body font-medium">{n.name}</span>
                <span className="font-mono text-caption text-muted-foreground">{n.path}</span>
                <span className="text-body-compact text-muted-foreground">{n.why}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
