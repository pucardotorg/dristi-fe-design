"use client";

import * as React from "react";
import type { CSSProperties } from "react";

import { CheckGroup } from "@/components/cases/cases-filters";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { advHome, fillCopy } from "@/lib/advocate/content";
import type { PeopleOption, PeopleScope } from "@/lib/advocate/home";
import { pick, type Locale } from "@/lib/onboarding/content";
import type { PersonId } from "@/lib/tasks/types";

type Kind = "mine" | "office";
type Draft = { kinds: Kind[]; hidden: PersonId[] };

const kindsOf = (scope: PeopleScope): Kind[] =>
  scope === "all" ? ["mine", "office"] : [scope];
const scopeOf = (kinds: readonly Kind[]): PeopleScope =>
  kinds.length === 2 ? "all" : kinds[0] ?? "all";

/**
 * Advanced filters for one sitting, in the same right-hand sheet the Cases list
 * uses: which kinds of access, and which colleagues' hearings, with a find box
 * when the list of names runs long. Edits are a draft until "Show hearings".
 * The viewer is always included: their own hearings never drop out.
 */
export function HearingFiltersSheet({
  open,
  onOpenChange,
  sittingLabel,
  scope,
  hidden,
  peopleFor,
  onApply,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sitting these filters belong to, e.g. "10:00 am – 3:00 pm". */
  sittingLabel: string;
  scope: PeopleScope;
  hidden: readonly PersonId[];
  /** Everyone on the sitting's Vakalatnamas under a scope, the viewer flagged `me`. */
  peopleFor: (scope: PeopleScope) => PeopleOption[];
  onApply: (next: { scope: PeopleScope; hidden: PersonId[] }) => void;
  locale: Locale;
}) {
  const [draft, setDraft] = React.useState<Draft>({ kinds: kindsOf(scope), hidden: [...hidden] });
  // Re-seed from what is applied each time the sheet opens, as the Cases sheet does.
  const [seededFor, setSeededFor] = React.useState(open);
  if (open !== seededFor) {
    setSeededFor(open);
    if (open) setDraft({ kinds: kindsOf(scope), hidden: [...hidden] });
  }

  const isMobile = useIsMobile();
  const people = peopleFor(scopeOf(draft.kinds));
  const me = people.find((o) => o.me);
  const others = people.filter((o) => !o.me);
  const [needle, setNeedle] = React.useState("");
  const listed = needle.trim()
    ? others.filter((o) => o.person.name.toLowerCase().includes(needle.trim().toLowerCase()))
    : others;
  const custom = draft.kinds.length < 2 || draft.hidden.length > 0;

  const body = (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
            <CheckGroup<Kind>
              id="hearing-filter-access"
              legend={pick(advHome.filtersAccess, locale)}
              options={[
                { value: "mine", label: pick(advHome.accessMine, locale) },
                { value: "office", label: pick(advHome.accessOfficeOnly, locale) },
              ]}
              value={draft.kinds}
              // At least one kind stays ticked: nothing ticked would show nothing.
              onChange={(kinds) => kinds.length && setDraft((d) => ({ ...d, kinds }))}
            />
  
            {/* One list: the viewer first, ticked and locked (their hearings always
                show), then every colleague, ticked unless left out. */}
            <div role="group" aria-labelledby="hearing-filter-people" className="flex flex-col gap-1">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p id="hearing-filter-people" className="text-body-compact text-muted-foreground">
                  {pick(advHome.filtersPeopleHeading, locale)}
                </p>
                {others.length > 6 ? (
                  <InputGroup className="h-9 w-40">
                    <InputGroupAddon>
                      <SearchIcon aria-hidden />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="search"
                      value={needle}
                      onChange={(event) => setNeedle(event.target.value)}
                      placeholder={pick(advHome.findName, locale)}
                      aria-label={pick(advHome.findName, locale)}
                      autoComplete="off"
                      className="h-full text-body-compact"
                    />
                  </InputGroup>
                ) : null}
              </div>
              {me && !needle.trim() ? (
                <Label className="flex min-h-10 cursor-default items-center gap-3 rounded-md px-2 text-body-compact font-normal">
                  <Checkbox checked disabled />
                  <span className="min-w-0 flex-1">
                    {pick(advHome.peopleMe, locale)}
                    <span className="text-muted-foreground"> · {pick(advHome.peopleMeAlwaysShort, locale)}</span>
                  </span>
                  <span className="text-body-compact text-muted-foreground tabular-nums">{me.count}</span>
                </Label>
              ) : null}
              {listed.map((o) => (
                <Label
                  key={o.person.id}
                  htmlFor={`hearing-filter-${o.person.id}`}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-body-compact font-normal hover:bg-accent"
                >
                  <Checkbox
                    id={`hearing-filter-${o.person.id}`}
                    checked={!draft.hidden.includes(o.person.id)}
                    onCheckedChange={(checked) =>
                      setDraft((d) => ({
                        ...d,
                        hidden: checked === true ? d.hidden.filter((id) => id !== o.person.id) : [...d.hidden, o.person.id],
                      }))
                    }
                  />
                  <span className="min-w-0 flex-1">{o.person.name}</span>
                  <span className="text-body-compact text-muted-foreground tabular-nums">{o.count}</span>
                </Label>
              ))}
              {needle.trim() && listed.length === 0 ? (
                <p className="px-2 py-2 text-body-compact text-muted-foreground">{pick(advHome.noNames, locale)}</p>
              ) : null}
              {others.length > 1 ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto w-fit px-2 py-1"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      hidden: d.hidden.length ? [] : others.map((o) => o.person.id),
                    }))
                  }
                >
                  {pick(draft.hidden.length ? advHome.peopleSelectAll : advHome.peopleClearAll, locale)}
                </Button>
              ) : null}
            </div>
          </div>
  
  );
  const actions = (
    <>
          {custom ? (
            <Button variant="ghost" onClick={() => setDraft({ kinds: ["mine", "office"], hidden: [] })}>
              {pick(advHome.filtersReset, locale)}
            </Button>
          ) : (
            <span />
          )}
          <Button
            onClick={() => {
              onApply({ scope: scopeOf(draft.kinds), hidden: draft.hidden });
              onOpenChange(false);
            }}
          >
            {pick(advHome.filtersApply, locale)}
          </Button>
    </>
  );
  const title = pick(advHome.filtersTitle, locale);
  const subtitle = fillCopy(advHome.filtersFor, locale, { sitting: sittingLabel });

  // A phone gets the Home screen's bottom drawer; wider screens the Cases sheet.
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-title-s font-semibold">{title}</DrawerTitle>
            <DrawerDescription>{subtitle}</DrawerDescription>
          </DrawerHeader>
          {body}
          <DrawerFooter className="flex-row items-center justify-between border-t border-hairline">{actions}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The Cases sheet's motion: a full slide from the right, no dissolve. */}
      <SheetContent
        side="right"
        className="w-full duration-300 ease-out sm:max-w-sm"
        style={
          {
            "--tw-enter-opacity": "1",
            "--tw-exit-opacity": "1",
            "--tw-enter-translate-x": "100%",
            "--tw-exit-translate-x": "100%",
          } as CSSProperties
        }
      >
        <SheetHeader>
          <SheetTitle className="text-title-s font-semibold">{title}</SheetTitle>
          <SheetDescription>{subtitle}</SheetDescription>
        </SheetHeader>
        {body}
        <SheetFooter className="flex-row items-center justify-between border-t border-hairline">{actions}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
