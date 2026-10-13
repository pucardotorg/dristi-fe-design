"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
  ItemGroup,
} from "@/components/ui/item";
import { CourtActionRow } from "@/components/employee/todays-actions-screen";
import { formatCourtDay, isoDay } from "@/lib/employee/hearings";
import { courtNavClubbed, courtNavClubbedTotal } from "@/lib/employee/navigation";
import { useCourt } from "@/components/court/court-provider";
import { useCourtRole } from "@/components/employee/use-court-role";

const NEVER_CHANGES = () => () => {};
const readToday = () => isoDay(new Date());

/**
 * Today's schedule — the "schedule" combined layout's one row, opened.
 *
 * Unlike "actions" (`TodaysActionsScreen`), this layout keeps hearings no tab of their
 * own — `courtNavClubbed("schedule")` folds Today's hearings in with everything else,
 * because a sitting is conducted, not worked off a list: hearings stand in their own
 * block ahead of everything else rather than a row of their own in the rail, or a row
 * among the rest of the day's paperwork here. Everything below that block is the same
 * plain queue index `CourtActionRow` gives the "actions" layout's whole day — this
 * screen just carves the hearings out of it first.
 */
export function TodaysScheduleScreen() {
  const today = React.useSyncExternalStore(NEVER_CHANGES, readToday, readToday);
  const { court } = useCourt();
  const seat = useCourtRole();
  const items = courtNavClubbed("schedule", court, seat);
  const hearings = items.find((item) => item.id === "todays-hearings");
  const rest = items.filter((item) => item.id !== "todays-hearings");
  const total = courtNavClubbedTotal("schedule", court, seat);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-balance font-semibold">
          Today’s schedule
        </h1>
        <p className="text-body text-muted-foreground tabular-nums">
          Today, {formatCourtDay(today)} ·{" "}
          {total === 1 ? "1 waiting" : `${total} waiting`}
        </p>
      </header>

      {hearings?.href ? (
        <section
          aria-label="Today's hearings"
          className="flex min-w-0 flex-col gap-4 rounded-xl border border-hairline bg-card shadow-raised p-6"
        >
          <Item asChild variant="outline" className="px-6 py-4">
            <Link href={hearings.href}>
              <ItemContent>
                <span className="text-caption font-medium text-muted-foreground">
                  Conducting today
                </span>
                <ItemTitle className="text-title-s font-semibold">
                  {hearings.label}
                </ItemTitle>
              </ItemContent>
              <ItemActions className="gap-3">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-title-l font-semibold tabular-nums">
                    {hearings.count ?? 0}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    listed
                  </span>
                </span>
                <ChevronRightIcon
                  aria-hidden
                  className="size-5 text-muted-foreground"
                />
              </ItemActions>
            </Link>
          </Item>
        </section>
      ) : null}

      <section
        aria-label="The rest of today's work"
        className="flex min-w-0 flex-col gap-4 rounded-xl border border-hairline bg-card shadow-raised p-6"
      >
        <h2 className="text-body-compact font-medium text-muted-foreground">
          Other work today
        </h2>
        <ItemGroup className="gap-3">
          {rest
            .filter((item) => item.href)
            .map((item) => (
              <CourtActionRow key={item.id} item={item} />
            ))}
        </ItemGroup>
      </section>
    </div>
  );
}
