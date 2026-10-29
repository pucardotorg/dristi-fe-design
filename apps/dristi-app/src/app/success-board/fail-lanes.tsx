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
      { label: "Missing input", now: <Now.BlockToastToday />, next: <Next.BlockToastNext />, why: "Not a toast at all: the field turns red, says what is missing and takes focus. The same rule the product already uses for submit." },
      { label: "Step not open yet", now: <Now.GateToastToday />, next: <Next.GateToastNext />, why: "Nothing to point at, so it stays a toast, in amber with the warning mark. 4s, as today." },
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
      { label: "Nothing was signed", now: <Now.NothingSignedToday />, next: <Next.NothingSignedNext />, why: "Same hero as success, in red with a cross and a small shake. Same words." },
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
      { label: "Registration rejected", now: <Now.RejectedStripToday />, next: <Next.RejectedNext />, why: "Red hero for the decision; 'Account rejected' labels the person card in red; the reason stays in its well." },
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
      { label: "Bulk: one refused", now: <Now.PartialCalloutToday />, next: <Next.PartialCalloutNext />, why: "The hero stays success for what landed; the refused one gets its own amber line with the warning mark, at the same weight as the facts." },
      { label: "Single: refused", now: <Now.PartialFooterToday />, next: <Next.PartialFooterNext />, why: "The viewer stays open, so the footer turns amber with the mark, like the success footer turns green." },
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
    note: "Plain text dialogs, no mark. The confirm button is soft red in one place, solid red in another, and primary teal for 'Discard draft'.",
    specimens: [
      { label: "Removes something", now: <Now.ConfirmRemoveToday />, next: <Next.ConfirmRemoveNext />, why: "A red mark names the risk; the confirm is solid red, as everywhere a thing is removed." },
      { label: "Destroys a draft", now: <Now.ConfirmDiscardToday />, next: <Next.ConfirmDiscardNext />, why: "Discarding cannot be undone, so it is solid red, not primary teal." },
      { label: "Cannot be reversed", now: <Now.ConfirmSignToday />, next: <Next.ConfirmSignNext />, why: "Signing is not destructive, so the button stays primary; the amber mark says it cannot be taken back." },
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
      { label: "Not found", now: <Now.DeadEndToday />, next: <Next.DeadEndNext />, why: "Warning mark in place of the grey icon; title-s heading. Same words, same button." },
      { label: "Link no longer active", now: <Now.LinkDeadToday />, next: <Next.LinkDeadNext />, why: "Gets the warning mark. No button added, as today." },
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
      { label: "Info, muted, plain", now: <Now.QuietFailuresToday />, next: <Next.QuietFailuresNext />, why: "Could not load becomes a warning line; a document that will not open gets the error mark; not approved gets the warning mark over the same heading." },
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
];
