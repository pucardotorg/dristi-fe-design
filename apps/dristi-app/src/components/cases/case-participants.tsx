import { CaseLink as Link } from "@/components/cases/case-reader";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";

import { AlternateAddresses } from "@/components/cases/alternate-addresses";
import { CaseAddPeople } from "@/components/cases/case-add-people";
import { RestingCard } from "@/components/cases/case-overview-card";
import { EditLitigantAction } from "@/components/cases/edit-litigant-dialog";
import {
  LiveAdvocateWells,
  LivePoaPendingSection,
  PartiesLiveProvider,
  WitnessListExtras,
} from "@/components/cases/parties-live";
import type { CaseRef } from "@/components/cases/party-application";
import { PoaHolderWell } from "@/components/cases/poa-holder-actions";
import { RepresentationWell } from "@/components/cases/representation-well";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { Separator } from "@/components/ui/separator";
import {
  ADDED_BY_LABEL,
  PARTY_INLINE_LABEL,
  PARTY_ROLE_LABEL,
  participantHref,
  type PartySideId,
  type WitnessSideId,
  witnessesForLitigant,
  type CaseWitness,
  type Litigant,
  type ParticipantsFile,
} from "@/lib/cases/parties";
import { isViewer } from "@/lib/cases/viewer";
import { cn } from "@/lib/utils";
import { PartyDetailSlot } from "@/components/cases/party-detail-slot";
import { displayName } from "@/lib/cases/names";
import { Identifier } from "@/components/chrome/identifier";

/**
 * Everyone on the case: one grouped list, and a pane for whoever is open.
 *
 * **Rows are links, so selection is not state.** Each row is an anchor to
 * `?selected=`, which buys four things a click handler would have to re-earn:
 * a participant is deep-linkable, a refresh lands on the same person, the
 * server renders the pane the URL asked for, and keyboard operation is the
 * browser's own Tab-and-Enter rather than a hand-rolled roving tabindex. This
 * is navigation between views, not a form control, so it is a `nav` of links
 * with `aria-current` (ACCESSIBILITY: prefer native semantics). It also means
 * the whole section is a server component — no `use client`, no router, no
 * hydration cost.
 *
 * **Layering (ui-craft §4).** Page → this one panel → wells inside it. The
 * master list sits on the card fill; the detail pane's fact rows are the only
 * wells. Selection is a single quiet cue — `accent-strong`, the DS's
 * documented selected fill — never fill *and* border *and* bar stacked.
 *
 * **The pane's facts go two up**, keyed to the pane's own width rather than the
 * viewport's: the pane is a grid track, so at 1024px the master rail leaves it
 * a phone's width while a `lg:` rule would call it desktop. An odd number of
 * sections gives the last one the whole row and lets its wells go two up
 * inside it, so a well is about half a pane wide whatever the participant
 * carries and no section is stranded beside a hole. Stacked full-bleed, each
 * well was one short name on a field of grey four times its width.
 *
 * **The master list codes side by colour, on the owner's call** — see
 * `SIDE_PILL`. ds-requests #1 (no token family for categorical marks) is still
 * open, so this borrows the status families rather than closing it: the
 * request stands, and a `tag-*` family would be the honest home for these.
 *
 * ## Three things the mockup drew that are not here
 *
 * Each would have had the screen assert something the product cannot.
 *
 * **"BAR REGISTERED" tag on every advocate.** No bar-registration field exists
 * anywhere in the model and no product doc records one. The tag is a
 * *verification*: rendering it would tell a court user the registry has
 * confirmed something it has never been asked. Omitted outright rather than
 * stubbed — a stubbed verification is worse than none.
 *
 * **"Edit party" button** — originally omitted because no application type
 * carried it. It exists now as the pencil on the detail header (own side
 * only): the party-actions phase gave corrections their own application flow
 * (`edit-litigant-dialog.tsx`), pre-filled from the record and ending in the
 * generated-application chain, so the button no longer has to borrow the
 * Raise-application flow's types.
 *
 * **"Case timeline associations" tiles.** "Appeared on <date>" is not
 * derivable: `hearings-dummy.json` records attendance as opaque
 * `participantIds` (`PARTY-C-001`, `PARTY-A-001`) with no registry mapping
 * them to parties — and one `PARTY-A-001` covers all three accused on c-1001,
 * so no per-party appearance date exists to show. "Represented by" restated
 * the Representation section directly above it, and named one advocate where
 * two are assigned. The section became **Linked witnesses**, derived from data
 * that does exist and shown nowhere else on the pane.
 *
 * Absent by omission rather than error: `supportPeople` stays in the model.
 * This mockup has no surface for juniors and clerks; the data and its
 * derivation are intact for the next one that does.
 */
const HEADING_ID = "parties-heading";

/**
 * Everyone attached to the case ON THE VIEWER'S SIDE, as PoA-takeover
 * options (PM, Sept 2; own-side clarified by the owner the same day — the
 * opposing party's people holding your PoA is a contradiction): the side's
 * litigants, its advocates on the vakalatnama, and its office staff. Keys
 * are prefixed so populations never collide.
 */
function casePeopleOptions(file: ParticipantsFile, viewerSide: PartySideId) {
  return [
    ...file.litigants
      .filter((row) => row.side === viewerSide)
      .map((row) => ({
        key: `party:${row.id}`,
        name: row.name,
        detail: PARTY_ROLE_LABEL[row.side],
      })),
    ...file.legalTeams
      .filter((team) => team.side === viewerSide)
      .map((team) => ({
        key: `advocate:${team.id}`,
        name: team.advocate,
        detail: "On the vakalatnama",
      })),
    ...file.supportPeople
      .filter((person) => person.sides.includes(viewerSide))
      .map((person) => ({
        key: `staff:${person.id}`,
        name: person.name,
        detail: `${person.role} · office access`,
      })),
  ];
}

export function CaseParticipants({
  file,
  caseId,
  caseRef,
  viewerSide,
  viewerCanAct,
  pendingWitnesses,
  selectedId,
  chosen = false,
}: {
  file: ParticipantsFile;
  caseId: string;
  /** How the paper names this case — application-type flows print it. */
  caseRef: CaseRef;
  /** The side the signed-in advocate works for on this case — every
      own-side gate here reads it. Derived per case in `case-parties.tsx`. */
  viewerSide: PartySideId;
  /** False when the viewer holds office access only: they read the same
      panes, but removal and PoA actions stay with the vakalatnama holders. */
  viewerCanAct: boolean;
  /** The viewer's own witness applications awaiting the order — authored
      seeds; the session's own sends join them through the live layer. */
  pendingWitnesses: string[];
  selectedId: string | undefined;
  /** The URL named this participant (not the default first row). */
  chosen?: boolean;
}) {
  const litigant = file.litigants.find((row) => row.id === selectedId);
  const witness = file.witnesses.find((row) => row.id === selectedId);

  return (
    <section className="min-w-0" aria-labelledby={HEADING_ID}>
      {/* Client boundary for session-local additions: the add flow reports
          what it added, the Representation sections render it live. The
          section itself stays a server component. */}
      <PartiesLiveProvider>
      <RestingCard className="min-w-0">
        <CardContent className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 id={HEADING_ID} className="text-body font-semibold">
              Parties
            </h2>
            {/* Both counts as plain muted text. The mockup put the litigant
                count in a filled chip and the witness count in plain text —
                one data type, two presentations, which is the inconsistency
                ui-craft names outright. */}
            <p className="text-caption font-medium text-muted-foreground">
              <span className="tabular-nums">
                {plural(file.counts.litigants, "litigant", "litigants")}
              </span>
              {" · "}
              <span className="tabular-nums">
                {plural(file.counts.witnesses, "witness", "witnesses")}
              </span>
            </p>
          </div>
          {/* The one teal in the region (Ration teal). The universal
              Add-people entry (advocate, witness, PoA-holder), with the
              party options built here, on the server, so the dialogs never
              import the authored pack.

              Own side only: an advocate acts for their own clients, so the
              add-advocate and PoA flows get the viewer's parties and
              advocates, never the opposing side's. The side comes from the
              case's own record (`viewerSide`), so an accused-side brief
              flips these pools; the real seam is the signed-in user's
              brief on this case. */}
          <CaseAddPeople
            caseRef={caseRef}
            litigants={file.litigants
              .filter((row) => row.side === viewerSide)
              .map((row) => ({
                id: row.id,
                name: row.name,
                side: row.side,
                poaHolder: row.powerOfAttorneyHolder,
              }))}
            casePeople={casePeopleOptions(file, viewerSide)}
          />
        </CardContent>

        <Separator />

        {/* Master and detail, divided by a rule on the card fill rather than
            boxed — a panel per pane would be the box-in-box the elevation
            foundation rules out.

            Below `lg` they stack: list first, then the pane for the open row.
            Not a drill-in with a back affordance, because there is no state to
            go back *to* — a row is a link, so the browser's own back button
            already returns the reader wherever they came from, and a stacked
            list keeps the other participants one scroll away rather than one
            navigation away (RESPONSIVE — stack before splitting). */}
        <CardContent className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,18rem)_auto_minmax(0,1fr)]">
          <MasterList
            file={file}
            caseId={caseId}
            pendingWitnesses={pendingWitnesses}
            selectedId={selectedId}
            chosen={chosen}
          />
          <PartyDetailSlot
            title={litigant?.name ?? witness?.name ?? "Participant"}
            chosen={chosen}
          >
          {litigant ? (
            <LitigantDetail
              file={file}
              litigant={litigant}
              caseId={caseId}
              caseRef={caseRef}
              viewerSide={viewerSide}
              viewerCanAct={viewerCanAct}
            />
          ) : witness ? (
            <WitnessDetail witness={witness} viewerSide={viewerSide} />
          ) : (
            <SectionNote>Select a participant to see their details.</SectionNote>
          )}
          </PartyDetailSlot>
        </CardContent>
      </RestingCard>
      </PartiesLiveProvider>
    </section>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * A section eyebrow.
 *
 * The DS has no `overline` type role — the 11 named styles are the eight sizes
 * plus weight and mono variants — so this is `text-caption` at the weight
 * ui-craft sanctions for eyebrows, muted. Sentence case, not the mockup's
 * all-caps mono: the Laws put ALL-CAPS in the "never" list, and `font-mono` in
 * this app is reserved for identifiers the registry assigns (witness numbers),
 * not for styling a label.
 */
function Eyebrow({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-caption font-semibold text-muted-foreground">
      {children}
    </p>
  );
}

function SectionNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-body-compact text-muted-foreground">{children}</p>
  );
}

/* ------------------------------------------------------------------ */
/* Master                                                              */
/* ------------------------------------------------------------------ */

const LITIGANTS_GROUP_ID = "participants-litigants-group";
const WITNESSES_GROUP_ID = "participants-witnesses-group";

function MasterList({
  file,
  caseId,
  pendingWitnesses,
  selectedId,
  chosen,
}: {
  file: ParticipantsFile;
  caseId: string;
  pendingWitnesses: string[];
  selectedId: string | undefined;
  chosen: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <nav aria-labelledby={LITIGANTS_GROUP_ID} className="flex min-w-0 flex-col gap-2">
        <Eyebrow id={LITIGANTS_GROUP_ID}>All parties</Eyebrow>
        <ul className="flex min-w-0 flex-col gap-1 max-lg:gap-2">
          {file.litigants.map((row) => (
            <li key={row.id}>
              <MasterRow
                href={participantHref(caseId, row.id)}
                name={row.name}
                badge={
                  <SidePill side={row.side}>
                    {PARTY_ROLE_LABEL[row.side]}
                  </SidePill>
                }
                selected={row.id === selectedId}
                quietDefault={!chosen}
              />
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-labelledby={WITNESSES_GROUP_ID} className="flex min-w-0 flex-col gap-2">
        <Eyebrow id={WITNESSES_GROUP_ID}>Witnesses</Eyebrow>
        {/* The list always renders: after the register's rows come the
            viewer's own applications still with the magistrate — greyed,
            "Awaiting order" — via the client tail, which also owns the
            empty note (it alone knows whether the session just sent one).
            The group keeps its heading either way: an empty witness list
            is a fact about this case. */}
        <ul className="flex min-w-0 flex-col gap-1 max-lg:gap-2">
          {file.witnesses.map((row) => (
            <li key={row.id}>
              <MasterRow
                href={participantHref(caseId, row.id)}
                name={row.name}
                /* The number carries the side already — `PW` is the
                   complainant's, `DW` the accused's, `CW` the court's — so
                   colouring the number itself needs no second label, and
                   the side is never colour alone. */
                badge={
                  <SidePill side={row.side}>
                    {/* The whole row is a link, and the pill carries no name of its
                        own, so the number takes the face without a control. */}
                    <Identifier
                      value={row.number}
                      label="witness number"
                      copyable={false}
                    />
                  </SidePill>
                }
                selected={row.id === selectedId}
                quietDefault={!chosen}
              />
            </li>
          ))}
          <WitnessListExtras
            registeredCount={file.witnesses.length}
            authoredPending={pendingWitnesses}
          />
        </ul>
      </nav>
    </div>
  );
}

/**
 * Which side a participant is on, as a pill in the master list — the label for
 * a litigant, the registry's number for a witness.
 *
 * **Status families carrying a role, on the owner's call (2026-08-26).** The DS
 * closes `success` / `destructive` at three treatments each and means them as
 * status — so on this screen the accused wears the colour the system otherwise
 * spends on errors, before any court has decided anything. Asked, and the
 * answer was the green/red pair; the alternatives offered were a filled-vs-
 * outlined neutral pair and grouping the list under side headings. Recorded
 * here because the next person to read `destructive` on this screen will
 * reasonably assume it means what it means everywhere else.
 *
 * The pill always says in words what the colour says, so the side is never
 * colour alone (Laws, rule 7) — the role for a litigant, and for a witness the
 * number, whose prefix already names the side it belongs to.
 *
 * Every pill carries its own solid as a stroke in every state: a `-muted` fill
 * measures 1.07–1.25:1 on the selected row's `accent-strong`, which is no edge
 * at all, and rule 6a names the solid — an existing treatment, not an invented
 * fourth — as the fix. Applied at rest too, so a pill does not change shape
 * when its row is picked. Measured, both themes: strokes land 3.90–4.85:1 on
 * the selected row and labels 4.54–7.91:1 on their own fill.
 *
 * Master list only. The detail pane's badges stay neutral: one pane shows one
 * participant, so there is nothing there to tell apart.
 */
const SIDE_PILL: Record<
  WitnessSideId,
  { variant: "success" | "destructive" | "info"; stroke: string }
> = {
  complainant: { variant: "success", stroke: "border-success" },
  accused: { variant: "destructive", stroke: "border-destructive" },
  /* The court's own witness. Filled like its two siblings rather than left
     hollow: `outline` was the first try, and `border-border` — the loudest
     neutral stroke there is — measures 1.59:1 on the selected row, so the one
     pill that was not a status tint was also the only one without an edge.
     Same data type, same treatment (ui-craft). */
  neither: { variant: "info", stroke: "border-info" },
};

function SidePill({
  side,
  children,
}: {
  side: WitnessSideId;
  children: ReactNode;
}) {
  const { variant, stroke } = SIDE_PILL[side];
  return (
    <Badge variant={variant} className={stroke}>
      {children}
    </Badge>
  );
}

/**
 * One row of the master list.
 *
 * `min-h-12` rather than the 40px floor: two lines of copy do not fit a 40px
 * control, and the row is the primary target on this screen.
 *
 * Selection is *one* cue — the DS's `accent-strong` fill. The mockup drew a
 * bordered card; fill plus border plus chevron would be the stacked selection
 * costume ui-craft's loudness ladder rules out, and `border-border` is the
 * loudest non-text mark available. The chevron renders on every row so the row
 * does not change shape between states.
 */
function MasterRow({
  href,
  name,
  badge,
  selected,
  quietDefault = false,
}: {
  href: string;
  name: string;
  badge: ReactNode;
  selected: boolean;
  /** This row is only the default first pick. Beside the list that is worth
   *  marking, since its details show; under `lg` nothing shows until a row is
   *  tapped, so a marked row would claim something is open. */
  quietDefault?: boolean;
}) {
  return (
    <Link
      href={href}
      /* Selection is a query param on the page the reader is already on, so
         the router's default scroll-to-top throws them to the top of the case
         on every pick — and the list they are picking from sits well below
         that. Switching section keeps the reset; moving within one does not. */
      scroll={false}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex min-h-12 min-w-0 items-center gap-3 rounded-md px-3 py-2 transition-colors",
        /* Under `lg` a row opens a drawer, and nothing on a bare name said so
           (owner, Sept 21: "it took me five minutes"). There each row is an
           outlined card with a chevron, the look of something that opens. */
        "max-lg:rounded-lg max-lg:border max-lg:border-hairline max-lg:bg-card max-lg:py-3 max-lg:active:bg-accent",
        "focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-1 focus-visible:outline-ring",
        selected
          ? quietDefault
            ? "lg:bg-accent-strong"
            : "bg-accent-strong"
          : "hover:bg-accent"
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="block max-w-full text-body-compact font-semibold text-foreground">
          {name}
        </span>
        {badge}
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground lg:hidden"
      />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

const DETAIL_HEADING_ID = "participant-detail-heading";

function DetailHeader({
  name,
  subline,
  badge,
}: {
  name: string;
  subline: string;
  badge: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <h3
          id={DETAIL_HEADING_ID}
          className="text-body font-semibold text-foreground"
        >
          {name}
        </h3>
        <p className="mt-1 text-body-compact text-muted-foreground">{subline}</p>
      </div>
      {badge}
    </div>
  );
}

/**
 * An eyebrow-labelled run of wells in the detail pane.
 *
 * A `div` with an `h4`, not a labelled `section`. As landmarks these were
 * noise — one pane emitted four regions, several of them a single row tall,
 * on top of the two master navs — while the heading outline stopped at the
 * detail `h3`, so none of them was reachable the way a reader actually moves
 * through a pane. Headings give the navigation; the landmark gave the count.
 *
 * `wide` hands the section the whole row of the detail grid — see
 * `LitigantDetail` for when that happens.
 */
function DetailSection({
  id,
  title,
  wide = false,
  children,
}: {
  id: string;
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", wide && "@lg:col-span-2")}>
      <h4
        id={id}
        className="text-caption font-semibold text-muted-foreground"
      >
        {title}
      </h4>
      {children}
    </div>
  );
}

/** The wells under one eyebrow — two up only when the section has the row. */
function FactList({
  wide = false,
  children,
}: {
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 items-start gap-2",
        wide && "@lg:grid-cols-2"
      )}
    >
      {children}
    </div>
  );
}

/**
 * The well a fact sits in — `surface-sunken`, `rounded-md` because an inset is
 * not a control, and borderless because depth is fill.
 *
 * Two lines stacked in the master row's own grammar, at its `min-h-12`: a well
 * is the row it came from, half a pane wide. `justify-between` pushed the
 * supporting half to the far edge, where at full width it read as belonging to
 * the pane rather than to the name it qualifies, and at half width the two met
 * in the middle.
 */
const WELL_CLASS =
  "flex min-h-12 min-w-0 flex-col justify-center gap-1 rounded-md bg-surface-sunken px-3 py-2";

/**
 * What a well that holds a link adds: the hairline the DS asks of an
 * interactive well, which doubles as the only mark separating the wells a
 * reader can open from the wells they cannot.
 *
 * Hover is `accent-strong`, one past the named hover fill. `accent` is
 * neutral-3 and the well is already the tuned 2½ step, so an `accent` hover
 * moves half a ramp step and disappears; `accent-strong` is the same
 * perceptual distance off a well that `accent` is off the card's white.
 */
const WELL_LINK_CLASS =
  "border border-hairline transition-colors hover:bg-accent-strong focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-1 focus-visible:outline-ring";

function FactWell({
  primary,
  primarySuffix,
  secondary,
  href,
}: {
  primary: string;
  /** A muted qualifier after the name — "(you)" on the viewer's own row,
      the same mark the access lists use. */
  primarySuffix?: string;
  secondary?: ReactNode;
  href?: string;
}) {
  const lines = (
    <>
      <span className="block text-body-compact font-medium text-foreground">
        {displayName(primary)}
        {primarySuffix ? (
          <span className="font-normal text-muted-foreground">
            {" "}
            {primarySuffix}
          </span>
        ) : null}
      </span>
      {secondary ? (
        <span className="block text-caption font-medium text-muted-foreground">
          {secondary}
        </span>
      ) : null}
    </>
  );

  return href ? (
    <Link
      href={href}
      /* Same selection navigation as a master row — see `MasterRow`. */
      scroll={false}
      className={cn(WELL_CLASS, WELL_LINK_CLASS)}
    >
      {lines}
    </Link>
  ) : (
    <div className={WELL_CLASS}>{lines}</div>
  );
}

/**
 * A litigant, and what the record attaches to them.
 *
 * Sections render only where there is something to say: a plain individual
 * complainant gets one, a partnership firm with officers and a PoA-holder gets
 * four. Padding every pane out to the same shape with "None" rows would make
 * the exceptions harder to spot, which is the opposite of the point.
 *
 * Collected into a list rather than written as four conditional blocks,
 * because the layout needs the count before it can place any of them: an odd
 * number of sections gives the last one the whole row.
 */
function LitigantDetail({
  file,
  litigant,
  caseId,
  caseRef,
  viewerSide,
  viewerCanAct,
}: {
  file: ParticipantsFile;
  litigant: Litigant;
  caseId: string;
  caseRef: CaseRef;
  viewerSide: PartySideId;
  viewerCanAct: boolean;
}) {
  const linkedWitnesses = witnessesForLitigant(file, litigant.id);
  const sections: { id: string; title: string; facts: ReactNode }[] = [];

  /* "Representation", not the mockup's "Assigned advocates": the section has
     to head a party-in-person and a no-advocate pane too, and a heading naming
     advocates over neither is a contradiction. */
  /* Advocates this session added arrive through the live layer, in the same
     well the record's advocates get — the add flow's list update. Own-side
     only by construction: the add dialog offers only the viewer's parties. */
  const liveWells = (
    <LiveAdvocateWells
      partyId={litigant.id}
      partyName={litigant.name}
      caseRef={caseRef}
    />
  );

  sections.push({
    id: "participant-representation",
    title: "Representation",
    facts: litigant.partyInPerson ? (
      <FactWell primary="Party in person" />
    ) : (
      <>
        {litigant.advocates.length > 0 ? (
          /* Each advocate's well carries the removal entry point (3a/3b), a
             client island in an otherwise server pane — but only on the
             viewer's own side: an advocate cannot seek the removal of
             opposing counsel (owner, Sept 1). The other side's advocates
             stay plain fact wells. So do two rows on the viewer's own side:
             the viewer themself — you do not remove yourself, the row just
             says "(you)" — and every row when the viewer holds office
             access only (owner, Sept 3). */
          litigant.advocates.map((advocate) =>
            litigant.side === viewerSide &&
            viewerCanAct &&
            !isViewer(advocate) ? (
              <RepresentationWell
                key={advocate}
                advocate={advocate}
                partyName={litigant.name}
                caseRef={caseRef}
              />
            ) : (
              <FactWell
                key={advocate}
                primary={advocate}
                primarySuffix={isViewer(advocate) ? "(you)" : undefined}
              />
            )
          )
        ) : (
          <SectionNote>No advocate on record</SectionNote>
        )}
        {liveWells}
      </>
    ),
  });

  if (litigant.powerOfAttorneyHolder) {
    sections.push({
      id: "participant-poa",
      title: "Power of attorney",
      /* Remove and Replace (scenarios 6/7) ride the holder's own well —
         own side only, like the Representation wells, and vakalatnama
         holders only, like every removal action. The takeover pool is
         everyone attached to the case (PM, Sept 2) minus the granting
         party themselves. */
      facts:
        litigant.side === viewerSide && viewerCanAct ? (
          <PoaHolderWell
            holder={litigant.powerOfAttorneyHolder}
            partyName={litigant.name}
            caseRef={caseRef}
            existingPeople={casePeopleOptions(file, viewerSide).filter(
              (person) => person.key !== `party:${litigant.id}`
            )}
          />
        ) : (
          <FactWell primary={litigant.powerOfAttorneyHolder} />
        ),
    });
  }

  /* §141: the officers whose liability derives from this company. The subline
     names only the one who speaks for it, so this is the only place the rest
     of them appear on this pane. */
  if (litigant.personsInCharge.length > 0) {
    sections.push({
      id: "participant-officers",
      title: "Persons in charge",
      facts: litigant.personsInCharge.map((officer) => (
        <FactWell
          key={officer.id}
          primary={officer.name}
          secondary={officer.designation ?? officer.role}
        />
      )),
    });
  }

  /* What replaced the mockup's "Case timeline associations" — see the honesty
     notes at the head of this file. These are links, so a reader on a party
     can jump straight to the person giving evidence about them; it is the one
     cross-reference that connects the two groups of the master list. */
  /* 11a — the complainant's side may always give the court another address to
     try for an accused. A system action, so it lives inline on the opposing
     party's pane, exactly where every other action here would be forbidden. */
  if (litigant.side !== viewerSide) {
    sections.push({
      id: "participant-addresses",
      title: "Addresses",
      facts: <AlternateAddresses subjectName={litigant.name} />,
    });
  }

  if (linkedWitnesses.length > 0) {
    sections.push({
      id: "participant-linked-witnesses",
      title: "Linked witnesses",
      facts: linkedWitnesses.map((witness) => (
        <FactWell
          key={witness.id}
          primary={witness.name}
          secondary={
            /* The well is a link — the face without a nested control. */
            <Identifier value={witness.number} label="witness number" copyable={false} />
          }
          href={participantHref(caseId, witness.id)}
        />
      )),
    });
  }

  return (
    <div className="@container flex min-w-0 flex-col gap-6">
      <DetailHeader
        name={litigant.name}
        subline={litigantSubline(litigant)}
        badge={
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">{PARTY_ROLE_LABEL[litigant.side]}</Badge>
            {/* Scenario 10 — a correction to the record is an application, so
                the pencil opens a pre-filled form ending in the application
                chain. Own side only, like every other party action here. */}
            {litigant.side === viewerSide ? (
              <EditLitigantAction
                litigant={{
                  name: litigant.name,
                  entityRepresentative: litigant.entityRepresentative?.name,
                }}
                caseRef={caseRef}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid min-w-0 items-start gap-6 @lg:grid-cols-2">
        {sections.map((section, index) => {
          const wide =
            sections.length % 2 === 1 && index === sections.length - 1;
          return (
            <DetailSection
              key={section.id}
              id={section.id}
              title={section.title}
              wide={wide}
            >
              <FactList wide={wide}>{section.facts}</FactList>
            </DetailSection>
          );
        })}
        {/* A PoA application this session sent for a party with no holder:
            the section the server could not render appears live, the named
            holder waiting on the order. Own side only, like the add flow
            that feeds it. Null until then, so the grid is untouched. */}
        {litigant.side === viewerSide && !litigant.powerOfAttorneyHolder ? (
          <LivePoaPendingSection partyId={litigant.id} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * The one line under a litigant's name.
 *
 * Derived here rather than carried on the model: a summary string on the
 * participant would be a second derivation of the same sentence, and the two
 * drifted apart within a round the last time both existed.
 *
 * A plain individual gets their standing ("Individual"), which is the honest
 * version of the mockup's "Direct litigating party in case" — that phrase
 * asserts a directness the record does not grade.
 */
function litigantSubline(litigant: Litigant): string {
  if (litigant.kind === "entity") {
    return [
      litigant.entityType,
      litigant.entityRepresentative
        ? `represented by ${litigant.entityRepresentative.name}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (litigant.represents) {
    return litigant.represents.isEntityRepresentative
      ? `Entity representative of ${litigant.represents.name}`
      : `Person in charge of ${litigant.represents.name}`;
  }
  return litigant.standing;
}

/** A witness, in the same grammar as a litigant. */
function WitnessDetail({
  witness,
  viewerSide,
}: {
  witness: CaseWitness;
  viewerSide: PartySideId;
}) {
  return (
    <div className="@container flex min-w-0 flex-col gap-6">
      <DetailHeader
        name={witness.name}
        /* Never `${witness.side}`: interpolating the union reads correctly
           only because its members happen to be English words, which is the
           same casing hazard one layer down. */
        subline={
          witness.description ??
          (witness.side === "neither"
            ? "Called by neither party"
            : `Called by ${PARTY_INLINE_LABEL[witness.side]}`)
        }
        badge={
          <Badge variant="secondary" className="shrink-0">
            <Identifier value={witness.number} label="witness number" copyable={false} />
          </Badge>
        }
      />

      <DetailSection id="participant-witness-record" title="On the record">
        {/* Three facts across rather than three bars down: this is the whole
            of what the record holds about a witness, and a label with a
            one-word value wants a third of this pane, not all of it. */}
        <DescriptionList className="grid min-w-0 items-start gap-2 @sm:grid-cols-2 @lg:grid-cols-3">
          <WitnessFact
            term="Side"
            value={
              witness.side === "neither"
                ? "Neither party"
                : PARTY_ROLE_LABEL[witness.side]
            }
          />
          {/* The noun form. This is a value in a label→value well sitting
              beside "Side | Complainant" — the inline register would put two
              forms of one word on adjacent facts. */}
          <WitnessFact term="Added by" value={ADDED_BY_LABEL[witness.addedBy]} />
          <WitnessFact term="Linked party" value={witness.linkedParty?.name} />
        </DescriptionList>
      </DetailSection>

      {/* 11b — the side that called the witness keeps the court's addresses
          for them current; the demo viewer is complainant-side counsel. */}
      {witness.side === viewerSide ? (
        <DetailSection id="participant-witness-addresses" title="Addresses">
          <AlternateAddresses subjectName={witness.name} />
        </DetailSection>
      ) : null}
    </div>
  );
}

/**
 * One field of the witness's record, in the same well a litigant's facts sit
 * in — label over value, because one eyebrow cannot name three different
 * things. A real `dl` rather than a hand-rolled grid: the Laws name Description
 * list for exactly this, and a term stays a `dt` whatever it is wearing.
 */
function WitnessFact({ term, value }: { term: string; value?: string }) {
  return (
    <DescriptionRow className={cn(WELL_CLASS, "grid-cols-1 border-b-0")}>
      {/* Body, not caption: typography names Body Medium as the role for field
          labels, and caption is 12px — chrome weight for a label the reader is
          here to read. The same term treatment the service pane uses. */}
      <DescriptionTerm>
        {term}
      </DescriptionTerm>
      <DescriptionDetails className="min-w-0 font-medium">
        {value ?? <span className="text-muted-foreground">None</span>}
      </DescriptionDetails>
    </DescriptionRow>
  );
}
