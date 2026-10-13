"use client";

import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { NewDateFilter } from "@/components/employee/new-date-filter";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  formatListingDate,
} from "@/lib/employee/hearings";
import { type ReschedulableHearing } from "@/lib/employee/bulk-reschedule";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The matters in range, and which of them the bench has picked.
 *
 * **One table, two jobs, told apart by one prop.** The screen shows it twice, once per
 * tab (owner, 2026-09-15), and `selection` is what says which:
 *
 * - **Present — the Unscheduled board.** A checkbox column, and picked rows carry the
 *   design system's own selection band (`tableRowClass({ selectable })`) so a run of them
 *   paints as one block. The date column is *Hearing date*: where the matter stands.
 * - **Absent — the Scheduled record.** Nothing to pick, so no column for picking. The
 *   date column is *Previous hearing date*: where the matter came from, with
 *   *New hearing date* beside it for where it went. That second column is the record's
 *   subject, so it carries the weight and the first one is muted: the row reads left to
 *   right as the move it is.
 *
 * **The record is one table again** (owner, 2026-09-16). It was a stack of them, one per
 * day, under a date heading with its own tally — which made the day the thing to group by
 * and left a New hearing date column repeating its own heading on every row. One table
 * needs that column back, and the several days it may hold are answered by a filter in
 * its header rather than by cutting the table up (`newDate.days`, and see
 * `NewDateFilter`).
 *
 * The row itself stays inert either way — the checkbox is the control, and a hover fill
 * would promise a click the row does not answer.
 *
 * The panel shell (border, fill, shadow) lives on the screen around this, so the table is
 * one panel rather than a box inside a box.
 */
export function BulkRescheduleTable({
  rows,
  selection,
  newDate,
  caption,
}: {
  rows: ReschedulableHearing[];
  /** Omitted where the table is a record of what was done rather than a board to work. */
  selection?: {
    selected: ReadonlySet<string>;
    onToggle: (id: string, next: boolean) => void;
    onToggleAll: (next: boolean) => void;
  };
  /**
   * Where the matters went — the record's column, and the one it can be narrowed by.
   *
   * Omitted on the board, where nothing has moved yet and a column of blanks over
   * twenty matters is a column that says nothing.
   */
  newDate?: {
    /** Every day this session moved matters to, with its tally. */
    days: { day: string; count: number }[];
    /** The day on screen, or `null` for all of them. */
    value: string | null;
    onChange: (day: string | null) => void;
  };
  /**
   * What this table is, for a reader that cannot see the heading above it.
   *
   * The record is several tables under several date headings, and a screen reader moving
   * by table hears only "table" for each. Sighted readers get the heading; this is the
   * same sentence, in the place the table itself carries it.
   */
  caption?: string;
}) {
  const courtText = useCourtText();
  const selectedHere = selection
    ? rows.filter((row) => selection.selected.has(row.id)).length
    : 0;
  const allChecked = selectedHere === rows.length;

  /* Four facts, one date, and then whatever the variant adds: a checkbox column on the
     board, a second date column on the record. */
  const columns = 5 + (selection ? 1 : 0) + (newDate ? 1 : 0);

  /* **The record's two date columns cost it 36px it did not have** (measured at 1280:
     946px of table in a 910px panel), and what overflowed was the far right — where the
     filter's chevron lives, so the one new affordance was the one thing off the edge.
     Two nowrap date headers are ~157px each and mostly header rather than date, so the
     width comes back out of the two columns that were reserving more than they need: a
     receipt's cause title is read, not scanned for picking, and its hearing type is a
     caption more than a column. The board keeps both at full width — it is the surface
     the bench works, and there the title carries the selection. */
  const title = newDate ? "min-w-48" : "min-w-64";
  const purpose = newDate ? "min-w-32" : "min-w-40";

  return (
    <Table className="w-full border-separate border-spacing-0 text-body-compact">
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          {selection ? (
            <TableHead className={cn(TABLE_HEAD, "w-12")}>
              <Checkbox
                checked={
                  allChecked ? true : selectedHere > 0 ? "indeterminate" : false
                }
                onCheckedChange={(next) => selection.onToggleAll(next === true)}
                aria-label={
                  allChecked
                    ? "Clear the selection"
                    : "Select every matter in this range"
                }
              />
            </TableHead>
          ) : null}
          <TableHead className={cn(TABLE_HEAD, title, "whitespace-normal")}>
            Case title
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Case number
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            Stage
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, purpose, "whitespace-normal")}>
            Hearing type
          </TableHead>
          <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>
            {selection ? "Hearing date" : "Previous hearing date"}
          </TableHead>
          {newDate ? (
            /* **`py-1`, and the arithmetic is the whole of it.** `TABLE_HEAD` is a 40px
               strip with 12px of vertical padding, which leaves 16px for text — fine for
               text, impossible for a control. At `py-0` the 36px button had 2px of air
               and read as jammed in (owner, 2026-09-16). 4px either side of a 32px
               control is the pair that fits: 4 + 32 + 4 is exactly the 40px strip every
               other court-side table draws, so this one does not grow to hold it.
               The label is still plain text when there is only one date to show;
               `NewDateFilter` renders no control then. */
            <TableHead className={cn(TABLE_HEAD, "py-1 whitespace-nowrap")}>
              <NewDateFilter
                days={newDate.days}
                value={newDate.value}
                onChange={newDate.onChange}
              />
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody
        className={tableBodyClass({ hover: false, selectable: Boolean(selection) })}
      >
        {/* The header is a well, not a band welded to the rows — it needs the panel's
            fill under it or its rounded bottom corners read as cut off (ui-craft §4).
            `border-separate` has no per-edge row gap, so the gap is one inert row held
            out of the accessibility tree. */}
        <tr aria-hidden="true">
          <td colSpan={columns} className="h-2 p-0" />
        </tr>
        {rows.map((row) => {
          const isSelected = selection?.selected.has(row.id) ?? false;

          return (
            <TableRow
              key={row.id}
              data-state={isSelected ? "selected" : undefined}
              /* The whole row picks the matter, so the row lights under the pointer —
                 the plate withholds hover from a row that does nothing, and this one
                 does. The same handling the pending-tasks table uses: a click that
                 landed on a control inside the row belongs to that control. Picking
                 twenty-three matters through a 16px box each is the act this screen
                 exists for, and it should not need aim. */
              className={cn(
                tableRowClass({ selectable: Boolean(selection) }),
                selection && "cursor-pointer"
              )}
              onClick={
                selection
                  ? (event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("button, a, [role=checkbox], label")) return;
                      selection.onToggle(row.id, !isSelected);
                    }
                  : undefined
              }
            >
              {selection ? (
                <TableCell className={cn(TABLE_CELL, "w-12")}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(next) =>
                      selection.onToggle(row.id, next === true)
                    }
                    aria-label={`Select ${row.title}, ${courtText(row.caseNumber)}`}
                  />
                </TableCell>
              ) : null}
              {/* The row's one emphasised cell. Not a link: there is no court-side case
                  file yet, and the citizen side's is not the bench's to point at. */}
              <TableCell
                className={cn(TABLE_CELL, title, "font-medium whitespace-normal")}
              >
                {row.title}
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                <Identifier value={row.caseNumber} label="case number" />
              </TableCell>
              <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                {courtCaseStageLabel(row.stage)}
              </TableCell>
              <TableCell className={cn(TABLE_CELL, purpose, "whitespace-normal")}>
                {courtHearingPurposeLabel(row.purpose)}
              </TableCell>
              {/* Where the matter is, or where it was — the heading says which, and on
                  the record the day it went to is that heading. Muted either way: it is
                  the settled fact in the row, not the one being decided. */}
              <TableCell
                className={cn(
                  TABLE_CELL,
                  "tabular-nums whitespace-nowrap text-muted-foreground",
                )}
              >
                {formatListingDate(row.date)}
              </TableCell>
              {/* Where it went — the fact the record exists to state, so it is the one
                  emphasised date in the row. Every moved row has one; the dash is a floor
                  under the data rather than a case this table is shown in. */}
              {newDate ? (
                <TableCell
                  className={cn(
                    TABLE_CELL,
                    "font-medium tabular-nums whitespace-nowrap",
                  )}
                >
                  {row.newDate ? formatListingDate(row.newDate) : "—"}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
