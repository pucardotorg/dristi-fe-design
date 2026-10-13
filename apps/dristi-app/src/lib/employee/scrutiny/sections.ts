/**
 * Structured reasons for challenging a document itself. Free-text marks are
 * legitimate only when the document — not the value — is the problem.
 */
export const DOC_REASONS = ["Blurry / unreadable", "Wrong document", "Page missing"] as const

/** The officer's standing checks — visible, tickable, never hover-gated. */
export const CHECKS = [
  "Names match across cheque, ID and notice",
  "Cheque details match the instrument",
  "Notice within 30 days of return memo",
  "Filing within limitation (or condonation prayed)",
  "Jurisdiction consistent with addresses",
  "Signatures on complaint & affidavit",
  "All documents legible and the right ones",
]
