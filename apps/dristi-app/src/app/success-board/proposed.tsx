"use client";

import * as React from "react";
import { ArchiveIcon, ArrowRightIcon, CheckIcon, DownloadIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";

import { DialogBox, FauxPage, Screen } from "./frames";

/* Proposed success language. One mark, three weights:
   1. Takeover      — the dialog's top becomes the confirmation (consequential acts).
   2. Confirm toast — a real object on the page, not a tint (quick acts).
   3. Landing       — the row that changed glows once when the dialog closes onto it.
   Built only from DS tokens; motion respects prefers-reduced-motion. */

export const PROPOSED_CSS = `
@keyframes sb-pop { 0% { transform: scale(.55); opacity: 0 } 60% { transform: scale(1.06); opacity: 1 } 100% { transform: scale(1) } }
@keyframes sb-draw { from { stroke-dashoffset: 30 } to { stroke-dashoffset: 0 } }
@keyframes sb-ring { 0% { transform: scale(1); opacity: .45 } 100% { transform: scale(1.9); opacity: 0 } }
@keyframes sb-rise { from { transform: translateY(8px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes sb-band { from { opacity: 0 } to { opacity: 1 } }
@keyframes sb-toast { 0% { transform: translateY(24px) scale(.96); opacity: 0 } 70% { transform: translateY(-2px) scale(1); opacity: 1 } 100% { transform: none } }
@keyframes sb-drain { from { transform: scaleX(1) } to { transform: scaleX(0) } }
@keyframes sb-land { 0%,35% { background: var(--success-muted); box-shadow: inset 3px 0 0 var(--success) } 100% { background: transparent; box-shadow: inset 3px 0 0 transparent } }
@keyframes sb-flip { 0%,35% { transform: rotate(0) } 100% { transform: rotate(180deg) } }
@keyframes sb-chip { from { transform: scale(.88); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes sb-shake { 0%,100% { transform: none } 25% { transform: translateX(-2px) } 50% { transform: translateX(2px) } 75% { transform: translateX(-1px) } }
@keyframes sb-stroke { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.18); opacity: 1 } 100% { transform: scale(1) } }
@keyframes sb-bar { 0% { transform: translateY(-9px); opacity: 0 } 65% { transform: translateY(1.5px); opacity: 1 } 100% { transform: none } }
@keyframes sb-ring-soft { 0% { transform: scale(1); opacity: .3 } 100% { transform: scale(1.7); opacity: 0 } }
@keyframes sb-dot { 0% { transform: scale(0) } 60% { transform: scale(1.45) } 100% { transform: scale(1) } }
@keyframes sb-icon { 0% { transform: scale(.55); opacity: 0 } 70% { transform: scale(1.06); opacity: 1 } 100% { transform: none } }
@keyframes sb-reveal { from { grid-template-rows: 0fr } to { grid-template-rows: 1fr } }
@keyframes sb-errdrop { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: none } }
@keyframes sb-ringin { from { box-shadow: 0 0 0 0 color-mix(in oklab, var(--destructive) 40%, transparent) } to { box-shadow: 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent) } }
@keyframes sb-errline { from { opacity: 0; transform: translateY(-3px) } to { opacity: 1; transform: none } }
@keyframes sb-pop-quick { 0% { transform: scale(.7); opacity: 0 } 70% { transform: scale(1.04); opacity: 1 } 100% { transform: none } }
@keyframes sb-spin { 0% { transform: rotate(-180deg) scale(.2); opacity: 0 } 70% { transform: rotate(12deg) scale(1.08); opacity: 1 } 100% { transform: none } }
@keyframes sb-stamp { 0% { transform: scale(1.6); opacity: 0 } 55% { transform: scale(.94); opacity: 1 } 100% { transform: scale(1) } }
@keyframes sb-thud { 0%,100% { transform: none } 30% { transform: translateY(2px) } }
@keyframes sb-nod { 0%,100% { transform: none } 20% { transform: rotate(-12deg) } 45% { transform: rotate(10deg) } 70% { transform: rotate(-5deg) } }
@keyframes sb-swing { 0%,100% { transform: none } 20% { transform: rotate(16deg) } 45% { transform: rotate(-11deg) } 70% { transform: rotate(5deg) } }
@keyframes sb-sway { 0%,100% { transform: none } 30% { transform: rotate(5deg) } 65% { transform: rotate(-3deg) } }
@keyframes sb-glow { 0%,100% { box-shadow: 0 0 0 0 transparent } 30%,70% { box-shadow: 0 0 0 8px color-mix(in oklab, var(--warning) 28%, transparent) } 50% { box-shadow: 0 0 0 3px color-mix(in oklab, var(--warning) 18%, transparent) } }
@keyframes sb-drop { 0% { transform: translateY(-28px); opacity: 0 } 55% { transform: translateY(3px); opacity: 1 } 75% { transform: translateY(-4px) } 100% { transform: none } }
@keyframes sb-glyph { 0% { transform: scale(.3); opacity: 0 } 65% { transform: scale(1.12); opacity: 1 } 100% { transform: none } }
@keyframes sb-wave { 0% { transform: rotate(-35deg) scale(.6); opacity: 0 } 50% { transform: rotate(10deg) scale(1); opacity: 1 } 75% { transform: rotate(-5deg) } 100% { transform: none } }
@keyframes sb-widen { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes sb-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
.sb-pop { animation: sb-pop 420ms cubic-bezier(.34,1.56,.64,1) both }
.sb-draw { stroke-dasharray: 30; animation: sb-draw 360ms 260ms cubic-bezier(.65,0,.35,1) both }
.sb-ring { animation: sb-ring 900ms 200ms ease-out both }
.sb-rise { animation: sb-rise 360ms cubic-bezier(.2,.8,.2,1) both }
.sb-band { animation: sb-band 300ms ease-out both }
.sb-toast { animation: sb-toast 420ms cubic-bezier(.2,.8,.2,1) both }
.sb-drain { transform-origin: left; animation: sb-drain var(--sb-life, 2.75s) linear both }
.sb-land { animation: sb-land 2600ms ease-out both }
.sb-flip { transform-box: fill-box; transform-origin: center; animation: sb-flip 900ms 250ms cubic-bezier(.65,0,.35,1) both }
.sb-chip { animation: sb-chip 220ms cubic-bezier(.2,.8,.2,1) both }
.sb-shake { animation: sb-shake 260ms 620ms ease-in-out both }
.sb-stroke { transform-box: fill-box; transform-origin: center; animation: sb-stroke 400ms 200ms cubic-bezier(.34,1.56,.64,1) both }
.sb-bar { animation: sb-bar 280ms 150ms cubic-bezier(.34,1.56,.64,1) both }
.sb-dot { transform-box: fill-box; transform-origin: center; animation: sb-dot 220ms 330ms cubic-bezier(.34,1.56,.64,1) both }
.sb-ring-soft { animation: sb-ring-soft 650ms 330ms ease-out both }
.sb-icon { animation: sb-icon 380ms 180ms cubic-bezier(.3,1.3,.5,1) both }
.sb-errline { animation: sb-errline 220ms ease-out both }
/* An error line opens its own room and drops out from under the field, clipped at the
   field's edge, so it reads as coming from the field, not fading in from nowhere. */
.sb-reveal { display: grid; animation: sb-reveal 220ms cubic-bezier(.2,.8,.2,1) both }
.sb-reveal > * { min-height: 0; overflow: hidden }
.sb-errdrop { animation: sb-errdrop 300ms 60ms cubic-bezier(.2,.8,.2,1) both }
.sb-ringin { animation: sb-ringin 260ms ease-out both }
.sb-pop-quick { animation: sb-pop-quick 250ms cubic-bezier(.2,.9,.3,1.2) both }
.sb-spin { transform-box: fill-box; transform-origin: center; animation: sb-spin 560ms 160ms cubic-bezier(.34,1.56,.64,1) both }
.sb-stamp { animation: sb-stamp 380ms cubic-bezier(.2,.9,.3,1) both }
.sb-thud { animation: sb-thud 220ms 300ms ease-out both }
.sb-nod { animation: sb-nod 620ms 560ms ease-in-out both }
.sb-swing { transform-origin: 50% 8%; animation: sb-swing 900ms 420ms ease-in-out both }
.sb-sway { transform-origin: 50% 15%; animation: sb-sway 420ms 330ms ease-in-out both }
.sb-glow > span { animation: sb-glow 1400ms 380ms ease-in-out both }
.sb-drop { animation: sb-drop 640ms cubic-bezier(.3,1.3,.5,1) both }
.sb-glyph { transform-box: fill-box; transform-origin: center; animation: sb-glyph 420ms 180ms cubic-bezier(.34,1.56,.64,1) both }
.sb-wave { transform-box: fill-box; transform-origin: 10% 100%; animation: sb-wave 700ms 180ms ease-out both }
.sb-widen { transform-box: fill-box; transform-origin: center; animation: sb-widen 360ms 200ms cubic-bezier(.34,1.56,.64,1) both }
.sb-fill { transform-origin: left; animation: sb-fill 700ms cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) {
  .sb-pop, .sb-draw, .sb-ring, .sb-rise, .sb-band, .sb-toast, .sb-drain, .sb-land, .sb-fill, .sb-flip, .sb-chip, .sb-shake, .sb-stroke, .sb-bar, .sb-dot, .sb-ring-soft, .sb-icon, .sb-spin, .sb-stamp, .sb-thud, .sb-nod, .sb-swing, .sb-sway, .sb-glow > span, .sb-drop, .sb-glyph, .sb-wave, .sb-widen, .sb-pop-quick, .sb-errline, .sb-reveal, .sb-errdrop, .sb-ringin { animation: none }
  .sb-ring-soft { opacity: 0 }
  .sb-ring { opacity: 0 }
}
`;

export type Tone = "success" | "info" | "error" | "warning" | "neutral" | "danger";
const TONE: Record<Tone, { solid: string; fg: string; muted: string; edge: string }> = {
  error: { solid: "var(--destructive)", fg: "var(--destructive-foreground)", muted: "var(--destructive-muted)", edge: "var(--destructive-7)" },
  warning: { solid: "var(--warning)", fg: "var(--warning-foreground)", muted: "var(--warning-muted)", edge: "var(--warning-7)" },
  success: { solid: "var(--success)", fg: "var(--success-foreground)", muted: "var(--success-muted)", edge: "var(--success-7)" },
  info: { solid: "var(--info)", fg: "var(--info-foreground)", muted: "var(--info-muted)", edge: "var(--info-7)" },
  /* Not good or bad news: a quiet disc with a hairline ring and the act's own icon. */
  neutral: {
    solid: "var(--surface-sunken)",
    fg: "color-mix(in oklab, var(--foreground) 78%, transparent)",
    muted: "var(--surface-sunken)",
    edge: "var(--border)",
  },
  /* A confirm for a removal: the soft red of today's destructive button. */
  danger: { solid: "var(--destructive-muted)", fg: "var(--destructive-ink)", muted: "var(--destructive-muted)", edge: "var(--destructive-7)" },
};

/* ------------------------------------------------- mark style, pickable */

export type ErrorAnim = "spring" | "spin" | "stamp" | "nod";
export type WarnGlyph = "bang" | "triangle" | "flag" | "minus";
export type WarnAnim = "sway" | "pulse" | "swing" | "glow" | "drop";
export type MarkStyle = { errorAnim: ErrorAnim; warnGlyph: WarnGlyph; warnAnim: WarnAnim };
export const DEFAULT_MARK: MarkStyle = { errorAnim: "spring", warnGlyph: "bang", warnAnim: "sway" };
/** The board's chosen style; the picker sets it and every mark on the board follows. */
export const MarkStyleContext = React.createContext<MarkStyle>(DEFAULT_MARK);

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;

function WarnPath({ glyph, anim, small }: { glyph: WarnGlyph; anim: boolean; small: boolean }) {
  const c = (name: string) => (anim ? name : undefined);
  if (glyph === "triangle") {
    return (
      <g className={c("sb-glyph")}>
        <path d="M12 3.6 21.4 19.8H2.6Z" strokeWidth={2.2} />
        <path d="M12 9.6v4.6" strokeWidth={2.4} />
        <circle cx="12" cy="17" r="1.25" fill="currentColor" stroke="none" />
      </g>
    );
  }
  if (glyph === "flag") {
    return (
      <g className={c("sb-wave")}>
        <path d="M4.5 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeWidth={2.2} />
        <path d="M4.5 22v-7" strokeWidth={2.2} />
      </g>
    );
  }
  if (glyph === "minus") return <path className={c("sb-widen")} d="M6 12h12" />;
  /* A filled bar and dot with a clear gap: the shape reads as "!" without the colour.
     Slim at hero size; a touch heavier when small so it does not break up. */
  const w = small ? 3.6 : 3;
  return (
    <g fill="currentColor" stroke="none">
      <rect className={c("sb-bar")} x={12 - w / 2} y="3.5" width={w} height="11" rx={w / 2} />
      <circle className={c("sb-dot")} cx="12" cy="19.2" r={small ? 2.1 : 1.8} />
    </g>
  );
}

/** The one mark, in six tones.
    Motion is budgeted by size: a hero (44px and up) plays the full sequence; anything
    smaller (toasts, inline lines, tallies) only pops in, about 250ms; `still` plays
    nothing, for every mark after the first in a view and for states shown on load.
    Success: check draws, one ring pulse. Error: both strokes spring out 60ms apart.
    It shakes only with `reject`, when the person's own input was refused. Warning: bar
    drops, dot pops, a small sway with a soft pulse. Info: today's hourglass, turned once.
    Neutral and danger: the act's own icon fades and scales in, no turn. */
export function SuccessMark({
  size = 72,
  tone = "success",
  icon: Icon,
  style: override,
  still = false,
  reject = false,
  delay,
}: {
  size?: number;
  tone?: Tone;
  icon?: IconType;
  style?: Partial<MarkStyle>;
  still?: boolean;
  reject?: boolean;
  /** Start later, so lines that belong together play one after the other. */
  delay?: number;
}) {
  const picked = React.useContext(MarkStyleContext);
  const m = { ...picked, ...override };
  const t = TONE[tone];
  const full = !still && size >= 44;
  const quick = !still && !full;
  const small = size <= 28;
  const stroke = size <= 24 ? 3.4 : size <= 44 ? 3 : 2.6;
  const glyph =
    tone === "success" || tone === "info" ? 0.5 : tone === "warning" && (m.warnGlyph === "triangle" || m.warnGlyph === "bang") ? 0.7 : 0.62;
  const outer = !full
    ? ""
    : tone === "error"
      ? reject
        ? "sb-shake"
        : { spring: "", spin: "", stamp: "sb-thud", nod: "sb-nod" }[m.errorAnim]
      : tone === "warning"
        ? { sway: "sb-sway", pulse: "", swing: "sb-swing", glow: "sb-glow", drop: "sb-drop" }[m.warnAnim]
        : "";
  const pop = still
    ? ""
    : quick
      ? "sb-pop-quick"
      : tone === "error" && m.errorAnim === "stamp"
        ? "sb-stamp"
        : tone === "warning" && m.warnAnim === "drop"
          ? ""
          : "sb-pop";
  const iconTone = tone === "neutral" || tone === "danger";
  const ring = full && (tone === "success" || (tone === "warning" && (m.warnAnim === "pulse" || m.warnAnim === "sway")));
  return (
    <span className={"relative flex shrink-0 items-center justify-center " + outer} style={{ width: size, height: size }}>
      {ring ? <span className={"absolute inset-0 rounded-full " + (tone === "success" ? "sb-ring" : "sb-ring-soft")} style={{ background: t.solid }} /> : null}
      <span
        className={pop + " relative flex size-full items-center justify-center rounded-full " + (iconTone ? "" : "shadow-raised")}
        style={{
          animationDelay: delay ? `${delay}ms` : undefined,
          background: t.solid,
          color: t.fg,
          boxShadow: tone === "neutral" ? "inset 0 0 0 1px color-mix(in oklab, var(--foreground) 30%, transparent)" : undefined,
        }}
      >
        {iconTone && Icon ? (
          <span className={still ? "flex" : "sb-icon flex"} style={delay ? { animationDelay: `${delay + 180}ms` } : undefined}>
            <Icon style={{ width: size * 0.46, height: size * 0.46 }} strokeWidth={size <= 28 ? 2.4 : 2} />
          </span>
        ) : (
          /* Small marks: the glyph scales in after the disc, the same beat as the icon marks
             (the lock on a gate toast). Heroes draw their glyph instead. */
          <span className={quick ? "sb-icon flex" : "flex"} style={quick && delay ? { animationDelay: `${delay + 180}ms` } : undefined}>
          <svg viewBox="0 0 24 24" width={size * glyph} height={size * glyph} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {tone === "success" ? (
              <path className={full ? "sb-draw" : undefined} d="M5 12.5l4.5 4.5L19 7.5" />
            ) : tone === "error" ? (
              !full || m.errorAnim === "stamp" ? (
                <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
              ) : m.errorAnim === "spin" ? (
                <g className="sb-spin"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></g>
              ) : (
                <>
                  <path className="sb-stroke" d="M6.5 6.5l11 11" />
                  <path className="sb-stroke" style={{ animationDelay: "340ms" }} d="M17.5 6.5l-11 11" />
                </>
              )
            ) : tone === "warning" ? (
              <WarnPath glyph={m.warnGlyph} anim={full} small={small} />
            ) : (
              /* Sent, not decided: the same hourglass as today, turned over once. */
              <g className={full ? "sb-flip" : undefined} strokeWidth={2.2}>
                <path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />
              </g>
            )}
          </svg>
          </span>
        )}
      </span>
    </span>
  );
}

export function Hero({
  title,
  body,
  compact,
  tone = "success",
  children,
}: {
  title: React.ReactNode;
  body?: React.ReactNode;
  compact?: boolean;
  tone?: Tone;
  children?: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div
      className={"sb-band relative flex shrink-0 flex-col items-center gap-4 border-b text-center " + (compact ? "px-6 pt-8 pb-6" : "px-10 pt-10 pb-8")}
      style={{ borderColor: t.edge, background: `linear-gradient(180deg, ${t.muted} 0%, color-mix(in oklab, ${t.muted} 55%, var(--popover)) 100%)` }}
    >
      <SuccessMark size={compact ? 60 : 72} tone={tone} />
      <div className="flex max-w-md flex-col items-center gap-1.5">
        <h2 className={"sb-rise font-semibold text-balance text-foreground " + (compact ? "text-title-s" : "text-title")} style={{ animationDelay: "180ms" }}>
          {title}
        </h2>
        {body ? (
          <p className="sb-rise text-body text-pretty text-muted-foreground" style={{ animationDelay: "240ms" }}>
            {body}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export const Row = ({ term, children }: { term: string; children: React.ReactNode }) => (
  <DescriptionRow className="border-hairline">
    <DescriptionTerm>{term}</DescriptionTerm>
    <DescriptionDetails className="tabular-nums">{children}</DescriptionDetails>
  </DescriptionRow>
);

export const Facts = ({ children, className = "px-6 py-4" }: { children: React.ReactNode; className?: string }) => (
  <div className={"sb-rise " + className} style={{ animationDelay: "320ms" }}>
    {children}
  </div>
);

export const Footer = ({ children, between }: { children: React.ReactNode; between?: boolean }) => (
  <footer className={"flex items-center gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 " + (between ? "justify-between" : "justify-end")}>
    {children}
  </footer>
);

/** The facts under a hero, grouped so they read as one summary with a name. */
export const Summary = ({
  label,
  aside,
  tone,
  children,
}: {
  label?: string;
  aside?: React.ReactNode;
  /** "success": the label is the outcome itself, so it carries the success ink. */
  tone?: "success" | "error" | "warning";
  children: React.ReactNode;
}) => (
  <div className="overflow-hidden rounded-xl bg-surface-sunken">
    {label ? (
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <span className={"text-body-compact font-semibold " + (tone === "success" ? "text-success-ink" : tone === "error" ? "text-destructive-ink" : tone === "warning" ? "text-warning-ink" : "")}>{label}</span>
        {aside}
      </div>
    ) : null}
    <div className="px-4 py-1">{children}</div>
  </div>
);

const Mono = ({ children }: { children: React.ReactNode }) => <span className="font-mono text-body-compact">{children}</span>;

/* ================================================================ toasts */

/** Straight accent bar, full height and flush left. The card's rounded corners clip its
    ends, so it reads as a straight edge cut by the radius, never one that bends. */
export const Rail = ({ tone = "success" }: { tone?: Tone | "muted" }) => (
  <span
    aria-hidden
    className={
      "absolute inset-y-0 left-0 w-[3px] " +
      ({ success: "bg-success", error: "bg-destructive", danger: "bg-destructive", warning: "bg-warning", info: "bg-info", muted: "bg-muted-foreground/50", neutral: "bg-muted-foreground/50" } as const)[tone]
    }
  />
);

export function ConfirmToast({
  title,
  description,
  action,
  neutral,
  tone = neutral ? "neutral" : "success",
  icon = ArchiveIcon,
}: {
  title: string;
  description?: string;
  action?: string;
  neutral?: boolean;
  /** The neutral toast's own icon: what the message is about, not how it went. */
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  /** error: stays until closed (no timer) and carries a close button. */
  tone?: "success" | "neutral" | "error" | "warning";
}) {
  const persistent = tone === "error";
  return (
    <div className="sb-toast relative flex w-[380px] items-center gap-2.5 overflow-hidden rounded-lg bg-popover py-3 pr-3 pl-4 text-popover-foreground shadow-overlay ring-1 ring-hairline">
      <Rail tone={tone === "neutral" ? "muted" : tone} />
      {/* One block of text: the icon sits in its middle. With a detail line: centred on
          the title and the detail's first line (20 + 2 + 20 = 42, so 21px down). */}
      <span className={description ? "mt-[8px] self-start" : "self-center"}>
        {tone === "neutral" ? (
          <SuccessMark size={26} tone="neutral" icon={icon} />
        ) : (
          <span className="flex size-[26px] items-center justify-center"><SuccessMark size={22} tone={tone} /></span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-compact font-semibold">{title}</p>
        {description ? <p className="text-body-compact text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <Button size="xs" variant="outline">{action}</Button> : null}
      {persistent ? (
        <span className="flex size-7 shrink-0 items-center justify-center self-start text-muted-foreground"><XIcon className="size-4" /></span>
      ) : (
        /* 2.75s (lead designer, Oct 29; today is Sonner's 4s). Any click dismisses it. */
        <span
          className={
            "sb-drain absolute inset-x-0 bottom-0 h-[2px] " +
            (tone === "neutral" ? "bg-muted-foreground/30" : tone === "warning" ? "bg-warning/60" : "bg-success/60")
          }
        />
      )}
    </div>
  );
}

function ToastOnPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[420px] w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background">
      <FauxPage />
      <div className="absolute inset-x-0 bottom-[56px] flex justify-center pl-44">{children}</div>
    </div>
  );
}

export const ToastTitleAfter = () => (
  <ToastOnPage><ConfirmToast title="Access given to Adv. Meera Nair" /></ToastOnPage>
);
export const ToastLongAfter = () => (
  <ToastOnPage><ConfirmToast title="Order KL-ORD-0412 signed. The application is accepted." /></ToastOnPage>
);
export const ToastNeutralAfter = () => (
  <ToastOnPage><ConfirmToast neutral title="Task archived" description="Pay court fee. You can find it under Take action, Archive." action="Undo" /></ToastOnPage>
);

/* ===================================================== takeover dialogs */

export function TintedWideAfter() {
  return (
    <Screen height={600}>
      <DialogBox width={672}>
        <Hero title="Bail application submitted" body="The court has received your application. You will be told by SMS when a decision is made." />
        <Facts>
          <DescriptionList>
            <Row term="Submitted on">24-08-2026</Row>
            <Row term="Submission ID"><Mono>KL-000847-2026-AP1</Mono></Row>
            <Row term="Court fee">₹50 paid</Row>
          </DescriptionList>
        </Facts>
        <Footer between>
          <Button variant="outline"><DownloadIcon data-icon="inline-start" />Download application</Button>
          <Button>Done</Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

export function TintedCompactAfter() {
  return (
    <Screen height={420}>
      <DialogBox width={448}>
        <Hero compact title="Document submitted" body="Signed with Aadhaar OTP. It is on the case record now. Everyone on the case can see it." />
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function TintedInfoAfter() {
  return (
    <Screen height={420}>
      <DialogBox width={448}>
        <Hero compact tone="info" title="Application sent to the magistrate" body="Signed with Aadhaar OTP. Adv. R. Pillai stays on the case until the order is passed." />
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

const Signer = ({ name, role, you }: { name: string; role: string; you?: boolean }) => (
  <li className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-b-0">
    <div className="min-w-0 flex-1">
      <p className="text-body-compact font-semibold">
        {name}
        {you ? <span className="ps-2 font-medium text-muted-foreground">You</span> : null}
      </p>
      <p className="text-body-compact text-muted-foreground">{role}</p>
    </div>
    <Badge variant="success"><CheckIcon />Signed</Badge>
  </li>
);

export function StripSignAfter() {
  return (
    <Screen height={620}>
      <DialogBox width={672}>
        <Hero title="Everyone has signed" body="You can pay the court fee now." />
        <Facts>
          <Summary tone="success" label="Every signature is in" aside={<Badge variant="success"><CheckIcon />3 of 3 signed</Badge>}>
            <ul className="flex flex-col">
              <Signer name="Adv. Meera Nair" role="Advocate for complainant" you />
              <Signer name="Suresh Kumar" role="Complainant" />
              <Signer name="Anita Kumar" role="Power of attorney holder" />
            </ul>
          </Summary>
        </Facts>
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function StripJoinAfter() {
  return (
    <Screen height={620}>
      <DialogBox width={576}>
        <Hero title="You have joined this case" body="You can now read the complaint and act in the case as Suresh Kumar." />
        <Facts>
          <Summary tone="success" label="Joined as Suresh Kumar">
            <div className="flex flex-col gap-0.5 py-3">
              <p className="text-body font-semibold">Suresh Kumar vs. Rajan Traders</p>
              <p className="text-body-compact text-muted-foreground">ST/0412/2026 · Complaint, S-138 NI Act</p>
            </div>
          </Summary>
          <p className="pt-3 text-body-compact text-muted-foreground">Next, give your advocate your access code (7Q4-K2M) or your summons.</p>
        </Facts>
        <Footer between>
          <Button variant="outline">Back to home</Button>
          <Button>View case<ArrowRightIcon data-icon="inline-end" /></Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

export function SlabAfter() {
  return (
    <Screen height={620}>
      <DialogBox width={512} close={false}>
        <Hero title="Payment successful" body="Your case file is complete.">
          <div className="sb-rise flex flex-col items-center pt-2" style={{ animationDelay: "280ms" }}>
            <span className="text-caption font-medium text-muted-foreground">Amount paid</span>
            <span className="text-title-s font-semibold tabular-nums">₹1,250</span>
          </div>
        </Hero>
        <Facts>
          <Summary>
            <DescriptionList>
              <Row term="Case file number">KL-000847-2026</Row>
              <Row term="Payment reference"><Mono>PAY-55102</Mono></Row>
            </DescriptionList>
          </Summary>
        </Facts>
        <div className="flex gap-3 px-6 pb-6">
          <Button variant="outline" size="lg" className="flex-1">Back to dashboard</Button>
          <Button variant="outline" size="lg" className="flex-1">Print or save as PDF</Button>
        </div>
      </DialogBox>
    </Screen>
  );
}

export function PanelAfter() {
  return (
    <Screen height={440}>
      <DialogBox width={448}>
        <Hero compact title="4 documents signed" body="One OTP covered the set, the same as signing one at a time." />
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function BandAfter() {
  return (
    <Screen height={580}>
      <DialogBox width={512}>
        <Hero compact title="8 forms signed" body="They have left the signing queue." />
        <Facts>
          <Summary>
            <DescriptionList>
              <Row term="Form 12 notices">5</Row>
              <Row term="Warrants">3</Row>
              <Row term="Cases">6 cases</Row>
            </DescriptionList>
          </Summary>
        </Facts>
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function CalloutAfter() {
  return (
    <Screen height={420}>
      <DialogBox width={360} close={false}>
        <Hero compact title="12 covers posted" body="They are now in In progress in Service." />
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function ReceiptAfter() {
  return (
    <Screen height={600}>
      <DialogBox width={512}>
        <Hero compact title="Payment successful" body="Suresh Kumar vs. Rajan Traders · ST/0412/2026">
          <div className="sb-rise flex flex-col items-center pt-2" style={{ animationDelay: "280ms" }}>
            <span className="text-caption font-medium text-muted-foreground">Amount paid</span>
            <span className="text-title-s font-semibold tabular-nums">₹50</span>
          </div>
        </Hero>
        <Facts>
          <Summary>
            <DescriptionList>
              <Row term="Fee">Application fee</Row>
              <Row term="Receipt"><Mono>RCPT-88213</Mono></Row>
            </DescriptionList>
          </Summary>
        </Facts>
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function CentredAfter() {
  return (
    <Screen height={560}>
      <DialogBox width={672}>
        <Hero title="Forwarded for registration" body="On Register cases as CMP — Complaint." />
        <div className="flex-1" />
        <Footer>
          <Button variant="outline">Stay here</Button>
          <Button>Next file<ArrowRightIcon data-icon="inline-end" /></Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

export function BadgeSwapAfter() {
  return (
    <Screen height={500}>
      <DialogBox width={512}>
        <Hero compact title="Complaint registered" body="The complaint is on the register. It appears in the court's case list from today." />
        <Facts>
          <Summary>
            <div className="flex flex-col gap-0.5 py-3">
              <p className="text-body-compact font-semibold">Suresh Kumar vs. Rajan Traders</p>
              <p className="font-mono text-body-compact text-muted-foreground">KL-000847-2026</p>
            </div>
          </Summary>
        </Facts>
        <Footer>
          <Button variant="ghost">Back to register cases</Button>
          <Button>Next complaint</Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

export function TitleBannerAfter() {
  return (
    <Screen height={480}>
      <DialogBox width={512}>
        <Hero compact title="Payment complete" body="Court fee of ₹20 paid. The application is submitted." />
        <Facts>
          <Summary label="Application for exemption">
            <dl className="flex flex-col text-body-compact">
              <div className="flex justify-between py-2.5"><dt>Court fee</dt><dd>₹20</dd></div>
              <div className="flex justify-between border-t border-hairline py-2.5 font-semibold"><dt>Total paid</dt><dd>₹20</dd></div>
            </dl>
          </Summary>
        </Facts>
        <Footer><Button>Done</Button></Footer>
      </DialogBox>
    </Screen>
  );
}

export function TextOnlyAfter() {
  return (
    <Screen height={480}>
      <DialogBox width={400} close={false}>
        <Hero compact title="Sent for signing" body="It is in Pending orders, awaiting the magistrate." />
        <Facts>
          <Summary label="Next draft">
            <p className="py-3 text-body-compact">Order on bail, ST/0388/2026.</p>
          </Summary>
        </Facts>
        <Footer>
          <Button variant="outline">Back to Pending orders</Button>
          <Button>Next draft</Button>
        </Footer>
      </DialogBox>
    </Screen>
  );
}

/** A viewer dialog stays open: the footer itself becomes the confirmation. */
export function FooterLineAfter() {
  return (
    <Screen height={480}>
      <DialogBox width={760}>
        <div className="flex shrink-0 flex-col gap-2 border-b border-hairline p-6 pr-16">
          <h2 className="text-title-s font-semibold">Summons · ST/0412/2026</h2>
        </div>
        <div className="flex h-64 items-center justify-center bg-card">
          <div className="h-56 w-44 rounded border border-hairline bg-surface-sunken" />
        </div>
        <div
          className="sb-band flex items-center gap-3 border-t px-6 py-4"
          style={{ borderColor: "var(--success-7)", background: "var(--success-muted)" }}
        >
          <SuccessMark size={36} />
          <p className="sb-rise mr-auto flex flex-col" style={{ animationDelay: "180ms" }}>
            <span className="text-body font-semibold text-foreground">Process signed</span>
            <span className="text-body-compact text-muted-foreground">It is now in To post in Issuance.</span>
          </p>
          <Button variant="outline">Download</Button>
          <Button>Done</Button>
        </div>
      </DialogBox>
    </Screen>
  );
}

/* ================================================================= page */

export function FullPageAfter() {
  return (
    <Screen height={520} scrim={false}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, var(--success-muted), var(--background) 60%)" }} />
      <div className="relative mx-auto flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <SuccessMark size={96} />
        <div className="flex flex-col items-center gap-2">
          <h1 className="sb-rise text-display-s font-semibold text-balance" style={{ animationDelay: "180ms" }}>Your account is ready</h1>
          <p className="sb-rise text-body text-pretty text-muted-foreground" style={{ animationDelay: "240ms" }}>
            You can add your address and official ID from your profile after entering the portal.
          </p>
        </div>
        <Button size="lg" className="sb-rise" style={{ animationDelay: "320ms" }}>Go to your home page</Button>
      </div>
    </Screen>
  );
}

/* =============================================================== inline */

/** End state of a page: a banner with the same mark, title-s, and the way out. */
function PageBanner({ title, body, action }: { title: string; body: string; action?: string }) {
  return (
    <div className="sb-band flex items-center gap-4 rounded-xl border p-4" style={{ borderColor: "var(--success-7)", background: "var(--success-muted)" }}>
      <SuccessMark size={44} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="sb-rise text-title-s font-semibold text-foreground" style={{ animationDelay: "180ms" }}>{title}</p>
        <p className="sb-rise text-body-compact text-muted-foreground" style={{ animationDelay: "240ms" }}>{body}</p>
      </div>
      {action ? <Button>{action}<ArrowRightIcon data-icon="inline-end" /></Button> : null}
    </div>
  );
}

/** Inside a dialog that stays open: a white line with a small mark, not a tinted box. */
function InlineConfirm({ children }: { children: React.ReactNode }) {
  return (
    <div className="sb-rise relative flex items-center gap-3 overflow-hidden rounded-lg bg-card py-2.5 pr-3 pl-4 ring-1 ring-hairline">
      <Rail />
      <SuccessMark size={22} />
      <p className="text-body-compact font-semibold">{children}</p>
    </div>
  );
}

export function InlineAfter() {
  return (
    <div className="relative w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background p-8">
      <div className="flex flex-col gap-5">
        <PageBanner title="Vakalatnama executed" body="Fees paid and all parties signed. The instrument is sealed with its audit trail." action="Done" />
        <PageBanner title="You have signed the bail bond" body="The court will be told when everyone has signed." />
        <InlineConfirm>Access given to Adv. Meera Nair, Rahul (clerk)</InlineConfirm>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="sb-fill h-1.5 flex-1 rounded-full bg-success" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <InlineConfirm>All 6 corrected.</InlineConfirm>
        </div>
      </div>
    </div>
  );
}

/* ============================================================= landing */

export function SilentAfter() {
  return (
    <div className="relative h-[420px] w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background">
      <div className="absolute inset-0 flex">
        <div className="w-44 border-r border-hairline bg-card" />
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="h-6 w-64 rounded bg-surface-sunken" />
          <div className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-card">
            {["Form 12 notice", "Bail bond", "Warrant", "Deposition", "Exhibit P-4"].map((t, i) => (
              <div key={t} className={"flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-0 " + (i === 1 ? "sb-land" : "")}>
                <span className="w-48 text-body-compact font-medium">{t}</span>
                <span className="flex-1 text-body-compact text-muted-foreground">Suresh Kumar vs. Rajan Traders</span>
                {i === 1 ? (
                  <span className="sb-rise inline-flex h-6 items-center rounded-full bg-success-muted px-2 text-xs font-medium text-success-muted-foreground">Signed</span>
                ) : (
                  <span className="h-5 w-16 rounded-full bg-surface-sunken" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-[56px] flex justify-center pl-44">
        <ConfirmToast title="Bail bond signed" description="It has left the signing queue." />
      </div>
    </div>
  );
}

/* =============================================================== marks */

/** States stay small. Three changes: one tick shape everywhere; a finished button turns
    success instead of grey-disabled; and when a state flips in front of the person, the
    chip settles in (220ms) and its tick draws. Nothing moves on page load. */
export function MarksAfter() {
  const Tick = () => (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path className="sb-draw" d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
  const Dot = () => (
    <span className="sb-pop flex size-4 items-center justify-center rounded-full bg-success text-success-foreground">
      <svg viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path className="sb-draw" d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
  return (
    <div className="flex w-[820px] shrink-0 flex-wrap items-center gap-4 rounded-lg border border-hairline bg-background p-8">
      <Badge variant="success" className="sb-chip"><Tick />Signed</Badge>
      <Badge variant="success" className="sb-chip"><Tick />Done: all 24 filed</Badge>
      <Badge variant="success" className="sb-chip"><Tick />Address added</Badge>
      <span className="inline-flex items-center gap-1.5 text-body-compact text-success-ink"><Dot />Saved</span>
      <span className="flex items-center gap-1.5 text-body-compact text-success-ink"><Dot />Mobile number verified</span>
      <span className="flex items-center gap-1.5 text-caption text-success-ink"><Dot />Read · 6 fields filled in your form</span>
      <span className="sb-chip inline-flex h-11 items-center gap-2 rounded-md bg-success-muted px-5 text-body-compact font-medium text-success-muted-foreground ring-1" style={{ ["--tw-ring-color" as string]: "var(--success-7)" }}>
        <Dot />Sent to scrutiny
      </span>
      <span className="sb-pop relative flex size-8 items-center justify-center rounded-full bg-success text-success-foreground"><Tick /></span>
    </div>
  );
}

/* ------------------------------------------------------------- tryout */

/** Press Show toast, then wait or click anywhere in the frame. Today: 4s, clicks do
    nothing. Proposed: 2.5s or 2.75s, and any click on the page dismisses it. */
export function ToastTryout({ today }: { today?: boolean }) {
  const [life, setLife] = React.useState(2.75);
  const [shown, setShown] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const ms = (today ? 4 : life) * 1000;
  React.useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), ms);
    return () => window.clearTimeout(t);
  }, [visible, shown, ms]);
  const show = () => {
    setShown((n) => n + 1);
    setVisible(true);
  };
  return (
    <div
      className="relative h-[420px] w-[820px] shrink-0 overflow-hidden rounded-lg border border-hairline bg-background"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!today && visible) setVisible(false);
      }}
    >
      <FauxPage />
      <div className="absolute top-4 right-4 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
        {today ? null : (
          <span className="flex rounded-lg bg-surface-sunken p-0.5 ring-1 ring-hairline">
            {[2.5, 2.75].map((v) => (
              <Button key={v} size="sm" variant={life === v ? "outline" : "ghost"} onClick={() => setLife(v)}>{v}s</Button>
            ))}
          </span>
        )}
        <Button size="sm" onClick={show}>Show toast</Button>
      </div>
      <p className="pointer-events-none absolute top-16 right-4 max-w-[260px] text-right text-caption text-muted-foreground">
        {today ? "Stays 4s. Clicking the page does nothing." : "Wait, or click anywhere on the page to dismiss."}
      </p>
      <div className="absolute inset-x-0 bottom-[56px] flex justify-center pl-44">
        {visible ? (
          today ? (
            <div key={shown} className="sb-toast">
              <ToastBoxStatic />
            </div>
          ) : (
            <div key={shown} style={{ ["--sb-life" as string]: `${life}s` }}>
              <ConfirmToast title="Access given to Adv. Meera Nair" />
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function ToastBoxStatic() {
  return (
    <div
      className="flex w-[356px] items-center gap-1.5 border p-4 text-[13px]"
      style={{ background: "var(--success-muted)", color: "var(--success-muted-foreground)", borderColor: "var(--success-7)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-overlay)" }}
    >
      <CheckIcon className="mr-1 size-4 shrink-0" />
      <span className="font-medium">Access given to Adv. Meera Nair</span>
    </div>
  );
}
