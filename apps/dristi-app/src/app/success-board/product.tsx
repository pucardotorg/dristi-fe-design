"use client";

import * as React from "react";

/* TEMPORARY: static screenshots of every batch 1 (filing) and batch 2 (cases and join)
   feedback state, captured from the real product (feature/feedback-states-rollout) at
   phone, iPad mini, iPad Pro and desktop, plus dark on phone and desktop. Remove this
   section once the rollout has been looked over.
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
type Missing = { name: string; path: string; why: string };

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

export const NOT_CAPTURED: Missing[] = [
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

export const BATCH2_SCREENS: Screen[] = [
  {
    id: "ra-signed",
    name: "Raise application: signed",
    path: "/cases/c-847/filings/application",
    note: "Generic application, Generate, Add signature, Sign digitally, Aadhaar OTP. The signed line.",
  },
  {
    id: "ra-paid",
    name: "Raise application: payment successful",
    path: "/cases/c-847/filings/application",
    note: "Proceed to payment, Make payment. ₹20 court fee.",
  },
  {
    id: "ra-submitted",
    name: "Raise application: submitted",
    path: "/cases/c-847/filings/application",
    note: "Continue after paying. The paid court fee is a fact row, “Court fee · ₹20 paid”.",
  },
  {
    id: "ra-sign-later",
    name: "Raise application: waiting for your signature",
    path: "/cases/c-847/filings/application",
    note: "I’ll sign later. Neutral with the clock, not amber.",
  },
  {
    id: "ra-pay-later",
    name: "Raise application: signed, waiting for payment",
    path: "/cases/c-847/filings/application",
    note: "Signed, then Skip on the payment step. Neutral with the clock.",
  },
  {
    id: "ra-save-draft",
    name: "Save this application as a draft? confirm",
    path: "/cases/c-847/filings/application",
    note: "Type a title, then close the form.",
  },
  {
    id: "toast-draft",
    name: "Toast: saved as a draft",
    path: "/cases/c-847/filings/application",
    note: "Save as draft from the confirm. Neutral toast with the save icon.",
  },
  {
    id: "adv-join-paid",
    name: "Advocate join: vakalatnama fee paid",
    path: "/cases → Join a case",
    note: "Any case number, any six-digit code, Advocate, Accused, Rajan Krishnan Nair, mobile, vakalatnama, Pay ₹25.",
  },
  {
    id: "adv-joined",
    name: "Advocate join: you have joined",
    path: "/cases → Join a case",
    note: "Continue after paying. The outcome takes over the header.",
  },
  {
    id: "adv-invite",
    name: "Advocate join: team invite line",
    path: "/cases → Join a case",
    note: "Add your team, pick Priya Nair, Give access. The line under the field, with its toast.",
  },
  {
    id: "adv-pay-later",
    name: "Advocate join: pay the fee to get access",
    path: "/cases → Join a case",
    note: "Pay later on the fee step. Neutral with the clock.",
  },
  {
    id: "citizen-joined",
    name: "Citizen join: you have joined",
    path: "/home?join=handoff&as=self",
    note: "Join as Litigant from the advocate flow, then I am the accused, Rajan Krishnan Nair, I already have an advocate.",
  },
  {
    id: "add-advocate",
    name: "Add advocate: advocate added",
    path: "/cases/c-847 → Parties → Add people",
    note: "Add an advocate, 98470 98765, for Rajan Krishnan Nair, vakalatnama uploaded.",
  },
  {
    id: "remove-advocate",
    name: "Remove advocate: request sent",
    path: "/cases/c-847 → Parties",
    note: "Remove the advocate just added, by consent. Info hourglass: sent, not decided.",
  },
  {
    id: "discard-advocate-draft",
    name: "Discard advocate draft? confirm",
    path: "/cases/c-847 → Parties → Add people",
    note: "Pick an advocate, then close. One of the seven discard confirms; the other six share its markup.",
  },
  {
    id: "consent-accepted",
    name: "Removal request: accepted",
    path: "/cases/c-1001 → Respond to a removal request",
    note: "The outgoing advocate accepts.",
  },
  {
    id: "consent-rejected",
    name: "Removal request: rejected",
    path: "/cases/c-1001 → Respond to a removal request",
    note: "The outgoing advocate rejects. Neutral.",
  },
  {
    id: "toast-archive",
    name: "Toast: task archived",
    path: "/cases/c-847",
    note: "Archive the Raise bail bond task. Toast with Undo.",
  },
  {
    id: "toast-download",
    name: "Toast: preparing your download",
    path: "/cases/c-847 → Download",
    note: "Full case file, separate files.",
  },
];

export const BATCH2_NOT_CAPTURED: Missing[] = [
  {
    name: "Mark as evidence toast (“Marked as …”)",
    path: "/cases/<id>/documents",
    why: "Only court staff with the evidence-marker seat can mark evidence, on the court side. The advocate sandbox has no such button.",
  },
  {
    name: "The three “could not be loaded” lines",
    path: "Case orders, applications and documents",
    why: "They show only when the case data fails to load, and the sandbox always loads. Reaching them would mean breaking the product.",
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

const GROUPS: { title: string; sub: string; screens: Screen[]; missing: Missing[] }[] = [
  { title: "Batch 1 · filing", sub: "Bail bond, signing, e-filing payment, batch sign and pay, filing confirms.", screens: PRODUCT_SCREENS, missing: NOT_CAPTURED },
  { title: "Batch 2 · cases and join", sub: "Raise application, joining a case, case toasts and confirms.", screens: BATCH2_SCREENS, missing: BATCH2_NOT_CAPTURED },
];

export const SCREEN_COUNT = GROUPS.reduce((n, g) => n + g.screens.length, 0);

export function ProductSection() {
  return (
    <>
      {GROUPS.map((g) => (
        <React.Fragment key={g.title}>
          <header className="flex flex-col gap-2 border-t-2 border-foreground pt-8">
            <h2 className="text-[48px] leading-none font-semibold tracking-tight">{g.title}</h2>
            <p className="text-title-s text-muted-foreground">{g.sub}</p>
          </header>
          <ScreenRows screens={g.screens} missing={g.missing} />
        </React.Fragment>
      ))}
    </>
  );
}

function ScreenRows({ screens, missing }: { screens: Screen[]; missing: Missing[] }) {
  return (
    <>
      {screens.map((s) => {
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
      {missing.length > 0 ? (
        <section className="flex w-[1600px] flex-col gap-4 rounded-xl border border-hairline bg-card p-6 shadow-raised">
          <h2 className="text-title-s font-semibold">Not captured</h2>
          <ul className="flex flex-col divide-y divide-hairline">
            {missing.map((n) => (
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
