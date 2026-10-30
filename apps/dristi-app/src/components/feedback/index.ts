/**
 * Feedback: how the product says something worked, failed, needs a look, or is not news.
 * The rules, their reasons and when to use which piece: `.agents/skills/feedback-states`.
 * App-owned until the DS adopts them (docs/design/ds-requests.md #23–26).
 */
export { StatusMark, type MarkSize, type MarkTone } from "./mark";
export { OutcomeAmount, OutcomeHeader, OutcomeSummary, OutcomeTally, PageOutcome } from "./outcome";
export { BADGE_WITH_MARK, LANDING, StatusFieldControl, StatusFieldError, StatusLine, useRefusal } from "./inline";
export { ConfirmMark, IrreversibleNote } from "./confirm";
export { notify, TOAST_LIFE_MS } from "./notify";
