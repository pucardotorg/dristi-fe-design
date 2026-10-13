"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarX2Icon } from "lucide-react";

import { Identifier } from "@/components/chrome/identifier";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Step, StepGroup } from "@/components/employee/step-timeline";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  causeTitle,
  counselFor,
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  courtHearingStatusLabel,
  courtHearingStatusVariant,
  hearingById,
  parseIsoDay,
  withHearingSession,
  type CourtHearing,
} from "@/lib/employee/hearings";
import {
  caseTimeline,
  formatCaseDate,
  formatTimelineDate,
  formatCaseWeekday,
  formatChequeAmount,
  formatCounselList,
  hearingCaseExtras,
  type HearingCaseExtras,
} from "@/lib/employee/hearing-overview";

/**
 * The two surfaces this overview is read on.
 *
 * `page` is the route: a section is a lifted sheet, the same recipe as today's cause
 * list (`HearingsScreen`) and the order composer — hairline edge, no nested second
 * frame inside it. `overlay` is the sheet the cause title opens over the cause list,
 * which is *itself* the lifted surface: the sheet's body is the sunken stage, and
 * the sections sit on it as white cards. A `shadow-raised` panel inside a
 * `shadow-modal` sheet is depth spent twice, so the overlay cards stay flat, and
 * the radius steps down with the nesting (ui-craft §4).
 *
 * One set of sections, two dresses — rather than a second composition of the same
 * facts, which is how two surfaces holding one case start disagreeing about it.
 */
/**
 * `panel`: inside another panel's tab — the order composer's case file. The tab is the
 * frame, so the sections carry none of their own.
 */
export type HearingOverviewSurface = "page" | "overlay" | "panel";

const PANEL: Record<HearingOverviewSurface, string> = {
  page: "min-w-0 rounded-xl border border-hairline bg-card p-6 shadow-raised",
  overlay: "min-w-0 rounded-lg bg-card p-4",
  panel: "min-w-0",
};

/**
 * Type, by surface. On a page and in the overlay a section reads at the body size; in a
 * panel's tab it steps down to the 14px the panel's other tabs read at — headings,
 * terms and values alike — so the Overview is not the one tab shouting (owner,
 * 2026-10-14).
 */
const HEADING: Record<HearingOverviewSurface, string> = {
  page: "text-body font-semibold",
  overlay: "text-body font-semibold",
  panel: "text-body-compact font-semibold",
};
const BODY: Record<HearingOverviewSurface, string> = {
  page: "text-body",
  overlay: "text-body",
  panel: "text-body-compact",
};

/** The one inset inside Last hearing — a sunken well in a white card on both surfaces. */
const ORDER_WELL = "bg-surface-sunken";

/**
 * The corner anything nested inside a section takes — the date tile and the order
 * well. It follows the section's own, one step down the ladder: an inset that rounds
 * as hard as the box holding it bulges at the corners, and in the overlay the section
 * has already stepped down once itself (ui-craft §4).
 */
const INSET_RADIUS: Record<HearingOverviewSurface, string> = {
  page: "rounded-lg",
  overlay: "rounded-md",
  panel: "rounded-lg",
};

/**
 * One listing's case overview — what is in this case, at a glance.
 *
 * Entered from the cause title on today's cause list, and by anyone landing on the
 * URL. **Start hearing no longer comes here.** Calling a matter now opens these same
 * sections in an overlay over the cause list (`hearing-overview-dialog.tsx`), because
 * the bench that has just called item 4 is still working the day's list and should not
 * be taken off it to read the case it is about to hear. The route stays for the other
 * two ways in: reading a matter without calling it, and a link that has to survive a
 * new tab, a bookmark or the back button.
 *
 * The two surfaces are not two compositions. `HearingOverviewSections` is one set of
 * sections rendered on both, dressed for whichever it is on — the peek was retired for
 * showing the same facts a second way, and that is not a mistake worth making twice.
 *
 * **It reads, it does not run the sitting.** End hearing, Pass over and the order
 * composer all stay on the cause list, where the day is. Calling the matter is what
 * got the bench here; the one action this page offers is a way further into the
 * case, and even that is not connected yet (`ViewCaseAction`).
 *
 * **It carries no back control of its own.** The court's chrome already is one: the
 * trail in the top bar ends in Today's hearings, a live link to the list this page
 * was opened from, sticky at every width and cut to its two ends on a phone so the
 * way home survives (`lib/employee/navigation.ts` sets that doctrine out — the trail
 * is the path back, and the page is never a step in it).
 *
 * **View case lives in a pinned band at the foot of the page, right-aligned.** The
 * brief for this screen (`docs/design/proposals/hearing-overview.md`) recommended
 * against a band here and argued for the header slot; the owner read that
 * recommendation in full and decided for the band on 2026-09-06. The call is logged
 * in that file's decision log, and it is why this screen is composed the way it is.
 * The action moved rather than multiplied — the header keeps the caption, the cause
 * title and the status chip, and the page still spends its one teal exactly once.
 * Placement inside the band matches the house sticky-bar recipe used one route
 * along (`order-screen.tsx` `sm:ml-auto`, `sign-orders-screen.tsx` `justify-end`):
 * the primary sits on the trailing edge.
 *
 * The band is the recipe the order composer uses one route along
 * (`order-screen.tsx`): hairline top rule, card fill, no shadow of its own. The page
 * carries pinned chrome at both ends now, and neither end is louder than the other.
 */
export function HearingOverviewScreen({ hearingId }: { hearingId: string }) {
  const session = useHearingSession();
  const listed = hearingById(hearingId);

  if (!listed) return <HearingMissing />;

  /* The fixture's status is the day's starting position, not where the sitting has
     got to: a matter the bench called a moment ago is on the board as scheduled and
     is ongoing in the session. The list applies the same overlay before it renders a
     chip, and the two must not disagree about the same listing. */
  const [hearing] = withHearingSession([listed], session);

  return <HearingOverview hearing={hearing} />;
}

/**
 * An id no cause list holds. Modelled on the order composer's own miss, because it
 * is the same miss arriving by the same route.
 */
function HearingMissing() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX2Icon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">
            This listing is not on the board
          </EmptyTitle>
          <EmptyDescription className="text-body">
            A case overview opens a matter from today&rsquo;s cause list. This one
            is not there.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/employee/hearings">Back to today&rsquo;s hearings</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

function HearingOverview({ hearing }: { hearing: CourtHearing }) {
  /* Two parts: the page, which scrolls, and the band, which does not. The padding
     moves off the outer column and onto the reading column so the band can reach
     both edges — the composer's arrangement next door, and the reason the band's
     own `px` repeats the page step instead of inheriting it. */
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 pb-0 md:p-8 md:pb-0">
        {/* The order composer's header, one page along: the caption says which
            listing this is, the cause title is the page, and the chip says where
            the sitting stands.

            Nothing sits opposite the title now that View case has moved to the
            band, so the row split and its `justify-between` went with it. Kept,
            they would have held open a right half with nothing in it. One column,
            at every width. */}
        <header className="flex min-w-0 flex-col gap-2">
          <p className="text-caption font-medium text-muted-foreground">
            <HearingOverviewCaption hearing={hearing} />
          </p>
          {/* The chip rides with the title rather than taking a third line under
              it. The cause and where its sitting stands are one thought — this
              matter, and it is under way — and stacking them spent a line of the
              page on nothing before the first panel. `flex-wrap` puts the chip
              back on its own line when the title fills a phone. */}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-title text-balance font-semibold sm:text-title-l">
              {causeTitle(hearing)}
            </h1>
            <Badge variant={courtHearingStatusVariant(hearing.status)}>
              {courtHearingStatusLabel(hearing.status)}
            </Badge>
          </div>
        </header>

        <HearingOverviewSections hearing={hearing} surface="page" />
      </div>

      {/* The band. One action, pinned, on the trailing edge — the house sticky-bar
          placement (`justify-end`), taken over the brief's header recommendation
          and recorded above.

          The container is the composer's band to the class, because the two screens
          are one route apart and a second recipe for the same shape is how a
          pattern stops meaning anything. It takes the trail's `z-30` rather than
          outranking it: the two are at opposite ends and never meet, while the
          rail's mobile sheet sits above both and must stay there. No shadow — the
          hairline is the seam, the same way the top bar is edged, and lift on
          chrome would be depth used as decoration (DS elevation foundation).

          The tooltip is portalled to the body, so nothing in here — the stacking
          context, the fill — can clip it, and it opens upward over the page. */}
      <footer className="sticky bottom-0 z-30 mt-8 border-t border-hairline bg-card px-6 py-3 md:px-8 md:py-4">
        <div className="flex flex-col items-end gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <ViewCaseAction />
        </div>
      </footer>
    </div>
  );
}

/**
 * Which listing this is: the court's serial, the case number, and what it is listed
 * for today. The same words on both surfaces, in different roles — an eyebrow above
 * the page's title, and the `DialogDescription` under the overlay's — so it hands back
 * the line and lets each surface own the element it sits in. Wrapping it in a `<p>`
 * here would put a paragraph inside the dialog's own.
 */
export function HearingOverviewCaption({ hearing }: { hearing: CourtHearing }) {
  return (
    <>
      {/* The item is a *position* in today's board and keeps plain figures; the case
          number is an identifier and takes the treatment. The rule is by kind of fact,
          which is why these two sit side by side wearing different faces. */}
      Item <span className="tabular-nums">{hearing.item}</span>
      {" · "}
      <Identifier value={hearing.caseNumber} label="case number" />
      {" · "}
      {courtHearingPurposeLabel(hearing.purpose)}
    </>
  );
}

/**
 * What is in this case — the three sections, on whichever surface is asking.
 *
 * Case details and Last hearing pair across the top; the history runs the full width
 * beneath them.
 *
 * The facts are six term/detail pairs and want the smaller share — at three-fifths the
 * list spread "Evidence" across 500px of nothing and read as stretched. The order of
 * the day is a paragraph and wants measure, so it takes the larger. History is last
 * because it is the part that grows: three steps today, but a matter that has run two
 * years is a long column, and the width is there for entries that carry more than a
 * date.
 *
 * The two top panels stretch to a common height rather than sitting at their own —
 * `items-start` is what left the shorter one dangling beside the taller. Slack inside a
 * lifted panel reads as padding; the same slack beside it reads as a hole.
 *
 * The column split is a viewport query on both surfaces, not a container one: the
 * overlay is `sm:max-w-4xl`, so at the width where the page pairs them the sheet has
 * room to pair them too, and below it both stack.
 */
export function HearingOverviewSections({
  hearing,
  surface,
}: {
  hearing: CourtHearing;
  surface: HearingOverviewSurface;
}) {
  const today = useCourtToday();
  const extras = hearingCaseExtras(hearing.id);

  return (
    /* `gap-8` is the page's section break. Inside the overlay the sections are cards
       on the sheet's sunken body rather than separate lifted panels, so they close
       to `gap-4` — the step the sheet's own padding is set at. */
    <div
      className={`grid min-w-0 lg:grid-cols-5 ${
        surface === "page" ? "gap-8" : "gap-4"
      }`}
    >
      <CaseFactsPanel
        hearing={hearing}
        extras={extras}
        surface={surface}
        className="lg:col-span-2"
      />
      {extras.lastHearing ? (
        <LastHearingPanel
          on={extras.lastHearing.on}
          purpose={extras.lastHearing.purpose}
          order={extras.lastHearing.order}
          directed={extras.lastHearing.directed}
          surface={surface}
          className="lg:col-span-3"
        />
      ) : (
        <NoLastHearingPanel surface={surface} className="lg:col-span-3" />
      )}
      <CaseHistoryPanel
        hearing={hearing}
        extras={extras}
        today={today}
        surface={surface}
        className="lg:col-span-5"
      />
    </div>
  );
}

/**
 * The overview's one CTA — and the one thing on it that does not work.
 *
 * Shared by the page's band and the overlay's footer, so the two ends of the same
 * promise cannot drift apart.
 *
 * A full case file has been built, on the citizen side, in the advocate's flows.
 * `/employee` does not read from there (`lib/employee/content.ts`), and there is no
 * court-side case file yet, so wiring this today would either point at a route that
 * 404s or cross the split the two halves of the app are being built either side of.
 * Connecting it is a decision that has been taken and deferred, not one this screen
 * gets to make.
 *
 * So it is a real button that says plainly it goes nowhere — `aria-disabled` rather
 * than `disabled`, so it keeps focus and the tooltip is reachable by keyboard. The
 * same bargain Join VC makes on the cause list. No icon: the label is the whole of it.
 *
 * **Teal only where it is the act.** On this page it is the one thing the band offers,
 * so it takes the page's one primary. In the cause-list overlay it shares the footer
 * with the call on the sitting — a real act, against a promise — so there it steps down
 * to `outline` and the teal goes to Start hearing. One surface, one primary (ui-craft
 * §1.2): a promise and an act cannot both be it, and the act wins.
 *
 * `aria-disabled` is a promise to assistive tech and nothing else: the DS Button
 * hangs its dimming off `:disabled` (`button.tsx`), which this control does not
 * set, so left alone it ships full-strength teal with a live hover and the press
 * translate — it lit up, went down under the finger, and did nothing. Tolerable
 * beside a title; not in a band that means "the act on this page lives here" on a
 * dozen other screens. The three `aria-disabled:` utilities restore the DS's own
 * disabled look (`opacity-50`) and cancel the two states that were lying.
 * Deliberately **not** `pointer-events-none` — the DS pairs that with `:disabled`,
 * and here it would kill the hover that opens the tooltip, which is the one thing
 * explaining why the button is dead.
 *
 * It stays `w-fit` at every width rather than filling the band on a phone. A
 * button stretched edge to edge is not at the right of anything — it is a teal
 * bar pinned under the reading, permanently, on the one control here that goes
 * nowhere. The band still stacks if a second action ever joins it.
 */
/**
 * The hover each dress has to have cancelled, because the DS hangs it off the variant:
 * `default` lifts to `primary-hover`, `outline` to `accent`. Both would be the button
 * answering a pointer it is not going to answer.
 */
const VIEW_CASE_DEAD_HOVER = {
  default: "aria-disabled:hover:bg-primary",
  outline: "aria-disabled:hover:bg-card",
} as const;

export function ViewCaseAction({
  variant = "default",
}: {
  /** `outline` where a real act shares the band — see above. */
  variant?: "default" | "outline";
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-disabled
            variant={variant}
            className={`w-fit shrink-0 aria-disabled:opacity-50 ${VIEW_CASE_DEAD_HOVER[variant]} aria-disabled:active:translate-y-0`}
          >
            View case
          </Button>
        </TooltipTrigger>
        {/* Anchored to the button's trailing edge, not centred on it. From the
            band's right gutter the centred default overruns the page edge on a
            desktop and sits flush against the glass on a phone. `align` is the
            primitive's own prop — the court nav passes `side` the same way. */}
        <TooltipContent align="end">
          The case file is not connected yet
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * The glance: where the case has reached, what it is listed for today, who is on
 * each side, and the two numbers a §138 matter turns on.
 *
 * Cheque amount and Filed come from the demo sidecar and are simply absent when it
 * has none — a first listing shows four rows rather than four rows and two blanks.
 * A side with no counsel on record shows the party alone; no vakalat is a fact, not
 * a gap to fill with a dash.
 */
function CaseFactsPanel({
  hearing,
  extras,
  surface,
  className,
}: {
  hearing: CourtHearing;
  extras: HearingCaseExtras;
  surface: HearingOverviewSurface;
  className?: string;
}) {
  const complainantCounsel = counselFor(hearing, "complainant").map(
    (entry) => entry.name,
  );
  const accusedCounsel = counselFor(hearing, "accused").map(
    (entry) => entry.name,
  );

  return (
    <section
      className={`${PANEL[surface]} flex flex-col gap-2 ${className ?? ""}`}
      aria-labelledby="case-facts"
    >
      {/* `gap-2` and not the section default: the list's own rows already carry
          `py-3`, so a full step here would open a 28px hole under the heading. */}
      <h2 id="case-facts" className={HEADING[surface]}>
        Case details
      </h2>
      <DescriptionList>
        <FactRow surface={surface} term="Stage">{courtCaseStageLabel(hearing.stage)}</FactRow>
        <FactRow surface={surface} term="This sitting">
          {courtHearingPurposeLabel(hearing.purpose)}
        </FactRow>
        <PartyRow
          surface={surface}
          term="Complainant"
          name={hearing.parties.complainant}
          counsel={complainantCounsel}
        />
        <PartyRow
          surface={surface}
          term="Accused"
          name={hearing.parties.accused}
          counsel={accusedCounsel}
        />
        {extras.chequeAmount ? (
          <FactRow surface={surface} term="Cheque amount">
            <span className="tabular-nums">
              {formatChequeAmount(extras.chequeAmount)}
            </span>
          </FactRow>
        ) : null}
        {extras.filedOn ? (
          <FactRow surface={surface} term="Filed">
            <span className="tabular-nums">{formatCaseDate(extras.filedOn)}</span>
          </FactRow>
        ) : null}
      </DescriptionList>
    </section>
  );
}

/**
 * The row metric, tuned from the screen with classes — never by editing the synced
 * primitive.
 *
 * Three changes to the DS default. The term column narrows from `minmax(7rem,10rem)`
 * to `minmax(6rem,8rem)`: in a two-fifths panel the wider one spent two fifths of the
 * line on the word "Stage", and pushed a corporate accused onto a second row it did
 * not need. `py-3` drops to `py-2`, because six rows at the looser step read as a
 * stretched list rather than a record. And the stroke drops to hairline — six rows at
 * full strength would be the darkest marks on the page, and an internal divider
 * inside a panel that already has an edge is not what full strength is for
 * (ui-craft §1.1).
 */
const FACT_ROW_CLASS = "grid-cols-[minmax(6rem,8rem)_1fr] border-hairline py-2";

/** One key-value row. */
function FactRow({
  surface,
  term,
  children,
}: {
  surface: HearingOverviewSurface;
  term: string;
  children: ReactNode;
}) {
  return (
    <DescriptionRow className={FACT_ROW_CLASS}>
      <DescriptionTerm className={BODY[surface]}>{term}</DescriptionTerm>
      <DescriptionDetails className={`${BODY[surface]} font-medium`}>
        {children}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

/** A side of the cause, and who appears for it. Counsel recedes below the party. */
function PartyRow({
  surface,
  term,
  name,
  counsel,
}: {
  surface: HearingOverviewSurface;
  term: string;
  name: string;
  counsel: string[];
}) {
  return (
    <DescriptionRow className={FACT_ROW_CLASS}>
      <DescriptionTerm className={BODY[surface]}>{term}</DescriptionTerm>
      <DescriptionDetails className={`flex flex-col gap-1 ${BODY[surface]}`}>
        {/* A corporate accused runs long. The row's value column is `1fr`, so the
            name wraps inside it rather than pushing the panel wide. */}
        <span className="font-medium">{name}</span>
        {counsel.length > 0 ? (
          <span className="text-body-compact text-muted-foreground">
            Counsel: {formatCounselList(counsel)}
          </span>
        ) : null}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

/**
 * What happened the last time this matter was called.
 *
 * The peek nested this in a card inside the overview; on a page the panel is the
 * card, so the shadow does not sit inside another shadow (ui-craft §4). The order
 * itself lands in a sunken well — the panel's one inset, and the thing on this page
 * most likely to be read word for word.
 *
 * "Order of the day" or "Latest update" follows `directed`: an order the court
 * passed is not the same claim as a note about where the matter got to, and this
 * build must not dress the second as the first.
 */
function LastHearingPanel({
  on,
  purpose,
  order,
  directed,
  surface,
  className,
}: {
  on: string;
  purpose: string;
  order: string;
  directed: boolean;
  surface: HearingOverviewSurface;
  className?: string;
}) {
  const sat = parseIsoDay(on);
  const day = sat.toLocaleDateString("en-IN", { day: "numeric" });
  const month = sat.toLocaleDateString("en-IN", { month: "short" });

  return (
    <section
      className={`${PANEL[surface]} flex flex-col gap-4 ${className ?? ""}`}
      aria-labelledby="last-hearing"
    >
      <h2 id="last-hearing" className={HEADING[surface]}>
        Last hearing
      </h2>
      <div className="flex items-start gap-4">
        {/* The tile is the date as a mark, and it is `aria-hidden` — decoration,
            not information. So the line beside it states the date in full, year
            and all. Trimming it to the weekday to avoid echoing the tile's own
            "19 Aug" left the one non-decorative date on this panel reading
            "Wednesday, 2026", and even done properly it would have left a matter
            that last sat two years ago with no visible year at all. The echo is
            the cheaper of the two costs. `<time>` carries the machine-readable
            day, so the date is stated once in each register. */}
        <div
          className={`flex size-12 shrink-0 flex-col items-center justify-center bg-brand-muted ${INSET_RADIUS[surface]}`}
          aria-hidden
        >
          <span className="text-body font-semibold tabular-nums text-brand-muted-foreground">
            {day}
          </span>
          <span className="text-caption text-brand-muted-foreground">
            {month}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <time
            dateTime={on}
            className={`${BODY[surface]} font-medium tabular-nums`}
          >
            {formatCaseWeekday(on)}
          </time>
          <p className="text-body-compact text-muted-foreground">{purpose}</p>
        </div>
      </div>
      <div
        className={`flex min-w-0 flex-col gap-2 p-4 ${INSET_RADIUS[surface]} ${ORDER_WELL}`}
      >
        <p className={`${BODY[surface]} font-medium`}>
          {directed ? "Order of the day" : "Latest update"}
        </p>
        <p className={`${BODY[surface]} text-muted-foreground`}>{order}</p>
      </div>
    </section>
  );
}

/**
 * A matter with no earlier sitting on record — a first listing, which is most of a
 * cause list.
 *
 * It holds the column rather than leaving it out, because "has this been heard
 * before?" is a question the bench is asking when it opens this page, and *no* is an
 * answer to it. Dropping the panel would give that answer as a gap, and give the row
 * a hole where its second half should be.
 *
 * The wording is about the record, not the case: the sidecar carries no earlier
 * sitting for this matter (`lib/employee/hearing-overview.ts`), and this build must
 * not upgrade that into a finding that the court never called it.
 */
function NoLastHearingPanel({
  surface,
  className,
}: {
  surface: HearingOverviewSurface;
  className?: string;
}) {
  return (
    <section
      className={`${PANEL[surface]} flex flex-col gap-4 ${className ?? ""}`}
      aria-labelledby="last-hearing-none"
    >
      <h2 id="last-hearing-none" className={HEADING[surface]}>
        Last hearing
      </h2>
      {/* `Empty` is `flex-1` and centres its own content, so in a panel stretched to
          the height of the facts beside it the message sits in the middle of the
          column rather than clinging to the heading. Borderless and unpadded — the
          panel is already the frame. */}
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX2Icon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className={`${HEADING[surface]} tracking-normal`}>
            No earlier sitting on record
          </EmptyTitle>
          <EmptyDescription className="text-body-compact">
            Nothing has been recorded for this matter between the complaint and
            today&rsquo;s listing.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}

/**
 * The case as a sequence — filed, called, called again. The peek's second tab, and
 * with the peek gone it has nowhere else to live; a page can simply show it.
 *
 * Titles and dates only. The step's `note` is the last sitting's order, which the
 * panel above already prints in full — see `CaseHistoryItem`.
 *
 * It runs the page's width and comes last because it is the section that grows: a
 * matter two years old is a long column, and a step that one day carries more than a
 * date has the room for it. Today's three entries leave that room visibly unused,
 * which is a fact about the case rather than a fault in the layout.
 */
function CaseHistoryPanel({
  hearing,
  extras,
  today,
  surface,
  className,
}: {
  hearing: CourtHearing;
  extras: HearingCaseExtras;
  today: string;
  surface: HearingOverviewSurface;
  className?: string;
}) {
  const timeline = caseTimeline(hearing, extras, today);

  return (
    /* `@container` is what lets a step split into three columns: the group is the same
       component the waiting complaint's file uses (`step-timeline.tsx`), and it reads its
       width from whatever holds it rather than from the viewport — so it lays out
       correctly in a page panel and in a dialog sheet without either knowing the other's
       width. */
    <section
      className={`${PANEL[surface]} @container flex flex-col gap-6 ${className ?? ""}`}
      aria-labelledby="case-history"
    >
      {/* In the case file's own Case history tab the tab names it already. */}
      <h2
        id="case-history"
        className={surface === "panel" ? "sr-only" : "text-body font-semibold"}
      >
        Case history
      </h2>
      {/* Two phases, stacked, in the order they happened. Everything in the first
          happened to two private parties and is measured against §138; everything in
          the second is the court's own record. The full width the panel takes is spent
          on three columns — the step, the statutory window it closes, and the day — so
          the dates share one edge down the whole chain and a reader can check a limit
          against the two dates either side of it. */}
      <div className="flex flex-col gap-8">
        {timeline.beforeFiling.length > 0 ? (
          <StepGroup heading="Before filing">
            {timeline.beforeFiling.map((step) => (
              <Step
                key={step.id}
                label={step.label}
                note={step.note}
                aside={step.aside}
                tone={step.tone}
                date={
                  step.on ? (
                    <time dateTime={step.on}>{formatTimelineDate(step.on)}</time>
                  ) : (
                    "Today"
                  )
                }
              />
            ))}
          </StepGroup>
        ) : null}
        <StepGroup heading="In court">
          {timeline.inCourt.map((step) => (
            <Step
              key={step.id}
              status={step.status}
              label={step.label}
              note={step.note}
              aside={step.aside}
              tone={step.tone}
              date={
                step.on ? (
                  <time dateTime={step.on}>{formatTimelineDate(step.on)}</time>
                ) : (
                  "Today"
                )
              }
            />
          ))}
        </StepGroup>
      </div>
    </section>
  );
}

/**
 * The case at a glance, for a narrow column — the order composer's case file, Overview
 * tab: the same Case details and Last hearing the hearing overview shows, stacked.
 */
export function HearingCaseOverview({ hearing }: { hearing: CourtHearing }) {
  const extras = hearingCaseExtras(hearing.id);
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <CaseFactsPanel hearing={hearing} extras={extras} surface="panel" />
      {extras.lastHearing ? (
        <LastHearingPanel
          on={extras.lastHearing.on}
          purpose={extras.lastHearing.purpose}
          order={extras.lastHearing.order}
          directed={extras.lastHearing.directed}
          surface="panel"
        />
      ) : (
        <NoLastHearingPanel surface="panel" />
      )}
    </div>
  );
}

/** The case's history, for a narrow column — the order composer's Case history tab. */
export function HearingCaseHistory({ hearing }: { hearing: CourtHearing }) {
  const today = useCourtToday();
  return (
    <CaseHistoryPanel
      hearing={hearing}
      extras={hearingCaseExtras(hearing.id)}
      today={today}
      surface="panel"
    />
  );
}
