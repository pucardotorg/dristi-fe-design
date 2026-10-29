"use client";

import * as React from "react";

import * as Now from "./fail-current";
import * as Next from "./fail-proposed";
import { f, type Lane } from "./types";

/* Failure, error and warning states on main @ 90bbc31, grouped by visual pattern. */

export const FAIL_LANES: Lane[] = [
  {
    id: "err-toast",
    name: "Red toast",
    weight: 1,
    note: "The success toast in red: 13px on a pale tint, gone in 4s. An error that disappears before it is read is the worst case of the same problem.",
    specimens: [
      { label: "Title only", now: <Now.ErrToastToday />, next: <Next.ErrToastNext />, why: "Same sleek toast in red, with the cross mark. It stays until closed: errors do not time out." },
      { label: "With detail", now: <Now.ErrToastDescToday />, next: <Next.ErrToastDescNext />, why: "Same words. Mark centred on the title and first detail line; close button instead of a timer." },
    ],
    flows: [
      f("Task act failed (offline, something went wrong, not allowed)", ["adv"], "tasks/use-task-actions"),
      f("That file could not be stored in this browser", ["adv"], "tasks/act/shared"),
      f("The case file could not be prepared", ["adv", "lit"], "cases/download-case-file-dialog"),
      f("The scrutiny return could not be found", ["adv"], "filing/sections/sign-section"),
      f("Application could not be updated / accepted / rejected", ["mag"], "employee/application-order-triggers"),
    ],
  },
  {
    id: "block-toast",
    name: "Grey toast used to block",
    weight: 1,
    note: "A plain grey toast explains why a press did nothing. It looks like an acknowledgement, sits far from the thing to fix, and vanishes.",
    specimens: [
      { label: "Missing input", now: <Now.BlockToastToday />, next: <Next.BlockToastNext />, why: "Kept on reflection. Picture the drafter: they press Send at the bottom, the editor above them turns red, the line under it says what is missing, and the cursor is already in it. A toast would sit at the bottom, a long way from the thing to fix, and vanish. Next hearing already moves focus to its field today. Where the fix is not a field (answer questions through a pencil), the toast stays." },
      { label: "Step not open yet", now: <Now.GateToastToday />, next: <Next.GateToastNext />, why: "Not a warning: nothing is wrong, the step just is not open. Neutral toast with a lock, 4s, as today." },
    ],
    flows: [
      f("Type the order before sending it for signing", ["staff"], "employee/order-editor"),
      f("Set the next hearing's date and purpose", ["staff"], "employee/order-editor"),
      f("Questions still to answer / mandatory details to fill", ["mag", "staff"], "employee/pending-order-screen"),
      f("Flag removed. The document issue stays", ["staff"], "employee/scrutiny/field-row"),
      f("Court fee opens once every signature is in", ["adv"], "filing/sections/sign-section"),
      f("Corrections already sent to scrutiny", ["adv"], "filing/sections/sign-section"),
    ],
  },
  {
    id: "fail-as-success",
    name: "Failure drawn as success",
    weight: 4,
    note: "Nothing was signed or paid, but the panel is solid green with a tick. The loudest thing on screen says the opposite of what happened.",
    specimens: [
      { label: "Nothing was signed", now: <Now.NothingSignedToday />, next: <Next.NothingSignedNext />, why: "Same hero as success, in red. The cross springs out stroke by stroke, then one small shake. Same words." },
    ],
    flows: [
      f("Filings dashboard: Nothing was signed / paid", ["adv"], "filing/dashboard/batch-filing-dialog"),
    ],
  },
  {
    id: "red-strip",
    name: "Thin red strip on a card",
    weight: 2,
    note: "The success strip in red, under an ordinary header. Same problem as the green one: it reads as a row, not an outcome.",
    specimens: [
      { label: "Batch: nothing paid", now: <Now.RedStripToday />, next: <Next.RedStripNext />, why: "Red hero carries the outcome; each row keeps its own reason, grouped in one card." },
      { label: "Registration rejected", now: <Now.RejectedStripToday />, next: <Next.RejectedNext />, why: "The person and their ID card sit side by side so the card uses its width; the reason runs under both. 'Account rejected' labels the card." },
    ],
    flows: [
      f("Nothing was paid / Nothing was signed (tasks batch)", ["adv"], "tasks/batch-act-dialog"),
      f("Advocate / clerk registration rejected", ["staff"], "employee/approve-registrations-dialog"),
    ],
  },
  {
    id: "partial",
    name: "Partly failed, inside a success",
    weight: 2,
    note: "The part that worked is solid green; the part that failed is a small amber line under it. The eye stops at the green.",
    specimens: [
      { label: "Bulk: one refused", now: <Now.PartialCalloutToday />, next: <Next.PartialCalloutNext />, why: "Two acts, two answers. The hero says what fully happened (all signed). Under it, a Sending card with a 2-and-1 bar and one line per outcome, each with its own mark. 'Sending' is the only new word." },
      { label: "Single: refused", now: <Now.PartialFooterToday />, next: <Next.PartialFooterNext />, why: "The footer lists both acts, each with its own mark: signed (green), could not be sent (amber)." },
    ],
    flows: [
      f("N processes signed / resent, some could not be sent", ["staff", "mag"], "employee/process-move-dialog"),
      f("Process signed, could not be sent", ["staff"], "employee/sign-process-dialog"),
      f("Order items added, some left out (grey text)", ["staff"], "employee/pending-orders-bulk"),
    ],
  },
  {
    id: "inline-error",
    name: "Inline error",
    weight: 2,
    note: "Three components (Banner, Alert, SectionNotice) and a no-icon variant, all pale red boxes. Same weight as a warning or a tip.",
    specimens: [
      { label: "The four inline reds", now: <Now.InlineErrorsToday />, next: <Next.InlineErrorsNext />, why: "One shape, the same as the inline success line: white, straight red rail, cross mark, optional title and action. Same words." },
    ],
    flows: [
      f("The payment did not go through", ["adv"], "advocate/join-case-dialog · tasks/act/task-flows"),
      f("Last attempt failed (pay rail)", ["adv"], "tasks/act/pay-page"),
      f("Cases / tasks / documents / orders could not be loaded", ["adv", "lit"], "cases/* · tasks/tasks-screen"),
      f("That file wasn't added", ["adv"], "filing/sections/upload-section · sign-flow-dialog"),
      f("Witness needs a complete address", ["adv"], "cases/add-witness-form"),
      f("Action on the application failed", ["mag", "staff"], "employee/application-decision-panel"),
      f("This batch could not be opened · bulk API errors", ["adv"], "bulk/*"),
    ],
  },
  {
    id: "inline-warning",
    name: "Inline warning",
    weight: 2,
    note: "The same three components in amber. One warning banner shows two icons, and the documents step pins its own floating alert that behaves like a toast.",
    specimens: [
      { label: "The four inline ambers", now: <Now.InlineWarningsToday />, next: <Next.InlineWarningsNext />, why: "One shape with the warning mark and a straight amber rail. One icon, always." },
      { label: "Floating warning", now: <Now.FloatingWarningToday />, next: <Next.FloatingWarningNext />, why: "It is a toast in all but name, so it becomes the warning toast, in the toast's place." },
    ],
    flows: [
      f("You are offline (tasks read-only)", ["adv"], "tasks/tasks-screen"),
      f("Cheque late · notice late · beyond limitation · S-138 check", ["adv"], "filing/sections/*"),
      f("This is sworn evidence", ["adv"], "filing/sections/affidavit-section"),
      f("No case matches · already joined · PoA taken", ["adv", "lit"], "join/* · advocate/join-case-dialog"),
      f("This is not about me · deposit warning", ["lit"], "onboarding/steps"),
      f("Camera or microphone failed (oath)", ["lit", "adv"], "filing/oath-capture"),
      f("AI review / assistance unavailable (two icons)", ["adv", "staff"], "bulk/batch-screen · scrutiny/case-workbench"),
      f("Already deferred once", ["mag", "staff"], "employee/application-decision-panel"),
      f("Required fields not in your file · not ready to sign", ["adv"], "bulk/upload-screen · sign-tab"),
      f("Required documents still needed (floating)", ["adv"], "filing/sections/documents-section"),
    ],
  },
  {
    id: "confirm",
    name: "Confirm before a risky act",
    weight: 2,
    note: "Plain text dialogs, no mark. The confirm button is soft red in most places, solid red in some, and primary teal for 'Discard draft'. 'Cannot be undone' hides at the end of the body.",
    specimens: [
      { label: "Removes something", now: <Now.ConfirmRemoveToday />, next: <Next.ConfirmRemoveNext />, why: "A confirm is a question, not an outcome, so no cross. A soft red disc shows the act; the button stays today's soft red." },
      { label: "Destroys a draft", now: <Now.ConfirmDiscardToday />, next: <Next.ConfirmDiscardNext />, why: "Soft red like every other removal, not primary teal. 'This cannot be undone' moves to its own line with a lock, so it is read. Same words." },
      { label: "Cannot be reversed", now: <Now.ConfirmSignToday />, next: <Next.ConfirmSignNext />, why: "Not a warning: signing is the job. A neutral mark shows the act (a pen); 'This cannot be reversed' gets its own line with a lock. Button stays primary." },
    ],
    flows: [
      f("Remove from office · remove access · remove from case", ["adv"], "access/*"),
      f("Discard changes / draft / application (×8 dialogs)", ["adv", "lit"], "cases/* · filing/*"),
      f("Remove complainant / accused / cheque / witness / document", ["adv"], "filing/sections/*"),
      f("Going back voids the signatures · e-sign instead", ["adv"], "filing/sections/sign-section"),
      f("Edit the bail bond (invalidates signatures)", ["adv"], "filing/bail-bond-status-dialog"),
      f("Pay ₹X? · File with the court? · Mark as done?", ["adv"], "tasks/act/*"),
      f("Discard this draft (primary button)", ["staff"], "employee/order-editor"),
      f("Sign order(s) · e-sign exhibits · complete order data", ["mag"], "employee/pending-order(s)-screen · sign-evidence"),
      f("Reset sandbox", ["adv", "mag", "staff"], "shell/app-sidebar · employee/employee-nav"),
    ],
  },
  {
    id: "field",
    name: "Field errors",
    weight: 2,
    note: "The DS field error is sound: red label, red ring, red line. A few forms skip it and print a loose red paragraph.",
    specimens: [
      { label: "Field errors", now: <Now.FieldErrorsToday />, next: <Next.FieldErrorsNext />, why: "Kept. Adds the small cross mark to the line, and the loose red paragraph becomes a proper field error." },
    ],
    flows: [
      f("Registration, sign-in, OTP", ["adv", "lit"], "registration/* · sign-in-block"),
      f("Join case, bail, PoA, add advocate, raise application", ["adv", "lit"], "join/* · cases/* · filing/*"),
      f("Court sign-in, reasons, exhibit numbers, dates", ["mag", "staff"], "employee/*"),
      f("Edit litigant address (loose red text)", ["adv"], "cases/edit-litigant-dialog · alternate-addresses"),
    ],
  },
  {
    id: "dead-end",
    name: "Dead ends and expired links",
    weight: 1,
    note: "A grey file icon and a heading, or on the signing link page, a heading alone. Nothing says 'this is a problem'.",
    specimens: [
      { label: "Not found", now: <Now.DeadEndToday />, next: <Next.DeadEndNext />, why: "A neutral mark with the same icon, not a warning: a missing link is not bad news." },
      { label: "Link no longer active", now: <Now.LinkDeadToday />, next: <Next.LinkDeadNext />, why: "Neutral mark with a link icon. No button added, as today." },
    ],
    flows: [
      f("This task is not here · not on your access", ["adv"], "tasks/act/act-page · scrutiny/scrutiny-page"),
      f("Listing / complaint / application not here", ["mag", "staff"], "employee/*-screen"),
      f("This upload has expired", ["adv"], "bulk/setup-flow"),
      f("This link is no longer active", ["lit"], "filing/sign-link/sign-link-screen"),
      f("We couldn't create a draft", ["adv"], "filing/new-filing"),
    ],
  },
  {
    id: "quiet",
    name: "Failures in a quiet tone",
    weight: 1,
    note: "Real failures shown as an info note, muted text, or a plain heading.",
    specimens: [
      { label: "Info, muted, plain", now: <Now.QuietFailuresToday />, next: <Next.QuietFailuresNext />, why: "Could not load keeps today's info tone, in the new line shape. A document that will not open gets a neutral mark. 'Not approved' is kept as it is: it is quiet on purpose." },
    ],
    flows: [
      f("We could not load your case", ["lit"], "onboarding/steps"),
      f("Document / application text could not be shown", ["adv", "lit", "mag", "staff"], "cases/pdf-viewer · employee/application-dialog"),
      f("Registration photo could not be opened", ["staff"], "employee/approve-registrations-dialog"),
      f("Your registration was not approved", ["adv"], "registration/resubmission-flow"),
    ],
  },
  {
    id: "warn-marks",
    name: "Warning badges and ink (state)",
    weight: 1,
    note: "Badges and red/amber text are right as states, but icons vary (circle, triangle, none) and 'Errored' is bare amber text.",
    specimens: [
      { label: "Assorted", now: <Now.WarnMarksToday />, next: <Next.WarnMarksNext />, why: "One small mark per tone, the same shape as the success dot. Errored becomes a badge with its reason beside it." },
    ],
    flows: [
      f("Overdue · Due today · Pending review · N actions", ["adv", "mag", "staff"], "many"),
      f("Errored · Not delivered (process rows)", ["staff"], "employee/sign-process-table"),
      f("Incomplete · needs fixing · to check", ["adv"], "filing/* · bulk/*"),
      f("Couldn't save. Retrying", ["adv"], "filing/saving-indicator"),
    ],
  },
  {
    id: "missing",
    name: "States that don't exist yet",
    weight: 0,
    note: "Places where something can fail but the product has no failure state. Designed here in the same system; their copy is new and draft.",
    specimens: [
      { label: "Payment declined", now: <Now.MissingToday what="Payment declined">Court fee, bail fee and application fee payments always succeed. Only advocate join has a failure line.</Now.MissingToday>, next: <Next.PayDeclinedNext />, why: "Red hero, the fee it was for, and the two ways on: Try again or Pay later. Draft copy." },
      { label: "Wrong OTP", now: <Now.MissingToday what="Wrong OTP">Any six digits are accepted. The only OTP error is "Enter all 6 digits."</Now.MissingToday>, next: <Next.OtpWrongNext />, why: "The code boxes turn red and the line says what to do; the resend timer stays. Draft copy." },
      { label: "Expired OTP", now: <Now.MissingToday what="Expired OTP">There is no expiry, so there is no expired state.</Now.MissingToday>, next: <Next.OtpExpiredNext />, why: "Same field, a different line, and the way out is the resend link. Draft copy." },
      { label: "Batch partly signed", now: <Now.MissingToday what="Batch partly signed">The filings dashboard batch has no partial branch: it is all, or nothing drawn as success.</Now.MissingToday>, next: <Next.BatchPartialNext />, why: "The same tally as the process line: what fully happened in the hero, the split in a bar, one line per outcome. Draft copy." },
      { label: "DSC not found", now: <Now.MissingToday what="DSC not found">The certificate lookup only shows searching or found.</Now.MissingToday>, next: <Next.DscMissingNext />, why: "Inline error line in the signing step with Try again, and the other way to sign. Draft copy." },
      { label: "Page not found", now: <Now.MissingToday what="Page not found">The app has no not-found page; Next.js shows its default 404.</Now.MissingToday>, next: <Next.NotFoundNext />, why: "Neutral, like the other dead ends, with one way home. Draft copy." },
      { label: "Page failed to load", now: <Now.MissingToday what="Page failed to load">The app has no error page; a crash shows the framework default.</Now.MissingToday>, next: <Next.PageErrorNext />, why: "This one is an error: red mark, says nothing changed, one Reload button. Draft copy." },
    ],
    flows: [
      f("Court fee (e-filing) · bail fee · application fee · submission fee", ["adv", "lit"], "filing/sections/sign-section · cases/*-payment-dialog · payment/payment-steps"),
      f("Sign-in, registration, e-sign OTP", ["adv", "lit"], "sign-in-block · registration/* · filing/sign-stages"),
      f("Filings dashboard batch sign / pay", ["adv"], "filing/dashboard/batch-filing-dialog"),
      f("DSC lookup", ["adv", "mag"], "filing/sign-stages"),
      f("Any broken link or crash", ["adv", "lit", "mag", "staff"], "app/ (no not-found.tsx / error.tsx)"),
    ],
  },
];
