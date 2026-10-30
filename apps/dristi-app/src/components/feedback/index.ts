/**
 * Feedback: how the product says something worked, failed, needs a look, or is not news.
 * The rules, their reasons and when to use which piece: `.agents/skills/feedback-states`.
 * The pieces are the design system's (synced into `components/ui`); this barrel keeps the
 * one import path screens already use. A mark inside a `Badge` needs no class: `Badge`
 * sets its own inset when it holds a `StatusMark`.
 */
export { StatusMark, type MarkSize, type MarkTone } from "@/components/ui/status-mark";
export { OutcomeAmount, OutcomeHeader, OutcomeSummary, OutcomeTally, PageOutcome } from "@/components/ui/outcome";
export { LANDING, StatusFieldControl, StatusFieldError, StatusLine, useRefusal } from "@/components/ui/status-line";
export { ConfirmMark, IrreversibleNote } from "@/components/ui/confirm-mark";
export { notify, TOAST_LIFE_MS } from "@/components/ui/notify";
