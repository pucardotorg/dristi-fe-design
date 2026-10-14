"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CHROME_FOLD_TRIGGER,
  ChromeTopBar,
  focusChromeFoldTrigger,
  useFoldFocusHandoff,
  useRailCollapsed,
} from "@/components/chrome/app-chrome";
import {
  isOrderScreenPath,
  OrderVariantSwitch,
} from "@/components/employee/order-variant-switch";
import { courtTrail, type CourtCrumb } from "@/lib/employee/navigation";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useOrderFlow } from "@/components/employee/use-order-flow";

/**
 * The court's bar: where you are, and the way back into the rail.
 *
 * Two things, and deliberately only two. The advocate's bar also carries a language
 * switch, a notifications bell and a profile menu; none of the three belongs to the
 * bench. The bell would be a thirteenth live count on a screen whose rail already carries
 * twelve. The switch reads a locale provider that is the citizen shell's and does not
 * exist under `/employee` — what language a Kerala bench works in is a real product
 * question and not one this bar can answer by reaching across the area split. And the
 * person is already named, in full, at the foot of the rail.
 *
 * It runs at every width now, which costs each court screen the bar's height. What it
 * buys back is a rule: the rail's brand row is the bar's own height, so the seam under
 * one and the seam under the other are a single line straight across the viewport, in
 * both rail widths. Before this the rail's header seam ran out into nothing.
 */
export function EmployeeTopBar() {
  const pathname = usePathname();
  const [flow] = useOrderFlow();
  const crumbs = courtTrail(pathname, flow);
  // Derived here rather than inside the trail because the divider beside the trigger has
  // to know whether anything follows it. On the court home nothing does.
  return (
    <ChromeTopBar
      leading={<CourtNavTrigger hasTrail={crumbs.length > 0} />}
      /* On an order screen, the switch between its variants, at the bar's right end
         (owner, 2026-10-13). */
      trailing={
        isOrderScreenPath(pathname) ? (
          <OrderVariantSwitch className="text-muted-foreground" />
        ) : undefined
      }
    >
      {crumbs.length > 0 ? <CourtTrail crumbs={crumbs} /> : null}
    </ChromeTopBar>
  );
}

/**
 * A crumb link, plus the focus treatment the primitive does not ship.
 *
 * `BreadcrumbLink` carries `transition-colors hover:text-foreground` and nothing for
 * focus, so the only indicator a keyboard user gets is whatever the browser draws,
 * recoloured by the blanket `* { outline-color: … }` in `globals.css` — a colour with no
 * style and no width behind it, and at 50% over the bar's fill it does not reach the 3:1
 * that a focus indicator owes. Every other interactive primitive in the system pairs a
 * full-opacity edge with the translucent halo; this one has neither.
 *
 * That is a gap in the primitive, so the repair is *composed on* rather than edited in —
 * a synced file loses local changes at the next sync and fails the sync gate in between.
 * The recipe is the DS's own for a control with no border of its own to tint: the halo
 * from `Badge`, the full-opacity outline from `TabsTrigger`. `focus-ring` is the named
 * token for the halo, so it is used by name instead of an alpha modifier on `ring`.
 * `rounded-sm` only gives the ring a corner to follow; nothing shows at rest.
 *
 * Filed as request 16 in `docs/design/ds-requests.md` — it wants fixing once, upstream,
 * not at every call site that ever renders a crumb.
 */
const CRUMB_LINK = [
  "truncate rounded-sm",
  "focus-visible:ring-3 focus-visible:ring-focus-ring",
  "focus-visible:outline-1 focus-visible:outline-ring",
].join(" ");

/**
 * Shown exactly when the rail is not carrying a fold control of its own.
 *
 * Two clauses, both in CSS. Below `md` the rail has left the layout, so `md:hidden` shows
 * this at every phone width. At `md` and up it comes back only while the rail is folded to
 * a strip, which the page column publishes as a data attribute for this to read
 * (`ChromePageColumn`); the higher-specificity selector is what lets the second clause
 * overturn the first inside the same media query.
 *
 * The rule is CSS and not `useSidebar().isMobile`, even though the rail header gates its
 * own trigger on exactly that. `isMobile` is `false` until an effect has run, so a JS gate
 * here would ship a phone server HTML with no way into the navigation at all and only
 * repair it at hydration — which is what the advocate's bar does today. A media query is
 * right at first paint. Keeping the folded clause on the same mechanism is the point: two
 * gates in two languages is how a state ends up with two controls, or none.
 */
const TRIGGER_VISIBILITY =
  "md:hidden md:group-data-[rail-folded=true]/chrome-page:inline-flex";
const DIVIDER_VISIBILITY =
  "md:hidden md:group-data-[rail-folded=true]/chrome-page:block";

/**
 * The way back into the rail, whenever the rail cannot offer one itself.
 *
 * There must never be two of these on screen, and never none. Four states, one rule:
 *
 * - **Desktop, rail open** — the rail's own header holds the fold control. This hides.
 * - **Desktop, rail folded** — the rail's header gives its control up so the brand mark
 *   can keep the page origin, and this takes over. Shown. It is the advocate's behaviour,
 *   adopted: the composition below is already what that bar does, for the same reason.
 * - **Phone, rail off-canvas** — the rail is not in the layout at all, so this is the
 *   only door to it. Shown.
 * - **Phone, sheet open** — the sheet appends its own close control and Radix hides the
 *   rest of the page from assistive tech behind the scrim, so this one is neither
 *   reachable nor announced while it is up.
 *
 * **One element, not two.** A second element is a second way for the count to come out
 * wrong, and `md` partitions widths rather than states, so the two would have to agree
 * about the fold as well as the breakpoint. `SidebarTrigger` needs no help routing itself:
 * it opens the sheet below `md` and unfolds the rail above it.
 *
 * **The words are the one thing that does branch in JS**, because the two states are not
 * doing the same thing to a listener. On a phone the rail is not on screen at all, so this
 * opens it. Folded, the rail *is* on screen — seven named buttons in a strip — and a
 * listener is told nothing is open; "expand" is what actually happens to it. That read is
 * safe where a visibility gate would not be: `useRailCollapsed` is `false` on the server
 * and on the client's first render alike (the rail always starts open — the DS writes its
 * cookie and never reads it, and `useIsMobile` reports `false` from its server snapshot),
 * so there is nothing here for hydration to disagree about. It is also only a name. What
 * is on screen stays entirely in CSS.
 */
function CourtNavTrigger({ hasTrail }: { hasTrail: boolean }) {
  const collapsed = useRailCollapsed();
  /* Activating this on a desktop hides it, because unfolding hands the control back to the
     rail's header — so the keyboard has to go with it. */
  const handoff = useFoldFocusHandoff(collapsed, focusChromeFoldTrigger);
  return (
    <>
      <SidebarTrigger
        {...CHROME_FOLD_TRIGGER}
        {...handoff}
        aria-label={
          collapsed ? "Expand court navigation" : "Open court navigation"
        }
        /* The guarded selector, not the plain `[&_svg]:size-5`: `Button` declares its own
           `[&_svg:not([class*='size-'])]:size-4`, which tailwind-merge treats as a
           different key and leaves in place — and it then out-specifies the plain form
           and holds the panel icon at 16px inside a 40px square. Matching the key is what
           makes the override an override. Full reasoning at `RAIL_ICON_BUTTON`.

           `size-10` is the rail trigger's size too, so the control does not change size as
           it moves between them. */
        className={`size-10 shrink-0 text-muted-foreground [&_svg:not([class*='size-'])]:size-5 ${TRIGGER_VISIBILITY}`}
      />
      {/* The trigger belongs to the rail and the trail belongs to the page, and with
          nothing between them the button reads as the trail's first step. A hairline is
          the least that separates them, and it carries the same visibility rule so the two
          arrive and leave together. On the court home there is no trail to be mistaken for,
          and a rule with nothing after it reads as a mistake — so it goes with what it
          divides. */}
      {hasTrail ? (
        <Separator
          orientation="vertical"
          className={`h-5! shrink-0 self-center! bg-hairline ${DIVIDER_VISIBILITY}`}
        />
      ) : null}
    </>
  );
}

/**
 * The steps above this page, and then this page. `courtTrail` decides what they are; this
 * decides how they survive a narrow bar.
 *
 * **The last step is where you are, so it goes to full ink** — the ordinary trail
 * convention, restored on 2026-09-11 when the trail started carrying the current page
 * (owner). It is the DS `BreadcrumbPage` slot rather than a recoloured span: the
 * primitive is what sets `aria-current="page"` and `aria-disabled`, so a screen reader is
 * told which step is the page and told that it is not a link — neither of which a colour
 * can say. The steps above it stay muted, which is now a real distinction rather than a
 * flat row.
 *
 * **The root is pinned and the rest shrink.** Left to itself flex takes width off every
 * child in proportion, which on the thirteen queue screens means the trail gives up its
 * link — `Court home`, the only route home the court's chrome offers anywhere — to keep a
 * section name legible, and a section is a disclosure in the rail with nowhere to go. The
 * longer the label, the worse the trade, so a translated section name makes it worse
 * rather than better. Pinning the root inverts that: the tail clips first. Clipping costs
 * nothing that matters, because `truncate` shortens a label and never un-links it — on
 * the composer, where the last step is a real link back to the day's list, the target
 * survives the ellipsis.
 *
 * The chevrons are pinned for a different reason: a squashed separator would be worse
 * than a clipped word.
 *
 * Below `md` the middle steps leave outright — but "middle" is not simply "not an end"
 * any more. Now that the trail ends where the reader is, dropping everything but the two
 * ends would take the *way back* off every nested page: a phone would show `Court home`
 * and `CMP/1840/2025`, and the queue the complaint is waiting in — the only route back to
 * it, and the reason the file itself carries no back control — would be the thing that
 * left. So a phone keeps three: the root, the last step that is a link, and the page. On
 * a queue screen there is no such link and it keeps two, which is what it had before.
 */
/**
 * The identifier face, for a step that names a record by its number. No copy affordance:
 * the crumb is already a link, and a control cannot hold another one.
 */
const crumbFace = (crumb: CourtCrumb) =>
  crumb.mono ? "font-mono tabular-nums" : undefined;

function CourtTrail({ crumbs }: { crumbs: CourtCrumb[] }) {
  const last = crumbs.length - 1;

  return (
    <Breadcrumb className="min-w-0 flex-1">
      {/* `flex-nowrap` over the primitive's wrap: this row is a fixed-height bar, and a
          trail that wrapped to a second line would push the seam off the rail's. */}
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, index) => {
          const isRoot = index === 0;
          const isLast = index === last;
          // The step directly above the page, when it goes somewhere: the way back.
          const wayBack = index === last - 1 && crumb.href !== undefined;
          const dropped = !isRoot && !isLast && !wayBack;
          return (
            <React.Fragment key={crumb.label}>
              {index > 0 ? (
                <BreadcrumbSeparator
                  className={
                    dropped ? "hidden shrink-0 md:inline-flex" : "shrink-0"
                  }
                />
              ) : null}
              <BreadcrumbItem
                className={
                  dropped
                    ? "hidden min-w-0 md:inline-flex"
                    : isRoot && !isLast
                      ? "shrink-0"
                      : // Alone in the trail the root has nothing to shed against, so it
                        // truncates like any other step rather than running off the bar.
                        "min-w-0"
                }
              >
                {crumb.href ? (
                  <BreadcrumbLink asChild className={CRUMB_LINK}>
                    <Link href={crumb.href} className={crumbFace(crumb)}>
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : isLast ? (
                  /* Where the reader is. On a queue that is the queue's name; on a
                     complaint's file, a listing or a scrutiny workbench it is the
                     record's number, which is the one thing the page's own heading does
                     not already say. */
                  <BreadcrumbPage
                    className={cn("truncate", crumbFace(crumb))}
                  >
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  /* A section with no href is still a disclosure in the rail, not a
                     route — there is no page called "Sign". Nested routes give the
                     section the queue's href in `courtTrail`, so the same label is a
                     link there. It is not dressed as a link it cannot be. */
                  <span className={cn("truncate", crumbFace(crumb))}>
                    {crumb.label}
                  </span>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
