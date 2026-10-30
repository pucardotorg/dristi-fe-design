/* Before/after examples per pattern. `before` is a screenshot from main; `after` is the
   same screen captured on this branch once the fix is built (null until then). */

export type Example = { label: string; before: string; after: string | null; note: string };

const B = (area: string, file: string) => `/coverage-board/before/${area}/${file}`;

export const EXAMPLES: Record<string, Example[]> = {
  refusal: [
    { label: "Add advocate · empty fields on Continue", before: B("citizen", "adv-add-refuse.jpg"), after: "/coverage-board/after/adv-add-refuse.jpg", note: "Today: red text under each field, focus stays on the button. Now: the first missing field takes focus with a red ring; each message has a mark and drops in. Same words." },
    { label: "Sign in · empty number", before: B("access", "signin-empty-submit.jpg"), after: "/coverage-board/after/signin-empty-submit.jpg", note: "Today: red text only. Now: the field's ring turns red, focus moves into it, the message drops in with a mark. A second press shakes the field." },
  ],
  greyed: [
    { label: "E-sign · OTP not typed", before: B("citizen", "t-sign-otp.jpg"), after: "/coverage-board/after/t-sign-otp.jpg", note: "Today: Sign is greyed until six digits are typed, with no reason given. Now: Sign stays pressable. Pressed early, the code boxes turn red and say what's missing. New line 'Enter the 6-digit OTP.' is draft copy for the PM." },
    { label: "A-Diary · business left blank", before: B("court", "adiary-business-blank.jpg"), after: "/coverage-board/after/adiary-business-blank.jpg", note: "Today: Save is greyed. Now: Save stays pressable. Pressed with the field empty, the field turns red, takes focus and says why. Same words." },
  ],
  away: [
    { label: "Add a witness · no name", before: B("citizen", "aw-refuse.jpg"), after: "/coverage-board/after/aw-refuse.jpg", note: "Today: a red line at the top of the dialog, the field is not marked. Now: the message sits under the name fields instead of at the top. Same words. Still to do: the two input boxes don't get the red ring yet." },
  ],
  "confirm-neutral": [
    { label: "Take action · Pay", before: B("citizen", "t-pay-page-confirm.jpg"), after: "/coverage-board/after/t-pay-page-confirm.jpg", note: "Today: plain question, no mark. Now: a grey mark with the pay icon. 'This cannot be recalled.' sits on its own line with a lock. Same words otherwise." },
    { label: "Take action · File with the court", before: B("citizen", "t-file-confirm.jpg"), after: "/coverage-board/after/t-file-confirm.jpg", note: "Today: 'cannot be recalled' sits inside the body text. Now: a grey mark with the send icon; 'This cannot be recalled.' on its own line with a lock." },
  ],
  "confirm-danger": [
    { label: "People · Remove from office", before: B("access", "pad-remove-from-office-confirm.jpg"), after: "/coverage-board/after/pad-remove-from-office-confirm.jpg", note: "Today: soft red button, no mark. Now: a red mark with the remove-person icon above the question. The hand-drawn divider under the title is gone, as in other confirms." },
    { label: "Court · Discard recorded statement", before: B("court", "evidence-discard-statement-confirm.jpg"), after: "/coverage-board/after/evidence-discard-statement-confirm.jpg", note: "Today: no mark. Now: a red mark with a bin above the question. Same words and buttons." },
  ],
  silent: [
    { label: "Court · sign a form or bail bond", before: B("court", "sign-form-after-submit.jpg"), after: "/coverage-board/after/sign-form-after-submit.jpg", note: "Today: the dialog closes with nothing shown. Now: the window turns into its result, 'Form signed', with the form in a green-labelled box and Done. 'Form signed' is new copy, draft for the PM. The same change would apply to bail bonds, depositions and exhibits." },
    { label: "Court · sign the A-Diary day", before: B("court", "adiary-after-sign.jpg"), after: "/coverage-board/after/adiary-after-sign.jpg", note: "Today: the dialog closes; the page says 'is signed' in an empty state. Now: the window turns into its result, 'A-Diary signed', with Done. 'A-Diary signed' and its line are draft copy for the PM." },
  ],
  slab: [
    { label: "Court · send a process for signature", before: B("court", "process-single-after-send.jpg"), after: "/coverage-board/after/process-single-after-send.jpg", note: "Today: a hand-built green line with a tick in the footer. Now: the window turns into its result in the blue 'sent, waiting' tone, because the magistrate still has to sign. Same words. The tall window leaves a lot of empty space under it: a design call." },
    { label: "Court · processes signed, some not sent", before: B("court", "process-signed-not-sent.jpg"), after: null, note: "Today: a hand-built amber line. Built (grey mark with a checklist), but couldn't be captured: the one demo process set to fail (ST/1334) doesn't appear in the Issuance list for the clerk or the magistrate seat in this build." },
  ],
  words: [
    { label: "Registration · mobile number verified", before: B("access", "reg-otp-verified.jpg"), after: "/coverage-board/after/reg-otp-verified.jpg", note: "Today: a hand-built green line. Now (owner's call, 30 Oct): the same small green line, with the design system's 16px mark instead of a hand-picked icon. The first try used the full status line and was too heavy under one field." },
  ],
  deadend: [
    { label: "Take action · task not here", before: B("citizen", "task-notfound.jpg"), after: "/coverage-board/after/task-notfound.jpg", note: "Today: an empty-state block. Now: centred on the page, a grey mark with the task's icon. Same words and button." },
  ],
  alert: [
    { label: "Cases · could not be loaded", before: B("citizen", "cases-error.jpg"), after: "/coverage-board/after/cases-error.jpg", note: "Today: an old banner box. Now: the shared error line with its mark, same words and button. The em dash became a full stop." },
  ],
  quiet: [
    { label: "Home · 'Yes, this is me'", before: B("access", "home-link-yes.jpg"), after: "/coverage-board/after/home-link-yes.jpg", note: "Today: the case is linked with nothing shown. Now: a short toast 'This case was added'. New copy, draft for the PM (it mirrors 'This case was not added')." },
  ],
  tone: [
    { label: "Cases · 'Preparing your download'", before: B("citizen", "download-zip-toast.jpg"), after: "/coverage-board/after/download-zip-toast.jpg", note: "Today: a green success toast for something that hasn't happened yet. Now: the grey neutral toast. Same words." },
  ],
};
