"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarX2Icon,
  ExternalLinkIcon,
} from "lucide-react";

import { Identifier } from "@/components/chrome/identifier";
import { OrderCaseHistory } from "@/components/employee/order-case-history";
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
import {
  causeTitle,
  counselFor,
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  courtHearingStatusLabel,
  courtHearingStatusVariant,
  hearingById,
  withHearingSession,
  type CourtHearing,
} from "@/lib/employee/hearings";
import {
  formatCaseDate,
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
 * case (`ViewCaseAction`).
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
            A case overview opens a matter from today&rsquo;s cause list. This
            one is not there.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/employee/hearings">
              Back to today&rsquo;s hearings
            </Link>
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

          */}
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
 * What is in this case — the two sections, on whichever surface is asking.
 *
 * The case history, then the case's details, each the full width (`CLS-11`). The history
 * is the order screen's Case history tab, which took over the overview's own history
 * and its Last hearing section: the last order is highlighted in it, and its filter
 * narrows it to the orders.
 */
export function HearingOverviewSections({
  hearing,
  surface,
}: {
  hearing: CourtHearing;
  surface: HearingOverviewSurface;
}) {
  const extras = hearingCaseExtras(hearing.id);

  return (
    /* `gap-8` is the page's section break. Inside the overlay the sections are cards
       on the sheet's sunken body rather than separate lifted panels, so they close
       to `gap-4` — the step the sheet's own padding is set at. */
    <div
      className={`flex min-w-0 flex-col ${
        surface === "page" ? "gap-8" : "gap-4"
      }`}
    >
      <CaseHistoryPanel hearing={hearing} surface={surface} />
      <CaseFactsPanel
        hearing={hearing}
        extras={extras}
        surface={surface}
      />
    </div>
  );
}

/**
 * The overview's one way further into the case: the court's case view, opened on its
 * case file (owner, 2026-10-14: "make it open that case file by default"). Shared by the
 * page's band and the overlay's footer, so the two cannot drift apart.
 *
 * In a tab of its own, as Take cognizance's View case is, so the cause list or the
 * overview stays exactly where the bench left it (owner, 2026-10-13).
 *
 * **Teal only where it is the act.** On this page it is the one thing the band offers,
 * so it takes the page's one primary. In the cause-list overlay it shares the footer
 * with the call on the sitting, so there it steps down to `outline` and the teal goes to
 * Start hearing. One surface, one primary (ui-craft §1.2).
 *
 * It stays `w-fit` at every width rather than filling the band on a phone: a button
 * stretched edge to edge is not at the right of anything.
 */
/**
 * The one case every listing opens for now (owner, 2026-10-14: "keep one case and then
 * open that case for all hearings"). The demo cause list's matters have no case records
 * of their own; this is a case on the shared fixture, its file the same case file index
 * every case reads.
 */
const HEARING_DEMO_CASE_HREF = "/employee/cases/c-1001?section=case-file";

export function ViewCaseAction({
  variant = "default",
}: {
  /** `outline` where a real act shares the band — see above. */
  variant?: "default" | "outline";
}) {
  return (
    <Button asChild variant={variant} className="w-fit shrink-0">
      <a href={HEARING_DEMO_CASE_HREF} target="_blank" rel="noopener">
        View case
        <span className="sr-only"> (opens in a new tab)</span>
        <ExternalLinkIcon data-icon="inline-end" aria-hidden />
      </a>
    </Button>
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
        <FactRow surface={surface} term="Stage">
          {courtCaseStageLabel(hearing.stage)}
        </FactRow>
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
            <span className="tabular-nums">
              {formatCaseDate(extras.filedOn)}
            </span>
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
 * The case history — the order screen's Case history tab, the same component
 * (`OrderCaseHistory`, `ORD-15`), and not a second reading of it (`CLS-11`): the full
 * history, oldest first, the case's last order on its well, and the filter that narrows
 * it to orders. It replaces the overview's own history and its Last hearing section.
 *
 * The tab scrolls inside the panel beside the order; here the history scrolls in a box of
 * its own, so it can open at the last order without moving the rest of the overview. The
 * box reaches the panel's edges and takes over its padding (`HISTORY_BOX`), so the
 * filter pins across the full width as it does in the tab. A fixed height rather than a
 * cap: an order read whole opens in the history's place and fills it.
 */
const HISTORY_BOX: Record<HearingOverviewSurface, string> = {
  /* `pt-4` on both: the filter pins against a 1rem top inset, as in the tab. */
  page: "-mx-6 -mb-6 px-6 pt-4 pb-6",
  overlay: "-mx-4 -mb-4 p-4",
  panel: "",
};

function CaseHistoryPanel({
  hearing,
  surface,
  className,
}: {
  hearing: CourtHearing;
  surface: HearingOverviewSurface;
  className?: string;
}) {
  return (
    <section
      className={`${PANEL[surface]} flex flex-col gap-2 ${className ?? ""}`}
      aria-labelledby="case-history"
    >
      <h2 id="case-history" className={HEADING[surface]}>
        Case history
      </h2>
      <div
        data-history-scroller
        className={`flex h-[28rem] min-h-0 flex-col overflow-y-auto ${HISTORY_BOX[surface]}`}
      >
        <OrderCaseHistory hearing={hearing} labelledBy="case-history" />
      </div>
    </section>
  );
}
