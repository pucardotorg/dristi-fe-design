"use client";

import * as React from "react";

import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import { StagedOverlay } from "@/components/chrome/staged-overlay";
import {
  HearingOverviewCaption,
  HearingOverviewSections,
  ViewCaseAction,
} from "@/components/employee/hearing-overview-screen";
import {
  HearingPassOverMenu,
  HearingSessionButton,
} from "@/components/employee/hearings-table";
import {
  NextDateField,
  NextPurposeField,
} from "@/components/employee/next-hearing-fields";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import type { CourtRole } from "@/lib/employee/content";
import { seatPostsNextHearing } from "@/lib/employee/court-role";
import {
  causeTitle,
  courtHearingStatusLabel,
  courtHearingStatusVariant,
  type CourtHearing,
} from "@/lib/employee/hearings";

/**
 * A matter from the day's list, read over the list it came from.
 *
 * **One thing opens it: the cause title, and the row that delegates to it.** Reading a
 * matter is one act and calling it is another, and they are now cleanly one control
 * each. The overlay used to be the destination for both — Start hearing marked the
 * listing ongoing and opened this on its way — which made calling the list a run of
 * presses each answered by a sheet to dismiss. Calling no longer opens anything
 * (owner, 2026-09-12); it changes the row it was pressed on and leaves the day where it
 * was.
 *
 * So opening this changes nothing about the matter. Whatever the chip in the header
 * reads is the row's own status, arrived at before this was opened.
 *
 * What it shows is the case overview's own sections, not a second reading of them
 * (`HearingOverviewSections`). The route survives underneath for the one job an overlay
 * cannot do — a link that has to outlive the page, in a bookmark or a typed URL — but no
 * control on the list hands one out any more.
 *
 * **It reads, and it calls.** The order composer is a trip of its own. What the footer
 * carries is the row's hearing controls for *this* matter (`CLS-11`): the session control
 * the row carries, in the same four states (`HearingSessionButton`), and the row's Pass
 * over menu beside it (`HearingPassOverMenu`, `CLS-08`; owner, 2026-10-20, reversing
 * 2026-09-12) — one vocabulary, two places to reach it, rather
 * than an overlay that invents a second way to say Start. It reads whatever the matter's
 * next move is at the moment it was opened: Start hearing on a listing still to be
 * called, End hearing on one under way, and spent on one already heard.
 *
 * Pressing it resolves in place (ui-craft §7): the chip and the footer change where they
 * stand, nothing remounts, and the reader is not thrown back to the list to find out
 * what happened. The row underneath has already changed too — the mark lives outside
 * this component (`lib/employee/hearing-session.ts`), which is what lets the two agree.
 *
 * **Nothing here is a court record.** The same bargain the cause list already makes
 * (`lib/employee/hearings.ts`): starting a hearing is a screen mark, and View case opens
 * one demo case for every listing.
 */
export function HearingOverviewDialog({
  hearing,
  seat,
  onStartHearing,
  onEndHearing,
  onPassOver,
  postsNextHearing = false,
  onOpenChange,
}: {
  /** The listing being read, or `null` when nothing is open. */
  hearing: CourtHearing | null;
  /** Decides whether the footer carries the call at all — as on the row. */
  seat: CourtRole;
  onStartHearing: (hearing: CourtHearing) => void;
  onEndHearing: (hearing: CourtHearing) => void;
  /** The row's Pass over, the same handler (`HearingPassOverMenu`). */
  onPassOver: (hearing: CourtHearing) => void;
  /** The reader's Next hearing column, here too — see `HearingsTable`. */
  postsNextHearing?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={hearing !== null} onOpenChange={onOpenChange}>
      {hearing ? (
        /* Keyed on the listing so calling a second matter opens on its own scroll
           position rather than inheriting the first's — the pattern the review
           queues set. Keyed on the listing and *not* on its status: an act performed
           in here must not remount the sheet, or the outcome reads as the window
           slamming and reopening (ui-craft §7). */
        <HearingOverviewBody
          key={hearing.id}
          hearing={hearing}
          seat={seat}
          onStartHearing={onStartHearing}
          onEndHearing={onEndHearing}
          onPassOver={onPassOver}
          postsNextHearing={postsNextHearing}
        />
      ) : null}
    </Dialog>
  );
}

function HearingOverviewBody({
  hearing,
  seat,
  onStartHearing,
  onEndHearing,
  onPassOver,
  postsNextHearing,
}: {
  hearing: CourtHearing;
  seat: CourtRole;
  onStartHearing: (hearing: CourtHearing) => void;
  onEndHearing: (hearing: CourtHearing) => void;
  onPassOver: (hearing: CourtHearing) => void;
  postsNextHearing: boolean;
}) {
  /* Where this listing stood when the sheet opened. A status different from it is an
     act the reader performed *in here*, and that is the only thing that gets to move:
     the sheet is already rising on open, and a chip that animated then would be a
     second movement on one gesture (ui-craft §8). State rather than a ref because it is
     read during render; the body is keyed on the listing, so a second matter captures
     its own. */
  const [statusAtOpen] = React.useState(hearing.status);
  const resolved = hearing.status !== statusAtOpen;

  return (
    /* The shared court-side frame (`chrome/staged-overlay.tsx`), because this is the same
       kind of surface as every other overlay one route along, and the owner asked for the
       registrations interaction on all of them (2026-09-16). It has one stage — this sheet
       only ever reads a listing and acts on it — and a single-stage flow costs the frame
       nothing while still getting its rise, its chrome and its landing place.

       `sm:max-w-4xl` gives the case panel's tabs and the history's lines room. Its height is
       the frame's `floor`: each tab scrolls inside it, so the sheet keeps one height
       whichever tab is open.

       Its stage is the frame's one-plane `card` stage (below): a single panel needs no
       tinted canvas, and its header carries the hairline every sibling's does. */
    <StagedOverlay
      outsideCloses
      className="sm:max-w-4xl"
      /* One tabbed panel is the whole stage, so it is the frame's one-plane white stage,
         unpadded, rather than a white card on the tinted canvas — the tint bought nothing
         under a single panel, and its gutters were the white space the owner asked to
         cut (2026-10-20). The header and footer hairlines frame it. */
      surface="card"
      padded={false}
      /* Held at the frame's comfortable height, so moving between the tabs does not
         resize the sheet and re-centre it. */
      floor
      /* The case history's type filter (`OrderCaseHistory`) and Next hearing's purpose
         portal their lists outside the sheet. A press on one is not a press outside,
         and the Escape that closes an open list closes only the list; a second Escape
         closes the sheet — the join flow's guard (`join-case-dialog.tsx`). */
      onInteractOutside={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-slot="combobox-content"]')
        )
          event.preventDefault();
      }}
      onEscapeKeyDown={(event) => {
        if (document.querySelector('[data-slot="combobox-content"]'))
          event.preventDefault();
      }}
      /* The chip rides with the cause title, the same thought in the same order as the
         page: this matter, and where it stands on today's list. */
      title={causeTitle(hearing)}
      titleAside={
        /* Keyed on the status so a change remounts the chip and replays the movement —
           the one thing that moved, moving (ui-craft §8). The class is what is
           conditional, not the key: on open nothing has happened yet, so the chip arrives
           with the sheet and does not move on its own. */
        <Badge
          key={hearing.status}
          variant={courtHearingStatusVariant(hearing.status)}
          className={resolved ? RESOLVE_IN_PLACE : undefined}
        >
          {courtHearingStatusLabel(hearing.status)}
        </Badge>
      }
      /* The page prints this line above the title as an eyebrow; a dialog reads its
         description after it, at the house dialog's own support size. Same words, the
         role the surface asks for. */
      description={
        <DialogDescription className="text-body-compact text-muted-foreground">
          <HearingOverviewCaption hearing={hearing} />
        </DialogDescription>
      }
      /* One scene for the life of the sheet: acting on the listing resolves the chip in
         place, it does not move the reader anywhere. */
      sceneKey="listing"
      motion="forward"
      /* Two controls, and the order is the DOM order: the footer is `sm:flex-row
         sm:justify-end` above `sm` and `flex-col-reverse` below it, so the last child is
         the trailing one on a desktop and the top one on a phone. The act goes last. Both
         are `w-fit` so the stacked phone footer is two buttons and not two bars.

         There is no Close. It was the way out for a pointer that never found the corner,
         and it spent the footer's leading slot on the one thing every other exit already
         does — the sheet's own ✕, Esc, and the scrim. The slot is worth more to the act
         (owner, 2026-09-12). */
      footer={
        <>
          <ViewCaseAction variant="outline" />
          <HearingSessionButton
            hearing={hearing}
            seat={seat}
            variant="default"
            onStartHearing={onStartHearing}
            onEndHearing={onEndHearing}
            className="w-fit"
          />
          {/* Pass over, as on the row: the same menu, after the session control and
              secondary to it, on Scheduled and Ongoing listings only (`CLS-08`,
              `CLS-11`). */}
          <HearingPassOverMenu
            hearing={hearing}
            seat={seat}
            onPassOver={onPassOver}
          />
        </>
      }
    >
      {/* The reader's Next hearing is a tab of the case panel, the first (owner,
          2026-10-20). */}
      <HearingOverviewSections
        hearing={hearing}
        surface="overlay"
        nextHearing={
          postsNextHearing && seatPostsNextHearing(seat) ? (
            <NextHearingFields hearing={hearing} />
          ) : undefined
        }
      />
      {/* The outcome, for a reader who cannot see the chip change.
          It has to live *inside* the sheet: Radix hides the rest of the page from
          assistive tech while a modal is open, so the cause list's own announcer —
          which says the same thing for a press made on the row — is unreachable from
          here and would announce to nobody. Mounted empty from the start, because a
          live region that appears already holding its message is not reliably read.
          Inside the stage rather than beside the footer now that the frame owns the
          three rows; it is `sr-only`, so where it sits changes nothing it does. */}
      <p className="sr-only" aria-live="polite">
        {resolved
          ? `${causeTitle(hearing)} is now ${courtHearingStatusLabel(
              hearing.status,
            ).toLowerCase()}`
          : null}
      </p>
    </StagedOverlay>
  );
}

/**
 * The same two fields as the cause list's Next hearing column, for the matter being read
 * — one store, so the row and this tab cannot disagree. The tab names them, so no heading.
 */
function NextHearingFields({ hearing }: { hearing: CourtHearing }) {
  const id = React.useId();
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <span id={`${id}-date`} className="text-body-compact font-medium">
          Date
        </span>
        <NextDateField hearing={hearing} labelledBy={`${id}-date`} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <span id={`${id}-purpose`} className="text-body-compact font-medium">
          Purpose
        </span>
        <NextPurposeField hearing={hearing} labelledBy={`${id}-purpose`} />
      </div>
    </div>
  );
}
