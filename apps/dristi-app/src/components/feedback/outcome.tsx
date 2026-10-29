"use client";

import * as React from "react";

import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { StatusMark, type MarkTone } from "./mark";

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
 * rise a few pixels after it.
 */

type HeaderTone = Exclude<MarkTone, "neutral" | "danger">;

/* The band fades from the tone's muted fill into the dialog surface. Both ends are opaque
   tokens; the blend is a DS request (ds-requests #24), not an invented fill. */
const BAND: Record<HeaderTone, string> = {
  success: "var(--success-muted)",
  error: "var(--destructive-muted)",
  warning: "var(--warning-muted)",
  info: "var(--info-muted)",
};

export function OutcomeHeader({
  tone = "success",
  title,
  body,
  compact = false,
  inDialog = true,
  reject = false,
  children,
  className,
}: {
  tone?: HeaderTone;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Dialogs narrower than about 480px, and phone sheets. */
  compact?: boolean;
  /** Renders the title and body as the dialog's own title and description. */
  inDialog?: boolean;
  /** Only when the person's own input was refused. */
  reject?: boolean;
  /** Extra lines under the body, such as a labelled amount. */
  children?: React.ReactNode;
  className?: string;
}) {
  const Title = inDialog ? DialogTitle : "h2";
  const Body = inDialog ? DialogDescription : "p";
  return (
    <div
      role="status"
      className={cn(
        "fb-band relative flex shrink-0 flex-col items-center gap-4 border-b border-hairline text-center",
        compact ? "px-6 pt-8 pb-6" : "px-12 pt-12 pb-8",
        className,
      )}
      style={{ background: `linear-gradient(180deg, ${BAND[tone]} 0%, color-mix(in oklab, ${BAND[tone]} 55%, var(--popover)) 100%)` }}
    >
      <StatusMark tone={tone} size={compact ? 60 : 72} reject={reject} />
      <div className="flex max-w-md flex-col items-center gap-1.5">
        <Title
          className={cn("fb-rise font-semibold text-balance text-foreground", compact ? "text-title-s" : "text-title")}
          style={{ animationDelay: "180ms" }}
        >
          {title}
        </Title>
        {body ? (
          <Body className="fb-rise text-body text-pretty text-muted-foreground" style={{ animationDelay: "240ms" }}>
            {body}
          </Body>
        ) : null}
        {children ? (
          <div className="fb-rise flex flex-col items-center pt-1" style={{ animationDelay: "280ms" }}>
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
  children,
  className,
}: {
  label?: React.ReactNode;
  aside?: React.ReactNode;
  /** The label is the outcome itself (Every signature is in, Account rejected). Green for
      success, never teal: teal is the action colour and reads as clickable. */
  tone?: "success" | "error";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("fb-rise overflow-hidden rounded-xl bg-surface-sunken", className)} style={{ animationDelay: "320ms" }}>
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
}: {
  label: React.ReactNode;
  done: number;
  failed: number;
  doneLine: React.ReactNode;
  failedLine: React.ReactNode;
  failedTone?: "warning" | "error";
}) {
  const total = done + failed;
  const fill = failedTone === "warning" ? "var(--warning)" : "var(--destructive)";
  return (
    <OutcomeSummary
      label={label}
      aside={
        <span className="text-body-compact tabular-nums text-muted-foreground">
          {done} of {total}
        </span>
      }
    >
      <div className="flex gap-1 pt-3" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn("fb-fill h-2 flex-1 rounded-full", i < done && "bg-success")}
            style={{
              animationDelay: `${300 + i * 80}ms`,
              background:
                i < done
                  ? undefined
                  : `repeating-linear-gradient(45deg, ${fill} 0 3px, color-mix(in oklab, ${fill} 62%, var(--card)) 3px 5px)`,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col py-1">
        <li className="flex items-center gap-2.5 border-b border-hairline py-2.5">
          <StatusMark size={20} delay={300 + total * 80 + 120} />
          <span className="text-body-compact">{doneLine}</span>
        </li>
        <li className="flex items-center gap-2.5 py-2.5">
          <StatusMark size={20} tone={failedTone} delay={300 + total * 80 + 280} />
          <span className="text-body-compact font-semibold">{failedLine}</span>
        </li>
      </ul>
    </OutcomeSummary>
  );
}

/**
 * A whole page that is an outcome (account ready, page could not load) or a dead end
 * (not found, link no longer active). Outcomes get a very soft glow in their tone; a dead
 * end is neutral and stays flat, because a wrong link is not bad news.
 */
export function PageOutcome({
  tone,
  icon,
  title,
  body,
  action,
  as: Heading = "h1",
  align = "center",
  className,
}: {
  tone: MarkTone;
  icon?: React.ComponentProps<typeof StatusMark>["icon"];
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h1" | "h2" | "p";
  align?: "center" | "start";
  className?: string;
}) {
  const glow =
    tone === "success"
      ? "var(--success-muted)"
      : tone === "error"
        ? "color-mix(in oklab, var(--destructive-muted) 45%, var(--background))"
        : undefined;
  return (
    <div className={cn("relative isolate flex w-full flex-col gap-4", align === "center" ? "items-center text-center" : "items-start", className)}>
      {glow ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-16 -inset-y-24 -z-10"
          style={{ background: `radial-gradient(ellipse at 50% 32%, ${glow}, transparent 60%)` }}
        />
      ) : null}
      <StatusMark tone={tone} icon={icon} size={56} />
      <div className={cn("flex max-w-md flex-col gap-2", align === "center" && "items-center")}>
        <Heading className="fb-rise text-title font-semibold text-balance" style={{ animationDelay: "150ms" }}>
          {title}
        </Heading>
        {body ? (
          <p className="fb-rise text-body text-pretty text-muted-foreground" style={{ animationDelay: "210ms" }}>
            {body}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
