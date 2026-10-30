"use client";

import * as React from "react";

import { AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { HERO_START, StatusMark, type MarkTone } from "./mark";

/**
 * Outcomes: what an act came to, said at the weight the act deserves.
 *
 * - `OutcomeHeader` is the **takeover**: the top of a dialog becomes the confirmation,
 *   for anything that reaches the court, moves money or adds a signature (or failed to).
 *   It replaces the tinted-disc header, the thin strip, the solid slabs and panels, and
 *   the centred disc that the product used before.
 * - `OutcomeSummary` groups the facts under it into one named well.
 * - `OutcomeTally` is for a partial result: the hero says only what fully happened; the
 *   tally shows the split, with one marked line per outcome.
 * - `PageOutcome` is the same idea at page scale, and the dead end.
 *
 * Text never animates sideways. The header's band fades in, its mark plays, and its words
 * rise a few pixels after it. Every piece takes `still` for an outcome that is already
 * true when the screen opens (a dialog reopened onto a settled act): a settled act is not
 * an entrance.
 */

type HeaderTone = Exclude<MarkTone, "danger">;

/* The band fades from the tone's muted fill into the surface it sits on. Both ends are
   opaque tokens; the blend itself is on record as a DS request (ds-requests #24). */
const BAND: Record<HeaderTone, string> = {
  success: "var(--success-muted)",
  error: "var(--destructive-muted)",
  warning: "var(--warning-muted)",
  info: "var(--info-muted)",
  /* Nothing happened, and nothing went wrong (every item was already done). */
  neutral: "var(--surface-sunken)",
};

const SURFACE = {
  popover: "var(--popover)",
  card: "var(--card)",
  /* StagedOverlay's stage: muted in light, the page colour in dark (feedback.css). */
  canvas: "var(--fb-canvas)",
} as const;

/**
 * Where the outcome's title and body come from:
 * - `"dialog"`: they become a plain `Dialog`'s own title and description, for a dialog
 *   whose header is replaced by the outcome.
 * - `"alert-dialog"`: the same, inside an `AlertDialog` (a confirm that turns into its
 *   result). Its title primitive is scoped, so the plain one would throw there.
 * - `"plain"` (default): a heading and a paragraph. Use it inside `StagedOverlay`, which
 *   already renders the dialog's title, and anywhere outside a dialog.
 */
type TitleSource = "dialog" | "alert-dialog" | "plain";

export function OutcomeHeader({
  tone = "success",
  title,
  body,
  compact = false,
  titleFrom = "plain",
  focusTitle = false,
  surface = "popover",
  still = false,
  reject = false,
  icon,
  children,
  className,
}: {
  tone?: HeaderTone;
  /** Neutral only: the act's own icon. */
  icon?: React.ComponentProps<typeof StatusMark>["icon"];
  /** Omit when the dialog's own header already says the outcome (StagedOverlay keeps its
      header on every stage, owner 2026-09): the band then carries the mark and the line. */
  title?: React.ReactNode;
  body?: React.ReactNode;
  /** Dialogs narrower than about 480px, and phone sheets. */
  compact?: boolean;
  titleFrom?: TitleSource;
  /** Move focus to the title when the outcome replaces a stage in an open dialog, so
      screen readers announce it and keyboard users start from it (ui-craft motion). */
  focusTitle?: boolean;
  /** What the band fades into: the surface behind it. */
  surface?: keyof typeof SURFACE;
  still?: boolean;
  /** Only when the person's own input was refused. */
  reject?: boolean;
  /** Extra lines under the body, such as a labelled amount. */
  children?: React.ReactNode;
  className?: string;
}) {
  const Title = titleFrom === "dialog" ? DialogTitle : titleFrom === "alert-dialog" ? AlertDialogTitle : "h2";
  const Body = titleFrom === "dialog" ? DialogDescription : titleFrom === "alert-dialog" ? AlertDialogDescription : "p";
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle]);
  /* The words follow the mark, so they wait for it too. */
  const rise = (ms: number) => (still ? undefined : { animationDelay: `${HERO_START + ms}ms` });

  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col items-center gap-4 border-b border-hairline text-center",
        !still && "fb-band",
        /* Full size from tablet up; a phone sheet always gets the compact measure. */
        compact ? "px-6 pt-8 pb-6" : "px-6 pt-8 pb-6 sm:px-12 sm:pt-12 sm:pb-8",
        className,
      )}
      style={{ background: `linear-gradient(180deg, ${BAND[tone]} 0%, color-mix(in oklab, ${BAND[tone]} 55%, ${SURFACE[surface]}) 100%)` }}
    >
      <StatusMark tone={tone} icon={icon} size={compact ? 60 : 72} reject={reject} still={still} className={compact ? undefined : "max-sm:size-15"} />
      <div className="flex max-w-md flex-col items-center gap-1.5">
        {title ? (
        <Title
          ref={titleRef}
          tabIndex={focusTitle ? -1 : undefined}
          className={cn(
            "text-balance text-foreground outline-none",
            !still && "fb-rise",
            compact ? "text-title-s font-semibold" : "text-title-s font-semibold sm:text-title",
          )}
          style={rise(180)}
        >
          {title}
        </Title>
        ) : null}
        {body ? (
          <Body className={cn("text-body text-pretty", title ? "text-muted-foreground" : "text-foreground", !still && "fb-rise")} style={rise(240)}>
            {body}
          </Body>
        ) : null}
        {children ? (
          <div className={cn("flex flex-col items-center pt-1", !still && "fb-rise")} style={rise(280)}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** "Amount paid · ₹1,250" under a payment outcome's title: the amount is always labelled. */
export function OutcomeAmount({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <>
      <span className="text-caption font-medium text-muted-foreground">{label}</span>
      <span className="text-title-s font-semibold tabular-nums">{value}</span>
    </>
  );
}

/** The facts under an outcome, grouped into one named well so the list says what it is. */
export function OutcomeSummary({
  label,
  aside,
  tone,
  still = false,
  children,
  className,
}: {
  label?: React.ReactNode;
  aside?: React.ReactNode;
  /** The label is the outcome itself (Every signature is in, Account rejected). Green for
      success, never teal: teal is the action colour and reads as clickable. */
  tone?: "success" | "error";
  still?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-xl bg-surface-sunken", !still && "fb-rise", className)}
      style={still ? undefined : { animationDelay: `${HERO_START + 320}ms` }}
    >
      {label ? (
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
          <span
            className={cn(
              "text-body-compact font-semibold",
              tone === "success" && "text-success-ink",
              tone === "error" && "text-destructive-ink",
            )}
          >
            {label}
          </span>
          {aside}
        </div>
      ) : null}
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

/* Up to this many items, one segment each; beyond it, two proportional segments. */
const PER_ITEM_MAX = 12;
/* The whole bar fills within this, however many segments there are. */
const FILL_SPAN_MS = 600;

/**
 * A partial result. The failed share carries fine stripes as well as its colour, so the
 * split reads in greyscale. The two lines pop in order, after the bar fills.
 */
export function OutcomeTally({
  label,
  done,
  failed,
  doneLine,
  failedLine,
  failedTone = "warning",
  still = false,
}: {
  label: React.ReactNode;
  done: number;
  failed: number;
  doneLine: React.ReactNode;
  failedLine: React.ReactNode;
  failedTone?: "warning" | "error";
  still?: boolean;
}) {
  const total = done + failed;
  const fill = failedTone === "warning" ? "var(--warning)" : "var(--destructive)";
  const stripes = `repeating-linear-gradient(45deg, ${fill} 0 3px, color-mix(in oklab, ${fill} 40%, var(--card)) 3px 5px)`;
  const segments: { ok: boolean; grow: number }[] =
    total <= PER_ITEM_MAX
      ? Array.from({ length: total }, (_, i) => ({ ok: i < done, grow: 1 }))
      : [
          { ok: true, grow: done },
          { ok: false, grow: failed },
        ].filter((s) => s.grow > 0);
  const step = segments.length > 1 ? Math.min(80, FILL_SPAN_MS / segments.length) : 0;
  const linesAt = HERO_START + 300 + segments.length * step + 120;

  return (
    <OutcomeSummary
      label={label}
      still={still}
      aside={
        <span className="text-body-compact tabular-nums text-muted-foreground">
          {done} of {total}
        </span>
      }
    >
      <div className="flex gap-1 pt-3" aria-hidden>
        {segments.map((s, i) => (
          <span
            key={i}
            className={cn("h-2 rounded-full", s.ok && "bg-success", !still && "fb-fill")}
            style={{
              flexGrow: s.grow,
              flexBasis: 0,
              animationDelay: still ? undefined : `${HERO_START + 300 + i * step}ms`,
              background: s.ok ? undefined : stripes,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col py-1">
        <li className="flex items-center gap-2.5 border-b border-hairline py-2.5">
          <StatusMark size={20} still={still} delay={linesAt} />
          <span className="text-body-compact">{doneLine}</span>
        </li>
        <li className="flex items-center gap-2.5 py-2.5">
          <StatusMark size={20} tone={failedTone} still={still} delay={linesAt + 160} />
          <span className="text-body-compact font-semibold">{failedLine}</span>
        </li>
      </ul>
    </OutcomeSummary>
  );
}

/**
 * A whole page that is an outcome (account ready, page could not load) or a dead end
 * (not found, link no longer active). Outcomes get a very soft glow in their tone, kept
 * inside the component so it never widens the page; a dead end is neutral and stays flat,
 * because a wrong link is not bad news. `scale="hero"` is for a page whose only content is
 * the outcome (account ready): a 96px mark and a display-size title.
 */
export function PageOutcome({
  tone,
  icon,
  title,
  body,
  action,
  as: Heading = "h1",
  align = "center",
  scale = "page",
  still = false,
  className,
}: {
  tone: MarkTone;
  icon?: React.ComponentProps<typeof StatusMark>["icon"];
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h1" | "h2" | "p";
  align?: "center" | "start";
  scale?: "page" | "hero";
  still?: boolean;
  className?: string;
}) {
  const glow =
    tone === "success"
      ? "var(--success-muted)"
      : tone === "error"
        ? "color-mix(in oklab, var(--destructive-muted) 45%, var(--background))"
        : undefined;
  /* The words follow the mark, so they wait for it too. */
  const rise = (ms: number) => (still ? undefined : { animationDelay: `${HERO_START + ms}ms` });
  return (
    <div
      className={cn(
        "relative isolate flex w-full flex-col gap-4 overflow-hidden px-4 py-8",
        align === "center" ? "items-center text-center" : "items-start",
        className,
      )}
    >
      {glow ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: `radial-gradient(ellipse at 50% 32%, ${glow}, var(--background) 70%)` }}
        />
      ) : null}
      <StatusMark tone={tone} icon={icon} size={scale === "hero" ? 96 : 56} still={still} />
      {/* Centred text keeps a short measure; a left-aligned page keeps its column's. */}
      <div className={cn("flex flex-col gap-2", align === "center" ? "max-w-md items-center" : "max-w-2xl")}>
        <Heading
          className={cn("font-semibold text-balance", scale === "hero" ? "text-display-s" : "text-title", !still && "fb-rise")}
          style={rise(150)}
        >
          {title}
        </Heading>
        {body ? (
          <p className={cn("text-body text-pretty text-muted-foreground", !still && "fb-rise")} style={rise(210)}>
            {body}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
