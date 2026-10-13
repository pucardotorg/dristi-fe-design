"use client";

import { useId, useMemo } from "react";
import { ArrowRightIcon, SearchIcon, XIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import { PANEL_CLASS } from "@/components/shell/panel";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import {
  APPLICATION_TYPE_MATCH_FLOOR,
  searchApplicationTypes,
  type ApplicationTypeGuide,
} from "@/lib/cases/application-type-guide";
import { Separator } from "@/components/ui/separator";
import { type ApplicationTypeId } from "@/lib/cases/applications";
import { cn } from "@/lib/utils";

/**
 * Step one of Raise application: pick what you are asking the court for.
 *
 * The types are cards, not a list of names, because the name alone is not the
 * choice — "Condonation of delay" tells a first-time filer nothing, and picking
 * wrong costs them a whole form. Each card says what that type asks for;
 * choosing one is what advances.
 *
 * Two things order the cards, and neither hides one. Before anything is typed
 * the case's stage leads: the asks that usually come up there sit first, the
 * rest follow under their own heading. Once the filer types, their sentence
 * outranks the stage — they have said what they want, and a guess from the
 * stage should not argue with it.
 *
 * The search itself lives in the page header (`ApplicationTypeSearch`), so the
 * query is the parent's state and arrives here as a prop.
 */
export function ApplicationTypePicker({
  value,
  query,
  suggested,
  stageName,
  onChoose,
  available,
}: {
  /**
   * Whether a type can be filed here, by this side, at this point in the case
   * (lifecycle "Available when"). A type that cannot is not offered at all.
   */
  available?: (type: ApplicationTypeId) => boolean;
  /** The type already chosen, when returning here to change it. */
  value: ApplicationTypeId | "";
  query: string;
  /** Types that usually come up at this case's stage; empty when none lead. */
  suggested: ApplicationTypeId[];
  /** The stage as the case header names it, for the suggested heading. */
  stageName: string;
  onChoose: (type: ApplicationTypeId) => void;
}) {
  const results = useMemo(
    () =>
      searchApplicationTypes(query).filter(
        (result) => !available || available(result.guide.id)
      ),
    [query, available]
  );
  const matched = results.filter(
    (result) => result.score >= APPLICATION_TYPE_MATCH_FLOOR
  );
  const others = results.filter(
    (result) => result.score < APPLICATION_TYPE_MATCH_FLOOR
  );
  const typed = query.trim().length > 0;
  const ranked = typed && matched.length > 0;

  const all = results.map((result) => result.guide);
  // In the stage's own order, which is most likely first, not alphabetical.
  const leading = suggested
    .filter((id) => !available || available(id))
    .map((id) => all.find((guide) => guide.id === id))
    .filter((guide): guide is ApplicationTypeGuide => guide !== undefined);
  const rest = all.filter((guide) => !suggested.includes(guide.id));

  return (
    <div className="flex flex-col gap-6">
      {/* The re-ordering is visual; this is how it reaches a screen reader. */}
      <p aria-live="polite" className="sr-only">
        {typed
          ? ranked
            ? `${matched.length} of ${results.length} application types match what you typed. ${matched[0].guide.label} is the closest.`
            : "No application type matches what you typed. All types are listed."
          : ""}
      </p>

      {ranked ? (
        <>
          <TypeSection
            title={matched.length === 1 ? "Closest match" : "Closest matches"}
            guides={matched.map((result) => result.guide)}
            value={value}
            leadId={matched[0].guide.id}
            onChoose={onChoose}
          />
          {others.length > 0 ? (
            <TypeSection
              title="More application types"
              guides={others.map((result) => result.guide)}
              value={value}
              onChoose={onChoose}
            />
          ) : null}
        </>
      ) : (
        <>
          {typed ? (
            <p className="text-body-compact text-muted-foreground">
              Nothing matched that. Pick a type below. Generic takes anything the
              rest do not cover.
            </p>
          ) : null}
          {leading.length > 0 ? (
            <>
              <TypeSection
                title={`Suggested at the ${stageName} stage`}
                guides={leading}
                value={value}
                onChoose={onChoose}
              />
              <Separator className="bg-hairline" />
              <TypeSection
                title="More application types"
                guides={rest}
                value={value}
                onChoose={onChoose}
              />
            </>
          ) : (
            <TypeGrid guides={all} value={value} onChoose={onChoose} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * The chooser's search: View Case's own register search, so the field is the
 * size and shape of every other one on the case screens. It names exactly
 * what it does. The earlier "What do you need from the court?" read as a
 * question to answer, not a box to search (owner, Sept 21). It still takes a
 * plain sentence; the name just no longer depends on anyone knowing that.
 */
export function ApplicationTypeSearch({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  /* Centred, wide and a step taller than a register's search (owner, Oct 8,
     as it was before Sept 21): with eighteen types, searching is how most
     filers will start, so it leads the page like a search engine's box. */
  return (
    <InputGroup className="h-11">
      <InputGroupAddon>
        <SearchIcon aria-hidden />
      </InputGroupAddon>
      {/* Text, not search: the browser's own clear button doubled ours. */}
      <InputGroupInput
        type="text"
        role="searchbox"
        enterKeyHint="search"
        aria-label="Search application types in your own words"
        placeholder="Search in your own words, like “my client can’t attend”"
        autoComplete="off"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="text-body"
      />
      {query ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-sm"
            aria-label="Clear the search"
            onClick={() => onQueryChange("")}
          >
            <XIcon aria-hidden />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}

function TypeSection({
  title,
  guides,
  value,
  leadId,
  onChoose,
}: {
  title: string;
  guides: ApplicationTypeGuide[];
  value: ApplicationTypeId | "";
  /** The one card the search puts first, chipped so the order is legible. */
  leadId?: ApplicationTypeId;
  onChoose: (type: ApplicationTypeId) => void;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      {/* The card titles' size in the muted ink (owner, Sept 21): a label over
          a group, quieter than the cards it names. */}
      <h2
        id={headingId}
        className="text-body-compact font-semibold text-muted-foreground"
      >
        {title}
      </h2>
      <TypeGrid
        guides={guides}
        value={value}
        leadId={leadId}
        onChoose={onChoose}
      />
    </section>
  );
}

/**
 * Three up, two, then one — measured against the column the cards actually
 * get, not the viewport. The nav rail takes 256px off this screen and folds
 * on its own schedule, so a viewport breakpoint reads the wrong number: at a
 * 900px tablet the rail is still open and the cards have 672px, which a `md:`
 * rule would call desktop. The thresholds below are the widths at which a card
 * still holds its title on one line.
 */
function TypeGrid({
  guides,
  value,
  leadId,
  onChoose,
}: {
  guides: ApplicationTypeGuide[];
  value: ApplicationTypeId | "";
  leadId?: ApplicationTypeId;
  onChoose: (type: ApplicationTypeId) => void;
}) {
  return (
    <div className="@container">
      <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
        {guides.map((guide) => (
          <TypeCard
            key={guide.id}
            guide={guide}
            chosen={guide.id === value}
            lead={guide.id === leadId}
            onChoose={onChoose}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One card: the ask pictured, then named, then explained.
 *
 * The whole card is the button, so the top line carries no second control —
 * only marks. The icon says which ask this is before the title is read; the
 * arrow says the card goes somewhere, at rest rather than on hover, since a
 * filer on a phone has no hover to discover it with. Between them sits at most
 * one chip: which type you already chose outranks which one the search liked,
 * since only the first is a fact about your filing.
 *
 * Cards lift off the page — hairline edge, raised shadow — rather than sitting
 * as bordered white boxes on white. Height comes from the grid row, so a long
 * label and a short one still square up beside each other.
 */
function TypeCard({
  guide,
  chosen,
  lead,
  onChoose,
}: {
  guide: ApplicationTypeGuide;
  chosen: boolean;
  lead: boolean;
  onChoose: (type: ApplicationTypeId) => void;
}) {
  const Icon = guide.icon;

  return (
    <Item
      asChild
      variant="outline"
      className={cn(
        PANEL_CLASS,
        "h-full flex-col flex-nowrap items-start gap-2 rounded-xl p-4",
        /* Three signals at once, because many of these screens are old panels
           that flatten a soft shadow to nothing (owner, Sept 21): the DS hover
           fill, a step darker than the muted ground; the edge going from
           hairline to full border; and the lift. Any one of them surviving is
           enough to read as "this is under the pointer". */
        "hover:border-border hover:bg-accent hover:shadow-overlay active:shadow-raised"
      )}
    >
      <button
        type="button"
        aria-label={`${guide.label}: ${guide.description}`}
        onClick={() => onChoose(guide.id)}
      >
        <div className="flex w-full items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {chosen ? (
            <Badge variant="outline">Chosen</Badge>
          ) : lead ? (
            <Badge variant="secondary">Closest match</Badge>
          ) : null}
          <ArrowRightIcon
            className="ml-auto size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </div>

        <ItemContent className="w-full min-w-0 gap-1 text-left">
          <ItemTitle className="line-clamp-none w-full text-body-compact font-semibold break-words text-foreground">
            {guide.label}
          </ItemTitle>
          <ItemDescription className="line-clamp-none text-body-compact text-muted-foreground">
            {guide.description}
          </ItemDescription>
        </ItemContent>
      </button>
    </Item>
  );
}
