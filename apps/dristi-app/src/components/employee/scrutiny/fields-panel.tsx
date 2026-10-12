"use client";

import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { sectionFlagCount } from "@/lib/employee/scrutiny/field";
import { GROUP_ICONS } from "@/lib/employee/scrutiny/icons";
import type { SectionDef } from "@/lib/employee/scrutiny/types";
import type { ScrutinyController } from "@/lib/employee/scrutiny/use-scrutiny-state";
import { cn } from "@/lib/utils";
import { FieldRow } from "@/components/employee/scrutiny/field-row";
import { useScrutinyCase } from "@/components/employee/scrutiny/scrutiny-case-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";

/**
 * The group card's recipe, shared with Register cases and Take cognizance
 * (`register-case-screen.tsx`, `cognizance-case-screen.tsx`): a hairline-edged, raised
 * sheet with no padding of its own, so a header band and the rows below it each set their
 * own — divided by one hairline, the same stroke the case file uses.
 */
const SHEET = "gap-0 overflow-hidden border-hairline py-0 shadow-raised";

/**
 * A rail row, as the filing's own rail draws it (`components/filing/sections-rail.tsx`):
 * a 40px ghost `Button`, the current step in the rail's brand tint. `min-h-10` and a
 * wrapping label rather than `h-10` and `truncate`, so 200% text zoom grows the row
 * instead of clipping "Jurisdiction & limitation" (`ACCESSIBILITY.md` §10).
 */
const ROW =
  "h-auto min-h-10 w-full justify-start gap-2 whitespace-normal px-2 py-2 text-left font-normal";
const ROW_ACTIVE =
  "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

/** Sections under their rail headings, in order. */
function railGroups(sections: SectionDef[]): { group: string; sections: SectionDef[] }[] {
  const out: { group: string; sections: SectionDef[] }[] = [];
  for (const section of sections) {
    const g = out.find((x) => x.group === section.group);
    if (g) g.sections.push(section);
    else out.push({ group: section.group, sections: [section] });
  }
  return out;
}

export interface FieldsPanelHandle {
  scrollToRow: (fieldId: string) => void;
}

/**
 * Filed information, one filing step at a time.
 *
 * The steps are listed down a rail on the left, grouped and drawn the way the filing
 * screen's own rail is, so the officer reads the filing in the shape the advocate filled
 * it in. One step shows at a time: a §138 filing runs to a hundred fields, and one
 * continuous scroll through all of them was the complaint (owner, 2026-10-12). The rail
 * carries the count of items raised on each step — the officer's own work, findable
 * without scrolling.
 *
 * Where the pane is too narrow for a rail beside the fields, the rail becomes a select
 * at the head of the pane: the same list, the same order, one control.
 */
export function FieldsPanel({
  controller,
  aiOn,
  onGoToItem,
  ref,
}: {
  controller: ScrutinyController;
  aiOn: boolean;
  /** Selects a row and scrolls to it — how a linked pair reads in both directions. */
  onGoToItem: (fieldId: string) => void;
  ref?: React.Ref<FieldsPanelHandle>;
}) {
  const { sections, fieldById } = useScrutinyCase();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = React.useState(sections[0].id);
  /** A row to bring into view once its step has rendered. */
  const [pendingRow, setPendingRow] = React.useState<string | null>(null);

  const index = Math.max(
    0,
    sections.findIndex((s) => s.id === activeId),
  );
  const active = sections[index];
  const prev = sections[index - 1];
  const next = sections[index + 1];

  const open = React.useCallback((id: string) => {
    setActiveId(id);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToRow: (fieldId: string) => {
        const sectionId = fieldById[fieldId]?.sectionId;
        if (sectionId) setActiveId(sectionId);
        setPendingRow(fieldId);
      },
    }),
    [fieldById],
  );

  React.useEffect(() => {
    if (!pendingRow) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`row-${pendingRow}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingRow(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingRow, activeId]);

  const groups = railGroups(sections);

  return (
    <section
      /* `h-full`, like the bundle beside it: the pane is what bounds the height, and the
         scroller below only scrolls once something above it says how tall it may be. */
      className="@container flex h-full min-h-0 bg-surface-sunken"
      aria-label="Filed information"
    >
      {/* The rail. Card fill and a hairline seam, like every other chrome surface on this
          screen; hidden below the room for it, where the select in the header takes over. */}
      <nav
        aria-label="Filing sections"
        className="hidden w-52 shrink-0 flex-col gap-4 overflow-y-auto border-e border-hairline bg-card px-2 py-4 @[36rem]:flex"
      >
        {groups.map((g) => (
          <div key={g.group} className="flex w-full flex-col gap-1">
            <h2 className="px-2 text-caption font-medium text-muted-foreground">{g.group}</h2>
            <ul className="flex flex-col gap-1">
              {g.sections.map((section) => {
                const current = section.id === active.id;
                const Icon = GROUP_ICONS[section.icon];
                const count = sectionFlagCount(section, controller.flags);
                return (
                  <li key={section.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => open(section.id)}
                      aria-current={current ? "page" : undefined}
                      className={cn(ROW, current && ROW_ACTIVE)}
                    >
                      <Icon
                        aria-hidden
                        className={current ? undefined : "text-muted-foreground"}
                      />
                      <span className="min-w-0 flex-1 break-words">{section.title}</span>
                      {/* A plain muted count, as the correction rail does: the number maps
                          where the work is; red is kept for the tally in the decision bar. */}
                      {count > 0 ? (
                        <span className="text-caption font-medium tabular-nums text-muted-foreground">
                          {count}
                          <span className="sr-only">{count === 1 ? " flag" : " flags"}</span>
                        </span>
                      ) : null}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Chrome: white, hairline seam — the same `h-14` bar the bundle carries, so the
            two pane headers line up across the workbench. */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline bg-card px-4">
          <h2 className="hidden min-w-0 flex-1 truncate text-body-compact font-semibold @[36rem]:block">
            {active.title}
          </h2>
          <NativeSelect
            aria-label="Filing section"
            className="@[36rem]:hidden"
            value={active.id}
            onChange={(event) => open(event.target.value)}
          >
            {groups.map((g) => (
              <NativeSelectOptGroup key={g.group} label={g.group}>
                {g.sections.map((section) => {
                  const count = sectionFlagCount(section, controller.flags);
                  return (
                    <NativeSelectOption key={section.id} value={section.id}>
                      {section.title}
                      {count ? ` (${count} flagged)` : ""}
                    </NativeSelectOption>
                  );
                })}
              </NativeSelectOptGroup>
            ))}
          </NativeSelect>
          <span className="ms-auto shrink-0 text-caption text-muted-foreground tabular-nums">
            {index + 1} of {sections.length}
          </span>
        </div>

        <div
          className="relative flex-1 overflow-y-auto p-4"
          ref={scrollRef}
          id={`sec-${active.id}`}
        >
          <div className="flex flex-col gap-4">
            {active.groups.map((group) => {
              const Icon = GROUP_ICONS[group.icon];
              return (
                /* The case-file card treatment (owner, 2026-09-15): a lifted, hairline
                   sheet whose header band is divided from its rows by one hairline, the
                   same stroke Register cases and Take cognizance use. */
                <Card key={group.id} className={cn(SHEET, "w-full @container")}>
                  {/* The register case-file header (`register-case-file.tsx`): a sunken
                      band with the title at 14 — the panes are narrow, so the header
                      takes body-compact, not body (owner, 2026-09-15). */}
                  <div className="flex items-center justify-between gap-4 bg-surface-sunken px-4 py-3">
                    <h3 className="min-w-0 truncate text-body-compact font-semibold">
                      {group.title}
                    </h3>
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-card text-muted-foreground">
                      <Icon className="size-5" />
                    </span>
                  </div>
                  <DescriptionList
                    role="listbox"
                    aria-label={group.title}
                    className="border-t border-hairline px-4 py-1"
                  >
                    {/*
                     * The flattened field (`fieldById`) rather than re-flattening inline:
                     * the object identity has to be stable across renders.
                     */}
                    {group.fields.map((field) => (
                      <FieldRow
                        key={field.id}
                        field={fieldById[field.id]}
                        controller={controller}
                        aiOn={aiOn}
                        onGoToItem={onGoToItem}
                      />
                    ))}
                  </DescriptionList>
                </Card>
              );
            })}

            {/* Walk on without going back to the rail — the filing is read in order. */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {prev ? (
                <Button variant="outline" onClick={() => open(prev.id)}>
                  <ArrowLeftIcon />
                  {prev.title}
                </Button>
              ) : null}
              {next ? (
                <Button variant="outline" className="ms-auto" onClick={() => open(next.id)}>
                  {next.title}
                  <ArrowRightIcon />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
