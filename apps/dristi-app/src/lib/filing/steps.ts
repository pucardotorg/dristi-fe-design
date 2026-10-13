/**
 * The e-filing sections in order — drives the sidebar, footer navigation and progress.
 * Every draft has its own routes: `/filings/<draftId>/<segment>`. Steps marked
 * `placeholder` exist in the sidebar (as in the court form) but have no screen of their
 * own yet: fees are paid from the Sign screen.
 */

import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheckIcon,
  CreditCardIcon,
  EyeIcon,
  FileCheckIcon,
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PenToolIcon,
  ScaleIcon,
  UserRoundIcon,
  UserRoundXIcon,
  WalletIcon,
} from "lucide-react";

import type { StepId } from "./types";

export type { StepId } from "./types";

export const FILINGS_HOME = "/filings";
/** Creates a fresh draft and opens it. */
export const NEW_FILING = "/filings/new";
/** Placeholder for the PSS Act case type, which cannot be filed yet. */
export const NEW_PSS_FILING = "/filings/new/pss-act";

export type FilingStep = {
  id: StepId;
  title: string;
  /** Sidebar group heading (sentence case). */
  group: string;
  /** URL segment under `/filings/<draftId>/`. */
  segment: string;
  icon: LucideIcon;
  /** In the sidebar for orientation, but not a screen of its own yet. */
  placeholder?: boolean;
};

export const FILING_STEPS: FilingStep[] = [
  { id: "complainant", title: "Complainant", group: "Parties", segment: "complainant", icon: UserRoundIcon },
  { id: "advocate", title: "Advocate", group: "Parties", segment: "advocate", icon: ScaleIcon },
  { id: "accused", title: "Accused", group: "Parties", segment: "accused", icon: UserRoundXIcon },
  { id: "cheque", title: "Cheque & return memo", group: "Case details", segment: "cheque", icon: CreditCardIcon },
  { id: "demand-notice", title: "Demand notice & debt", group: "Case details", segment: "demand-notice", icon: MailIcon },
  { id: "jurisdiction", title: "Jurisdiction & limitation", group: "Case details", segment: "jurisdiction", icon: MapPinIcon },
  { id: "adr-prayer", title: "ADR, other & prayer", group: "Case details", segment: "adr-prayer", icon: ClipboardCheckIcon },
  { id: "witnesses", title: "Witnesses", group: "Evidence", segment: "witnesses", icon: MessageCircleIcon },
  { id: "documents", title: "Documents", group: "Evidence", segment: "documents", icon: FileTextIcon },
  { id: "affidavit", title: "Affidavit", group: "Affidavit", segment: "affidavit", icon: FileCheckIcon },
  { id: "preview", title: "Preview", group: "Preview", segment: "preview", icon: EyeIcon },
  { id: "sign", title: "Sign and oath", group: "Sign and oath", segment: "sign", icon: PenToolIcon },
  { id: "pay-fees", title: "Pay fees", group: "Pay fees", segment: "sign", icon: WalletIcon, placeholder: true },
];

/** The intake step that precedes the form. */
export const UPLOAD_STEP: FilingStep = {
  id: "upload",
  title: "Documents",
  group: "Documents",
  segment: "upload",
  icon: FileTextIcon,
};

/** Steps that have a screen, in walking order (used for Back / Continue). */
export const WALK_ORDER: StepId[] = [
  "upload",
  "complainant",
  "advocate",
  "accused",
  "cheque",
  "demand-notice",
  "jurisdiction",
  "adr-prayer",
  "witnesses",
  "documents",
  "affidavit",
  "preview",
  "sign",
];

export function getStep(id: StepId): FilingStep {
  if (id === "upload") return UPLOAD_STEP;
  const s = FILING_STEPS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown filing step: ${id}`);
  return s;
}

export function draftBase(draftId: string): string {
  return `${FILINGS_HOME}/${encodeURIComponent(draftId)}`;
}

export function stepHref(draftId: string, id: StepId): string {
  return `${draftBase(draftId)}/${getStep(id).segment}`;
}

/** The screen a pathname is on (`/filings/<id>/cheque` → "cheque"), if any. */
export function stepFromPathname(pathname: string): StepId | null {
  const segment = pathname.split("?")[0].split("/").filter(Boolean).pop();
  if (!segment) return null;
  const hit = WALK_ORDER.find((id) => getStep(id).segment === segment);
  return hit ?? null;
}

export function neighbours(id: StepId): { prev: StepId | null; next: StepId | null } {
  const i = WALK_ORDER.indexOf(id);
  return {
    prev: i > 0 ? WALK_ORDER[i - 1] : null,
    next: i >= 0 && i < WALK_ORDER.length - 1 ? WALK_ORDER[i + 1] : null,
  };
}

/** Sidebar groups in display order. */
export function stepGroups(): { group: string; steps: FilingStep[] }[] {
  const out: { group: string; steps: FilingStep[] }[] = [];
  for (const s of FILING_STEPS) {
    const g = out.find((x) => x.group === s.group);
    if (g) g.steps.push(s);
    else out.push({ group: s.group, steps: [s] });
  }
  return out;
}
