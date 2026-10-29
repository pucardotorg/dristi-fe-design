"use client";

import * as React from "react";
import { ArrowRightIcon, MaximizeIcon, MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import * as Now from "./current";
import { FAIL_LANES } from "./fail-lanes";
import { f, type Lane, type Persona } from "./types";
import * as Next from "./proposed";
import { MarkPicker } from "./picker";
import { BailProposed, BailToday, DEVICES, ToastProposed, ToastToday } from "./devices";

/* Success board: every "it worked" moment on main @ 90bbc31, grouped by visual pattern,
   each shown today and proposed side by side. Drag to pan, scroll to pan, ctrl/pinch to zoom. */

const PERSONA: Record<Persona, { label: string; cls: string }> = {
  adv: { label: "Advocate & clerk", cls: "bg-brand-muted text-brand-muted-foreground" },
  lit: { label: "Litigant", cls: "bg-info-muted text-info-muted-foreground" },
  mag: { label: "Magistrate", cls: "bg-warning-muted text-warning-ink" },
  staff: { label: "Court staff", cls: "bg-surface-sunken text-foreground ring-1 ring-hairline" },
};

const LANES: Lane[] = [
  {
    id: "toast-green",
    name: "Green toast",
    weight: 1,
    note: "13px text on a step-3 tint, 56px off the bottom edge, gone in 4s. Lands far from where the eye was (the button just pressed). Most common success in the product.",
    specimens: [
      { label: "Title only", now: <Now.ToastSuccess />, next: <Next.ToastTitleAfter />, why: "Sleeker: white, 22px solid mark centred on the text, 14px semibold title, a straight rail clipped by the corner. Lasts 2.75s (today 4s), shown as a thin timer; any click on the page dismisses it." },
      { label: "Try it: timing and click-away", now: <Next.ToastTryout today />, next: <Next.ToastTryout />, why: "Press Show toast on each side. Today stays 4s whatever you do. Proposed: switch between 2.5s and 2.75s, and click anywhere on the page to dismiss. Hovering would pause it in the product, as Sonner does." },
      { label: "Longer message", now: <Now.ToastSuccessDesc />, next: <Next.ToastLongAfter />, why: "Same toast. One line, same words as today, no added button." },
    ],
    flows: [
      f("Access given / updated / removed", ["adv"], "access/share-dialog · person-access-dialog"),
      f("People added to your office", ["adv"], "access/person-access-dialog"),
      f("Invite sent to co-advocates", ["adv"], "advocate/join-case-dialog"),
      f("Task paid / signed / filed / ready", ["adv"], "tasks/act/*"),
      f("Marked done · Archived N tasks", ["adv"], "tasks/tasks-screen"),
      f("Request accepted / declined", ["adv"], "tasks/respond-dialog"),
      f("Reminder sent", ["adv"], "scrutiny/correction-screen"),
      f("Corrections sent to scrutiny", ["adv"], "tasks/use-task-actions"),
      f("Preparing your download", ["adv", "lit"], "cases/download-case-file-dialog"),
      f("N orders signed and issued (after dialog)", ["mag"], "employee/sign-order-flow"),
      f("Order signed. Application accepted", ["mag"], "employee/applications-screen"),
      f("Sent to the Magistrate for signing", ["staff"], "employee/application-decision-panel"),
    ],
  },
  {
    id: "toast-neutral",
    name: "Neutral toast",
    weight: 1,
    note: "Same box on the sunken grey. Used for quieter acknowledgements, but several are real completions (order signed and issued, sent to sign).",
    specimens: [{ label: "With Undo", now: <Now.ToastNeutral />, next: <Next.ToastNeutralAfter />, why: "Same shape with no green: an archive is not a success. Icon in a hairline ring, centred on the title and first detail line. Undo stays, as today." }],
    flows: [
      f("Task archived (Undo)", ["adv"], "cases/case-overview"),
      f("Saved as a draft", ["adv", "lit"], "cases/raise-application-form · submit-documents-form"),
      f("Sent to {name} to sign", ["adv"], "cases/submit-documents-form"),
      f("Marked as Exhibit P-4", ["staff"], "cases/mark-evidence-dialog"),
      f("Signed and issued. Order data triggered", ["mag"], "employee/pending-order-screen"),
      f("Back to draft · Draft discarded", ["staff"], "employee/order-editor"),
      f("Copied (case number, link)", ["adv", "lit", "mag", "staff"], "chrome/identifier"),
    ],
  },
  {
    id: "tinted-header",
    name: "Tinted disc in the header",
    weight: 2,
    note: "56px pale-green disc beside a title-s heading. The rest of the dialog keeps its form-like look, so the change from the last step is small. Copied by hand into six files with drifting sizes.",
    specimens: [
      { label: "Wide, with facts", now: <Now.TintedHeader />, next: <Next.TintedWideAfter />, why: "Header becomes a hero: solid 72px mark, title size up a step, centred. Facts stay below." },
      { label: "Compact (body title size)", now: <Now.TintedHeaderCompact />, next: <Next.TintedCompactAfter />, why: "Same hero at 60px for small dialogs. Title back to title-s, never body size." },
      { label: "Info variant: sent, not decided", now: <Now.TintedHeaderInfo />, next: <Next.TintedInfoAfter />, why: "Same hero in blue, with today's hourglass. It turns over once: received, waiting on the order." },
    ],
    flows: [
      f("Bail application submitted", ["adv", "lit"], "filing/bail-application-dialog"),
      f("Bail bond submitted / updated", ["adv"], "filing/bail-bond-dialog"),
      f("Application / objection submitted", ["adv", "lit"], "cases/add-signature-dialog"),
      f("Signed. Waiting for payment (amber)", ["adv", "lit"], "cases/add-signature-dialog"),
      f("Document(s) submitted", ["adv", "lit"], "cases/e-sign-dialog"),
      f("Advocate(s) added", ["adv"], "cases/add-advocate-dialog"),
      f("Removal accepted · Request rejected", ["adv"], "cases/removal-consent-task"),
      f("Application sent to the magistrate ×6 (blue)", ["adv"], "remove-advocate · edit-litigant · poa · add-witness"),
      f("Application(s) signed", ["adv"], "cases/case-applications"),
    ],
  },
  {
    id: "muted-strip",
    name: "Thin strip on a card",
    weight: 2,
    note: "A 40px pale-green strip at the top of a card, inside a grey stage. The header only rewrites its words. Reads as a status row, not a moment.",
    specimens: [
      { label: "Signing window settled", now: <Now.MutedStrip />, next: <Next.StripSignAfter />, why: "Hero says the outcome. Today's headline and 3 of 3 count become the signer card's label, in the success green, so the list says what it is." },
      { label: "Join case outcome", now: <Now.MutedStripJoin />, next: <Next.StripJoinAfter />, why: "Hero says the outcome. 'Joined as' labels the case card in the success green, so the card says what it is." },
    ],
    flows: [
      f("Complaint signed / everyone has signed", ["adv", "lit"], "filing/sign-flow-dialog"),
      f("Signed copy accepted · Oath recorded", ["adv", "lit"], "filing/sign-flow-dialog"),
      f("Sent to scrutiny (corrections)", ["adv"], "scrutiny/correction-screen"),
      f("Signing link: signed / all done", ["lit"], "filing/sign-link/sign-link-screen"),
      f("You have joined this case", ["lit"], "join/join-case-dialog"),
      f("Advocate joined the case", ["adv"], "advocate/join-case-dialog"),
      f("N documents signed / fees paid (tasks)", ["adv"], "tasks/batch-act-dialog"),
      f("Order(s) signed and issued", ["mag"], "employee/sign-order-flow"),
      f("Registration approved / rejected", ["staff"], "employee/approve-registrations-dialog"),
    ],
  },
  {
    id: "solid",
    name: "Solid green slab, panel or band",
    weight: 4,
    note: "The loudest today. Four different shapes of the same idea: full top slab, a panel with the tick under the text, a solid band on a card, a solid callout. Clear, but inconsistent with each other.",
    specimens: [
      { label: "Top slab", now: <Now.SolidSlab />, next: <Next.SlabAfter />, why: "Shared hero, with the amount labelled 'Amount paid' as today. Same two buttons." },
      { label: "Panel, tick below", now: <Now.SolidPanel />, next: <Next.PanelAfter />, why: "Tick moves above the text, where every other success puts it. Same copy." },
      { label: "Solid band on card", now: <Now.SolidBand />, next: <Next.BandAfter />, why: "Hero carries the outcome; the counts sit together in one summary card instead of floating rows." },
      { label: "Solid callout (alert dialog)", now: <Now.SolidCallout />, next: <Next.CalloutAfter />, why: "Small alert dialog gets the compact hero instead of a green box under the title." },
    ],
    flows: [
      f("E-filing: payment successful", ["adv", "lit"], "filing/sections/sign-section"),
      f("Bulk: payment successful", ["adv"], "bulk/pay-tab"),
      f("Bulk: signing complete", ["adv"], "bulk/sign-tab"),
      f("Filings dashboard: N signed / ₹ paid", ["adv"], "filing/dashboard/batch-filing-dialog"),
      f("Forms / bail bonds / depositions signed", ["mag"], "employee/sign-bulk-confirm-dialog"),
      f("Hearings rescheduled (order signed)", ["mag"], "employee/bulk-reschedule-screen"),
      f("Processes sent / signed / posted", ["staff"], "employee/process-move-dialog"),
      f("Returns recorded", ["staff"], "employee/record-returns-dialog"),
    ],
  },
  {
    id: "receipt",
    name: "Payment receipt",
    weight: 3,
    note: "A solid 48px disc above the amount. Clear, but it sits mid-dialog under an ordinary header, and it is a step, not the end: Continue follows.",
    specimens: [{ label: "Receipt step", now: <Now.Receipt />, next: <Next.ReceiptAfter />, why: "Same title. The amount is labelled 'Amount paid' and sits in the hero; receipt rows grouped below." }],
    flows: [
      f("Task fee paid", ["adv"], "tasks/act/task-flows"),
      f("Bail application fee paid", ["adv", "lit"], "filing/bail-application-dialog"),
      f("Vakalatnama fee paid", ["adv"], "advocate/join-case-dialog"),
      f("Application court fee paid", ["adv", "lit"], "cases/add-signature-dialog"),
    ],
  },
  {
    id: "centred",
    name: "Centred disc in the body",
    weight: 3,
    note: "Closest to a real moment, but used only once, and the text under it is body size.",
    specimens: [{ label: "Scrutiny decision", now: <Now.CentredDisc />, next: <Next.CentredAfter />, why: "Header and centred panel merge into one hero; no repeated title." }],
    flows: [
      f("Forwarded for registration · Case registered", ["staff"], "employee/scrutiny/review-dialog"),
      f("Sent back to advocate (grey)", ["staff"], "employee/scrutiny/review-dialog"),
    ],
  },
  {
    id: "words",
    name: "Only the words change",
    weight: 1,
    note: "No mark, or a small one. The dialog looks almost the same as the step before it. This is where 'did it go through?' comes from.",
    specimens: [
      { label: "Badge + title swap", now: <Now.BadgeSwap />, next: <Next.BadgeSwapAfter />, why: "The sentence is the hero body; the case name and number get their own block below, so they no longer run together." },
      { label: "Title + banner", now: <Now.TitleBanner />, next: <Next.TitleBannerAfter />, why: "Banner text becomes the hero body; the banner goes." },
      { label: "Text only", now: <Now.TextOnly />, next: <Next.TextOnlyAfter />, why: "Gets a mark. 'Next draft' moves into its own labelled block instead of trailing the sentence." },
      { label: "Green line in the footer", now: <Now.FooterLine />, next: <Next.FooterLineAfter />, why: "Viewer stays open, so the footer itself turns into the confirmation: tinted bar, mark, bold line." },
    ],
    flows: [
      f("Complaint registered · Sent back", ["staff", "mag"], "employee/register-case-screen"),
      f("Payment complete (applications)", ["adv", "lit"], "cases/application-payment-dialog"),
      f("Payment · Paid badge (submissions)", ["adv", "lit"], "cases/submission-payment-dialog"),
      f("Sent for signing (order)", ["staff"], "employee/order-editor"),
      f("Process signed / posted / return recorded", ["staff"], "employee/sign-process-dialog"),
      f("A-Diary business saved (caption)", ["mag"], "employee/sign-a-diary-dialog"),
    ],
  },
  {
    id: "page",
    name: "Full page",
    weight: 3,
    note: "Pale disc, title, one button. Fine at page scale; the disc is the same weak tint as the dialog header.",
    specimens: [{ label: "Registration done", now: <Now.FullPage />, next: <Next.FullPageAfter />, why: "96px mark, display-size title, soft green glow behind." }],
    flows: [
      f("Your account is ready", ["lit"], "registration/registration-flow"),
      f("Awaiting approval (amber clock)", ["adv"], "registration/registration-flow · resubmission-flow"),
    ],
  },
  {
    id: "inline",
    name: "Inline alert, banner or line",
    weight: 2,
    note: "Four different inline greens: Alert, Banner with a left bar, bordered line, flat strip. Same weight as an info notice.",
    specimens: [{ label: "The four inline greens", now: <Now.InlineNotices />, next: <Next.InlineAfter />, why: "Two shapes instead of four, straight rails. The six bars are the existing progress bar on the scrutiny correction screen (one per defect, shown today too); proposed, they fill green when all are done." }],
    flows: [
      f("Vakalatnama executed · All signatures collected", ["adv"], "vakalatnama/steps/*"),
      f("You have signed the bail bond", ["lit"], "filing/bond-signing-screen"),
      f("You have signed (signing link page)", ["lit"], "filing/sign-link/sign-link-screen"),
      f("Advocate profile request submitted", ["lit"], "home/profile-settings"),
      f("Every party has signed (e-filing rail)", ["adv", "lit"], "filing/sections/sign-section"),
      f("Done: all N cases filed", ["adv"], "bulk/batch-screen · filed-tab"),
      f("Access given (in dialog)", ["adv"], "access/share-dialog · advocate/join-case-dialog"),
      f("All N corrected", ["adv"], "scrutiny/correction-screen"),
    ],
  },
  {
    id: "silent",
    name: "Nothing visible",
    weight: 0,
    note: "Dialog closes and the row leaves the list. Only a screen-reader line confirms it. The magistrate's single-item signing has no sighted confirmation at all.",
    specimens: [{ label: "Row just disappears", now: <Now.Silent />, next: <Next.SilentAfter />, why: "Row glows and shows Signed before it leaves, plus the confirmation toast." }],
    flows: [
      f("Sign one form / bail bond / exhibit / deposition", ["mag"], "employee/sign-*-dialog"),
      f("Sign an A-Diary day", ["mag"], "employee/sign-a-diary-dialog"),
      f("E-sign N exhibits", ["mag"], "employee/sign-evidence"),
      f("Bulk batch created (just navigates)", ["adv"], "bulk/upload-screen"),
    ],
  },
  {
    id: "marks",
    name: "Ticks and badges (state, not confirmation)",
    weight: 1,
    note: "Correct as states. Listed so they are not mistaken for the confirmation layer; they stay as they are.",
    specimens: [{ label: "Assorted", now: <Now.Marks />, next: <Next.MarksAfter />, why: "Kept small. One tick shape, a finished button reads green, and a chip settles in with its tick drawing when it flips in front of the person (not on page load)." }],
    flows: [
      f("Signed / Done / Filed badges", ["adv", "lit", "mag", "staff"], "many"),
      f("Saved indicator · Linked", ["staff"], "employee/order-*"),
      f("Field verified · password ok", ["adv", "lit"], "registration/*"),
    ],
  },
];


const CONFIRM = LANES.filter((l) => l.id !== "marks");
const STATS = {
  moments: CONFIRM.reduce((n, l) => n + l.flows.length, 0),
  patterns: CONFIRM.length,
  quiet: CONFIRM.filter((l) => ["toast-green", "toast-neutral", "silent"].includes(l.id)).reduce((n, l) => n + l.flows.length, 0),
};

const FAIL_STATS = {
  moments: FAIL_LANES.reduce((n, l) => n + l.flows.length, 0),
  patterns: FAIL_LANES.length,
  vanish: FAIL_LANES.filter((l) => ["err-toast", "block-toast"].includes(l.id)).reduce((n, l) => n + l.flows.length, 0),
};

type Section = "success" | "failure";

const WEIGHT = ["None", "Faint", "Quiet", "Clear", "Loud"];

function Chip({ p, dim }: { p: Persona; dim?: boolean }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap", PERSONA[p].cls, dim && "opacity-30")}>
      {PERSONA[p].label}
    </span>
  );
}

function WeightMeter({ w }: { w: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-caption text-muted-foreground">
      <span className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-2 w-5 rounded-sm", i <= w ? "bg-success" : "bg-surface-sunken ring-1 ring-hairline")} />
        ))}
      </span>
      Visual weight: {WEIGHT[w]}
    </span>
  );
}

function Pair({ s, all }: { s: Lane["specimens"][number]; all: number }) {
  const [run, setRun] = React.useState(0);
  return (
    <div className="flex items-start gap-8">
      <figure className="flex shrink-0 flex-col gap-3">
        <figcaption className="flex h-10 items-center gap-3">
          <span className="rounded-full bg-surface-sunken px-3 py-1 text-body font-semibold text-muted-foreground ring-1 ring-hairline">Today</span>
          <span className="text-body font-semibold">{s.label}</span>
        </figcaption>
        {s.now}
      </figure>
      <div className="flex shrink-0 self-center pt-12 text-muted-foreground"><ArrowRightIcon className="size-10" /></div>
      <figure className="flex shrink-0 flex-col gap-3">
        <figcaption className="flex h-10 items-center gap-3">
          <span className="rounded-full bg-success px-3 py-1 text-body font-semibold text-success-foreground">Proposed</span>
          <Button
            size="sm"
            variant="outline"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setRun((r) => r + 1)}
          >
            <RotateCcwIcon data-icon="inline-start" />Play motion
          </Button>
        </figcaption>
        <div key={`${all}-${run}`}>{s.next}</div>
        <p className="max-w-[820px] text-body text-pretty text-muted-foreground">{s.why}</p>
      </figure>
    </div>
  );
}

function LaneRow({ lane, focus, all }: { lane: Lane; focus: Persona | null; all: number }) {
  const hit = !focus || lane.flows.some((fl) => fl.who.includes(focus));
  return (
    <section className={cn("flex items-start gap-10 transition-opacity", !hit && "opacity-20")}>
      <div className="flex w-[420px] shrink-0 flex-col gap-4 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <div className="flex flex-col gap-2">
          <h2 className="text-title-s font-semibold">{lane.name}</h2>
          <WeightMeter w={lane.weight} />
          <p className="text-body-compact text-pretty text-muted-foreground">{lane.note}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-caption font-semibold text-muted-foreground">Used in {lane.flows.length} flows</p>
          <ul className="flex flex-col divide-y divide-hairline">
            {lane.flows.map((fl) => {
              const on = !focus || fl.who.includes(focus);
              return (
                <li key={fl.name} className={cn("flex flex-col gap-1 py-2", !on && "opacity-35")}>
                  <span className="text-body-compact font-medium">{fl.name}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    {fl.who.map((p) => <Chip key={p} p={p} />)}
                    <span className="ml-1 font-mono text-[11px] text-muted-foreground">{fl.file}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-14">
        {lane.specimens.map((s) => <Pair key={s.label} s={s} all={all} />)}
      </div>
    </section>
  );
}

function DeviceLane({ all }: { all: number }) {
  const rows = [
    ...DEVICES.map((d) => ({
      label: `Takeover · ${d.name}`,
      now: <BailToday d={d} />,
      next: <BailProposed d={d} />,
      why: d.w < 640
        ? "Phone: the flow is a full-screen window today, and stays one. Hero uses the compact size; buttons stack at the bottom."
        : "Tablet and up: the centred dialog at its 672px width, as today. Full-size hero.",
    })),
    ...DEVICES.filter((d) => d.w < 640 || d.w === 1366).map((d) => ({
      label: `Toast · ${d.name}`,
      now: <ToastToday d={d} />,
      next: <ToastProposed d={d} />,
      why: d.w < 640 ? "Phone: full width, 64px above the bottom edge, as today." : "Wide screens: centred on the page column, 56px up, as today.",
    })),
  ];
  return (
    <section className="flex items-start gap-10">
      <div className="flex w-[420px] shrink-0 flex-col gap-3 rounded-xl border border-hairline bg-card p-6 shadow-raised">
        <h2 className="text-title-s font-semibold">Across devices</h2>
        <p className="text-body-compact text-pretty text-muted-foreground">
          The reference success (bail application submitted) and the green toast at real device sizes: phone, iPad mini and iPad Pro, both orientations. Containers stay as they are today; only the look changes.
        </p>
      </div>
      <div className="flex flex-col gap-14">
        {rows.map((r) => <Pair key={r.label} s={r} all={all} />)}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ canvas */

type Cam = { x: number; y: number; z: number };

export default function SuccessBoardPage() {
  const viewport = React.useRef<HTMLDivElement>(null);
  const [cam, setCam] = React.useState<Cam>({ x: 40, y: 150, z: 0.35 });
  const [focus, setFocus] = React.useState<Persona | null>(null);
  const [replay, setReplay] = React.useState(0);
  // Which board: success, or failure and warning. Kept in the URL hash so a link opens it.
  const [section, setSection] = React.useState<Section>("success");
  const [mark, setMark] = React.useState<Next.MarkStyle>(Next.DEFAULT_MARK);
  React.useEffect(() => {
    if (window.location.hash === "#failure") setSection("failure");
  }, []);
  const show = (next: Section) => {
    setSection(next);
    window.history.replaceState(null, "", next === "failure" ? "#failure" : "#");
    setCam({ x: 40, y: 150, z: 0.35 });
  };
  const drag = React.useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const anchors = React.useRef<Record<string, HTMLElement | null>>({});

  const zoomAt = React.useCallback((factor: number, px?: number, py?: number) => {
    setCam((c) => {
      const rect = viewport.current?.getBoundingClientRect();
      const ox = px ?? (rect ? rect.width / 2 : 0);
      const oy = py ?? (rect ? rect.height / 2 : 0);
      const z = Math.min(2, Math.max(0.08, c.z * factor));
      const k = z / c.z;
      return { z, x: ox - (ox - c.x) * k, y: oy - (oy - c.y) * k };
    });
  }, []);

  React.useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setCam((c) => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const jump = (id: string) => {
    const target = anchors.current[id];
    const rect = viewport.current?.getBoundingClientRect();
    if (!target || !rect) return;
    const z = 0.32;
    setCam({ z, x: 40 - target.offsetLeft * z, y: 150 - target.offsetTop * z });
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-muted dark:bg-background"
      // Focusing a sample field would scroll this frame and carry the toolbar away.
      onScroll={(e) => { e.currentTarget.scrollTop = 0; e.currentTarget.scrollLeft = 0; }}
    >
      <style>{Next.PROPOSED_CSS}</style>
      <Next.MarkStyleContext.Provider value={mark}>
      <div
        ref={viewport}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setCam((c) => ({ ...c, x: d.cx + e.clientX - d.x, y: d.cy + e.clientY - d.y }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: `${24 * cam.z}px ${24 * cam.z}px`,
          backgroundPosition: `${cam.x}px ${cam.y}px`,
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left select-none"
          style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})` }}
        >
          <div className="flex w-max flex-col gap-24 p-10">
            {/* ---------------------------------------------------- intro */}
            <header ref={(n) => { anchors.current.current = n; }} className="flex max-w-[1600px] flex-col gap-6">
              {section === "success" ? (
                <>
                  <p className="text-title-s font-semibold text-muted-foreground">Success states audit · main @ 90bbc31 · 29 Oct 2026</p>
                  <h1 className="text-[72px] leading-none font-semibold tracking-tight">How the product says “it worked”</h1>
                  <div className="flex gap-10 text-title-s">
                    <Stat n={String(STATS.moments)} l="success moments mapped" />
                    <Stat n={String(STATS.patterns)} l="visual patterns" />
                    <Stat n="0" l="shared success component" />
                    <Stat n={`${STATS.quiet}`} l="are a toast or nothing" />
                  </div>
                  <div className="flex flex-col gap-4 rounded-2xl border-2 border-success bg-card p-8">
                    <div className="flex items-baseline gap-4">
                      <span className="rounded-full bg-success px-3 py-1 text-body font-semibold text-success-foreground">Proposed</span>
                      <h2 className="text-[40px] leading-none font-semibold tracking-tight">One mark, three weights</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <Rule t="Takeover" b="Anything that reaches the court, moves money or adds a signature. Filing, paying, signing, submitting, registering, approving, issuing an order." />
                      <Rule t="Confirmation toast" b="Quick acts where the page stays put. Access changes, reminders, archive, mark done, single sign from a queue." />
                      <Rule t="Landing highlight" b="Every time a dialog closes back onto a list, the row it changed glows once. Pairs with either of the above." />
                    </div>
                    <p className="text-body text-muted-foreground">
                      Every row below: today on the left, proposed on the right. Play motion replays one; the toolbar plays all. The motion: disc pops, check draws, one ring pulse, text rises. About 600ms, off under reduced motion.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-title-s font-semibold text-muted-foreground">Failure and warning audit · main @ 90bbc31 · 29 Oct 2026</p>
                  <h1 className="text-[72px] leading-none font-semibold tracking-tight">How the product says “it didn’t work”</h1>
                  <div className="flex gap-10 text-title-s">
                    <Stat n={String(FAIL_STATS.moments)} l="failure and warning moments mapped" />
                    <Stat n={String(FAIL_STATS.patterns)} l="visual patterns" />
                    <Stat n="1" l="failure drawn in success green" />
                    <Stat n={String(FAIL_STATS.vanish)} l="vanish in 4s as a toast today" />
                  </div>
                  <div className="flex flex-col gap-4 rounded-2xl border-2 border-destructive bg-card p-8">
                    <div className="flex items-baseline gap-4">
                      <span className="rounded-full bg-destructive px-3 py-1 text-body font-semibold text-destructive-foreground">Proposed</span>
                      <h2 className="text-[40px] leading-none font-semibold tracking-tight">Same mark, two more tones</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <Rule t="Error · red cross" b="The act did not happen or was refused. Same takeover, toast and inline line as success. Error toasts stay until closed." />
                      <Rule t="Warning · amber !" b="Only where today is already a warning: partial results, late notices, offline, lookups that miss. Warning toasts last 2.75s." />
                      <Rule t="Neutral · grey ring" b="Gates, questions and dead ends are not bad news. A quiet disc with the act's own icon. Confirms use it too, with today's soft red button for removals." />
                    </div>
                    <p className="text-body text-muted-foreground">
                      Missing input points at the field: it turns red, says what is missing and takes focus. Motion is budgeted by size: heroes play the full mark (about 600ms); toasts and inline lines only pop in (250ms); badges and field errors move only when they change. One animated mark per view; marks that belong together play in order. Shake only when the person’s input was refused. The last lane designs the failure states the product does not have yet.
                    </p>
                  </div>
                </>
              )}
            </header>

            {section === "success" ? (
              <>
                {LANES.map((lane) => <LaneRow key={lane.id} lane={lane} focus={focus} all={replay} />)}
                <DeviceLane all={replay} />
              </>
            ) : (
              <>
                <MarkPicker value={mark} onChange={setMark} />
                {FAIL_LANES.map((lane) => <LaneRow key={lane.id} lane={lane} focus={focus} all={replay} />)}
              </>
            )}

          </div>
        </div>
      </div>

      </Next.MarkStyleContext.Provider>

      {/* --------------------------------------------------------- HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl bg-popover p-2 shadow-overlay ring-1 ring-hairline">
          <span className="px-2 text-body-compact font-semibold">States board</span>
          <span className="flex rounded-lg bg-surface-sunken p-0.5">
            <Button size="sm" variant={section === "success" ? "outline" : "ghost"} onClick={() => show("success")}>Success</Button>
            <Button size="sm" variant={section === "failure" ? "outline" : "ghost"} onClick={() => show("failure")}>Failure &amp; warning</Button>
          </span>
          <Button size="sm" variant="ghost" onClick={() => jump("current")}>Top</Button>
          <Button size="sm" variant="ghost" onClick={() => setReplay((r) => r + 1)}><RotateCcwIcon data-icon="inline-start" />Play all motion</Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <span className="px-1 text-caption text-muted-foreground">Show</span>
          <Button size="sm" variant={focus === null ? "secondary" : "ghost"} onClick={() => setFocus(null)}>Everyone</Button>
          {(Object.keys(PERSONA) as Persona[]).map((p) => (
            <Button key={p} size="sm" variant={focus === p ? "secondary" : "ghost"} onClick={() => setFocus(focus === p ? null : p)}>
              {PERSONA[p].label}
            </Button>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl bg-popover p-2 shadow-overlay ring-1 ring-hairline">
          <Button size="icon-sm" variant="ghost" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.25)}><MinusIcon /></Button>
          <span className="w-12 text-center text-caption tabular-nums">{Math.round(cam.z * 100)}%</span>
          <Button size="icon-sm" variant="ghost" aria-label="Zoom in" onClick={() => zoomAt(1.25)}><PlusIcon /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Fit" onClick={() => setCam({ x: 40, y: 40, z: 0.12 })}><MaximizeIcon /></Button>
        </div>
      </div>
      <p className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-popover/90 px-3 py-1.5 text-caption text-muted-foreground ring-1 ring-hairline">
        Drag or scroll to move · ⌘/ctrl + scroll or pinch to zoom
      </p>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-card px-6 py-4">
      <span className="text-[44px] leading-none font-semibold tabular-nums">{n}</span>
      <span className="text-body text-muted-foreground">{l}</span>
    </div>
  );
}

function Rule({ t, b }: { t: string; b: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-card p-6">
      <span className="text-title-s font-semibold">{t}</span>
      <span className="text-body text-muted-foreground">{b}</span>
    </div>
  );
}
