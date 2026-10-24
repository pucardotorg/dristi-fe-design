"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  SearchIcon,
  UserPlusIcon,
  UserXIcon,
  XIcon,
} from "lucide-react";

import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { Identifier } from "@/components/chrome/identifier";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { initials } from "@/components/access/access-list";
import {
  directoryOptions,
  PeopleInviteField,
  type InvitePerson,
} from "@/components/access/people-invite-field";
import { FILTER_ON } from "@/components/advocate/hearing-timeline";
import { useAccess } from "@/components/access/access-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  caseLabel,
  fillCopy,
  inviteFieldCopy,
  peopleCopy,
  personAccessCopy as copy,
  type AccessCase,
  type AccessPerson,
} from "@/lib/access/content";
import { ACTIVE_STAGES, stageLabel } from "@/lib/cases/types";
import { stepHref } from "@/lib/filing/steps";
import { pick, type Copy, type Locale } from "@/lib/onboarding/content";
import { cn } from "@/lib/utils";

/**
 * One person in the office, opened over the People list in a near full-screen
 * dialog (owner, Oct 23). Closing it puts you back on the same list.
 *
 * The old side panel listed only the cases a person had, and giving more went
 * through a pop-up whose list could not untick. Two ways to do one job. Here
 * every case the advocate can share sits in one table, ticked where the person
 * has access: tick to give, untick to take away. Nothing applies until Save
 * changes, so a run of ticks is one decision, confirmed once when it removes.
 *
 * "All cases" is a checkbox over the whole docket, outside the filters, so a
 * filtered "tick all" can never pass for every case. New cases ride only on
 * it: the future checkbox opens once every case is ticked and closes the
 * moment one is unticked (OFC-24 unchanged, owner Oct 23).
 *
 * On a phone it is the flow window: the whole screen, in from the right.
 */

/** One stage the filter can hold. None held means all stages. */
type StageValue =
  "draft" | "disposed" | (typeof ACTIVE_STAGES)[number]["value"];

/**
 * The DS switch's knob is not concentric with its track (owner, Oct 23). The
 * track is 36 by 20 with a 1px transparent border; the 16px knob sits 2px from
 * the top and bottom but 1px from the side, off and on, because its travel
 * ignores the border. One more pixel in when off, and 17px of travel when on,
 * gives an even 2px all round. Corrected here by composition until the DS
 * primitive is fixed; the primitive itself stays untouched.
 */
const SWITCH_CONCENTRIC = cn(
  "[&>[data-slot=switch-thumb][data-state=unchecked]]:translate-x-px",
  "[&>[data-slot=switch-thumb][data-state=checked]]:translate-x-[calc(100%+1px)]",
);

/**
 * Every confirmation in this dialog (owner, Oct 23): wider than the DS default
 * so the heading holds one line, and a hairline under the heading the way the
 * footer has one over it.
 */
const CONFIRM_CONTENT = "data-[size=default]:sm:max-w-lg";
const CONFIRM_HEADER = "gap-4";
/** The save confirmation's heading block: the title and, at times, a note. */
const CONFIRM_HEAD_BLOCK =
  "-mx-6 flex flex-col gap-1 justify-self-stretch border-b border-hairline px-6 pb-4 text-left";
const CONFIRM_TITLE =
  "-mx-6 justify-self-stretch border-b border-hairline px-6 pb-4 text-body font-semibold text-pretty";

/** Add person has nobody yet; the dialog runs on an empty stand-in. */
const NEW_PERSON: AccessPerson = {
  id: "new-person",
  name: "",
  phone: "",
  addedBy: "self",
  grants: [],
};

/** What the list is being edited towards. `null` means no edits yet. */
type Draft = { ticked: Set<string>; future: boolean };

/** Close the dialog, or close it and go somewhere. */
type Leave = { to: "close" } | { to: "href"; href: string };

function displayName(person: AccessPerson): string {
  return person.name.replace(/^Adv\.\s*/, "");
}

function designation(person: AccessPerson, locale: Locale): string | null {
  if (
    person.barId ||
    person.grants.some((g) => g.role === "vakalat" || g.role === "junior")
  ) {
    return pick(peopleCopy.designationAdvocate, locale);
  }
  if (person.grants.some((g) => g.role === "clerk")) {
    return pick(peopleCopy.designationClerk, locale);
  }
  return null;
}

function stageText(entry: AccessCase, locale: Locale): string {
  if (entry.draft) return pick(peopleCopy.draft, locale);
  if (entry.stage === "disposed") return pick(copy.stageDisposed, locale);
  return entry.stage ? stageLabel(entry.stage) : "";
}

/** A stage's name, as the filter's menu shows it. */
function stageFilterLabel(stage: StageValue, locale: Locale): string {
  if (stage === "draft") return pick(peopleCopy.draft, locale);
  if (stage === "disposed") return pick(copy.stageDisposed, locale);
  return stageLabel(stage);
}

/** Every stage the filter offers, in docket order. */
const STAGE_OPTIONS: StageValue[] = [
  "draft",
  ...ACTIVE_STAGES.map((entry) => entry.value),
  "disposed",
];

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * Mount it keyed on each opening, so every opening starts from what is saved.
 * It keeps the person it opened on through the exit, so removing them from the
 * office does not blank the dialog while it leaves.
 */
export function PersonAccessDialog({
  personId,
  open,
  onOpenChange,
  locale,
  adding = false,
}: {
  personId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  /**
   * Add person (owner, Oct 23): the same dialog with "People" on top and the
   * same case picker below, so adding someone and changing their access are
   * one pattern. Nobody holds anything yet, so every case starts unticked.
   */
  adding?: boolean;
}) {
  const router = useRouter();
  const {
    office,
    shareableCases,
    invite,
    removeGrant,
    removeAll,
    setAllCases,
  } = useAccess();
  const live = office.find((entry) => entry.id === personId) ?? null;
  const [last, setLast] = React.useState<AccessPerson | null>(live);
  if (live && live !== last) setLast(live);
  const person = live ?? last ?? (adding ? NEW_PERSON : null);
  /* Add person: who is being added. Registered advocates and clerks only. */
  const [chosen, setChosen] = React.useState<InvitePerson[]>([]);
  /** Add to office was pressed with something missing: show what. */
  const [tried, setTried] = React.useState(false);
  const known = directoryOptions(office.map((p) => p.phone)).filter(
    // Anyone on All cases already holds every case (OFC-27).
    (option) => !office.some((p) => p.allCases && p.phone === option.phone),
  );

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const [query, setQuery] = React.useState("");
  /* Several stages at once, as the cases list filters them; none is all. */
  const [stages, setStages] = React.useState<StageValue[]>([]);
  const [confirmSave, setConfirmSave] = React.useState(false);
  const [confirmRemoveAll, setConfirmRemoveAll] = React.useState(false);
  /** Unsaved ticks asked about before the dialog closes or a case opens. */
  const [leave, setLeave] = React.useState<Leave | null>(null);

  const saved = React.useMemo(
    () => new Set(live?.grants.map((g) => g.caseId) ?? []),
    [live],
  );
  const savedFuture = Boolean(live?.allCases);
  const ticked = draft?.ticked ?? saved;
  const future = draft?.future ?? savedFuture;

  /* Cases they hold come first, in docket order, then the rest. Ordered by what
     is saved, not by the ticks, so a row never jumps away from the pointer. */
  const rows = React.useMemo(
    () => [
      ...shareableCases.filter((c) => saved.has(c.id)),
      ...shareableCases.filter((c) => !saved.has(c.id)),
    ],
    [shareableCases, saved],
  );
  const total = shareableCases.length;
  const tickedCount = shareableCases.filter((c) => ticked.has(c.id)).length;
  const allTicked = total > 0 && tickedCount === total;

  const needle = query.trim().toLowerCase();
  const visible = rows.filter((entry) => {
    if (
      needle &&
      !entry.title.toLowerCase().includes(needle) &&
      !entry.caseNumber.toLowerCase().includes(needle)
    ) {
      return false;
    }
    if (stages.length) {
      const own: StageValue | undefined = entry.draft ? "draft" : entry.stage;
      if (!own || !stages.includes(own)) return false;
    }
    // On what is saved, so unticking a row does not make it vanish.
    return true;
  });
  /* Two groups, by what is saved, so a row stays in its group while it is
     being ticked or unticked: the cases they have, then the rest. */
  const groups = [
    {
      key: "held",
      label: copy.groupHeld,
      entries: visible.filter((e) => saved.has(e.id)),
    },
    {
      key: "other",
      label: adding ? copy.groupYourCases : copy.groupOther,
      entries: visible.filter((e) => !saved.has(e.id)),
    },
  ].filter((group) => group.entries.length > 0);
  const visibleTicked = visible.filter((entry) => ticked.has(entry.id)).length;
  const headerState: boolean | "indeterminate" =
    visibleTicked === 0
      ? false
      : visibleTicked === visible.length
        ? true
        : "indeterminate";
  const adds = shareableCases.filter(
    (c) => ticked.has(c.id) && !saved.has(c.id),
  );
  const removes = shareableCases.filter(
    (c) => !ticked.has(c.id) && saved.has(c.id),
  );
  const futureChanged = future !== savedFuture;
  /* A search or a stage is narrowing the list. Saving from a narrowed list
     earns a note in the confirmation (owner, Oct 23). */
  const filtered = Boolean(needle) || stages.length > 0;
  const dirty = adding
    ? chosen.length > 0 || (Boolean(draft) && (ticked.size > 0 || future))
    : Boolean(draft) && (!sameSet(ticked, saved) || futureChanged);
  /** Add person needs someone and at least one case before it can save. */
  const canSave = adding ? chosen.length > 0 && tickedCount > 0 : dirty;
  const chosenNames = chosen.map((p) => p.name ?? p.phone ?? "").join(", ");
  // Each clears the moment it is put right.
  const whoError = adding && tried && chosen.length === 0;
  const casesError = adding && tried && tickedCount === 0;

  /**
   * Every edit goes through here. Reaching every case, by whatever route (the
   * All cases box, the table's header box, or one row at a time), turns new
   * cases on, since that is what All cases means (owner, Oct 23); it can be
   * switched off by hand. A case coming off ends "all", so new cases go too.
   */
  function commit(next: Set<string>, nextFuture: boolean) {
    const everything = shareableCases.every((c) => next.has(c.id));
    const reachedAll = everything && !allTicked;
    setDraft({
      ticked: next,
      future: everything && (nextFuture || reachedAll),
    });
  }

  function toggleCase(caseId: string, on: boolean) {
    const next = new Set(ticked);
    if (on) next.add(caseId);
    else next.delete(caseId);
    commit(next, future);
  }

  function setMany(ids: string[], on: boolean) {
    const next = new Set(ticked);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    commit(next, future);
  }

  /** Close, Escape, the phone's Back, Cancel: all ask first when ticks are unsaved. */
  function requestClose() {
    if (dirty) setLeave({ to: "close" });
    else onOpenChange(false);
  }

  function go(href: string) {
    if (dirty) {
      setLeave({ to: "href", href });
      return;
    }
    onOpenChange(false);
    router.push(href);
  }

  function apply() {
    if (adding) {
      const phones = chosen.map((p) => p.phone ?? "");
      if (allTicked && future) invite(phones, [], { allCases: true });
      else
        invite(
          phones,
          shareableCases.filter((c) => ticked.has(c.id)).map((c) => c.id),
        );
      toast.success(fillCopy(copy.addedToast, locale, { names: chosenNames }));
      setDraft(null);
      setChosen([]);
      onOpenChange(false);
      return;
    }
    if (!live) return;
    const turnFutureOn = future && !savedFuture;
    // Turning new cases on gives every missing case in the same act.
    if (turnFutureOn) invite([live.phone], [], { allCases: true });
    else if (adds.length)
      invite(
        [live.phone],
        adds.map((c) => c.id),
      );
    removes.forEach((c) => removeGrant(live.id, c.id));
    if (!future && savedFuture) setAllCases(live.id, false);
    setDraft(null);

    if (tickedCount === 0 && !future) {
      // No case left: they leave the office, and the dialog with them.
      toast.success(
        fillCopy(peopleCopy.removedAllNote, locale, { name: live.name }),
      );
      onOpenChange(false);
      return;
    }
    toast.success(fillCopy(copy.savedToast, locale, { name: live.name }));
  }

  function save() {
    // Add person never greys its button out (owner, Oct 23): pressing it with
    // something missing points at what is missing instead.
    if (adding && (chosen.length === 0 || tickedCount === 0)) {
      setTried(true);
      const target =
        chosen.length === 0
          ? document.getElementById("person-access-who-field")
          : document.getElementById("person-access-cases");
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (chosen.length === 0) target?.focus();
      return;
    }
    // Every save shows what it will change first (owner, Oct 23). Removals
    // had to be confirmed already (OFC-36); adds now are too.
    setConfirmSave(true);
  }

  function openCaseHref(entry: AccessCase): string {
    return entry.draft
      ? stepHref(entry.id, "complainant")
      : `/cases?case=${encodeURIComponent(entry.id)}`;
  }

  if (!person) return null;
  const stageSummary =
    stages.length === 0
      ? pick(copy.stageAll, locale)
      : stages.length === 1
        ? stageFilterLabel(stages[0], locale)
        : `${stageFilterLabel(stages[0], locale)} +${stages.length - 1}`;
  const role = designation(person, locale);
  /* The footer: only what Save will change; the groups' badges already say
     how many they have (owner, Oct 23). Adds in
     the success ink and removals in the destructive ink, each with its sign
     and its words, so the colour is never the only cue. */
  const pending: { text: string; tone?: "add" | "remove" }[] = [
    ...(adds.length
      ? [
          {
            text:
              adds.length === 1
                ? pick(copy.pendingAddOne, locale)
                : fillCopy(copy.pendingAdd, locale, {
                    count: String(adds.length),
                  }),
            tone: "add" as const,
          },
        ]
      : []),
    ...(removes.length
      ? [
          {
            text:
              removes.length === 1
                ? pick(copy.pendingRemoveOne, locale)
                : fillCopy(copy.pendingRemove, locale, {
                    count: String(removes.length),
                  }),
            tone: "remove" as const,
          },
        ]
      : []),
  ];

  /* The save confirmation (owner, Oct 23): one heading and one button for
     every save, the changes as points under it. The button turns red when
     the save takes access away. */
  const futureOff = futureChanged && !future;
  const confirmTakesAway = removes.length > 0 || futureOff;
  const confirmTitle = adding
    ? fillCopy(copy.addConfirmTitle, locale, { names: chosenNames })
    : fillCopy(copy.confirmTitle, locale, { name: person.name });
  const saveLabel = pick(adding ? copy.addAction : copy.save, locale);
  const casesWord = (count: number, one: Copy, many: Copy) =>
    count === 1
      ? pick(one, locale)
      : fillCopy(many, locale, { count: String(count) });
  const confirmPoints: {
    key: string;
    sign?: "+" | "−";
    text: string;
    note?: boolean;
  }[] = [
    ...(adds.length
      ? [
          {
            key: "add",
            sign: "+" as const,
            // Ending on every case says so, with the count, so "77" is never
            // left to be checked against the docket (owner, Oct 23).
            text: allTicked
              ? fillCopy(copy.pointAddAll, locale, { count: String(total) })
              : casesWord(adds.length, copy.pointAddOne, copy.pointAdd),
          },
        ]
      : []),
    ...(removes.length
      ? [
          {
            key: "remove",
            sign: "−" as const,
            text: casesWord(
              removes.length,
              copy.pointRemoveOne,
              copy.pointRemove,
            ),
          },
        ]
      : []),
    ...(futureOff
      ? [{ key: "future", text: pick(copy.confirmFutureOff, locale) }]
      : []),
    ...(futureChanged && future
      ? [{ key: "future-on", text: pick(copy.confirmFutureOn, locale) }]
      : []),
    ...(tickedCount === 0 && !future
      ? [{ key: "leave", text: pick(copy.confirmLeave, locale) }]
      : []),
  ];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
      >
        <FlowDialogContent
          showCloseButton={false}
          // Focus opens on Close: the first control, the More actions menu,
          // would show its tooltip the moment the dialog appears.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus();
          }}
          // Escape in an open picker (the People search's suggestions) closes
          // the picker, not the whole dialog.
          onEscapeKeyDown={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.getAttribute?.("aria-expanded") === "true")
              event.preventDefault();
          }}
          className="@container/dialog flex h-[calc(100dvh---spacing(12))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw---spacing(12))]"
        >
          {/* ------------------------------------------------------- header */}
          {adding ? (
            <div className="flex shrink-0 items-start gap-3 border-b border-hairline py-4 pr-3 pl-6">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand-muted-foreground">
                <UserPlusIcon aria-hidden className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <DialogTitle className="text-body font-semibold text-pretty">
                  {pick(copy.addTitle, locale)}
                </DialogTitle>
                {/* Everything the old three-line intro and option hints said,
                    in one sentence (owner, Oct 23). */}
                <p className="text-body-compact text-pretty text-muted-foreground">
                  {pick(copy.addIntro, locale)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                ref={closeRef}
                aria-label={pick(copy.close, locale)}
                onClick={requestClose}
                className="pointer-coarse:size-10"
              >
                <XIcon aria-hidden />
              </Button>
            </div>
          ) : (
            <div className="flex shrink-0 items-start gap-3 border-b border-hairline py-4 pr-3 pl-6 sm:items-center">
              <Avatar className="size-10 shrink-0">
                <AvatarFallback className="bg-brand-muted text-body-compact font-medium text-brand-muted-foreground">
                  {initials(person.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <DialogTitle className="text-body font-semibold text-pretty">
                    {displayName(person)}
                  </DialogTitle>
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-body-compact text-muted-foreground">
                    <span className="tabular-nums">{person.phone}</span>
                    {role ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{role}</span>
                      </>
                    ) : null}
                    {person.barId ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="flex items-baseline gap-1.5">
                          {pick(peopleCopy.barIdLabel, locale)}
                          <Identifier
                            value={person.barId}
                            label="bar id"
                            className="tabular-nums"
                          />
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              {/* Remove from office (owner, Oct 23): a red button beside the name
                when the dialog has the room (laptop, iPad Pro, iPad mini on its
                side); in a narrow dialog (phone, iPad mini upright) it moves
                into this More actions menu, so it never crowds the name and
                never needs a scroll to reach. Decided by the dialog's width. */}
              <Button
                type="button"
                variant="destructive"
                className="hidden @2xl/dialog:inline-flex"
                onClick={() => setConfirmRemoveAll(true)}
              >
                <UserXIcon aria-hidden />
                {pick(peopleCopy.removeFromAll, locale)}
              </Button>
              <DropdownMenu>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={pick(copy.moreActions, locale)}
                          className="pointer-coarse:size-10 @2xl/dialog:hidden"
                        >
                          <EllipsisIcon aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {pick(copy.moreActions, locale)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent
                  align="end"
                  sideOffset={4}
                  className="w-max whitespace-nowrap"
                >
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setConfirmRemoveAll(true)}
                  >
                    <UserXIcon aria-hidden />
                    {pick(peopleCopy.removeFromAll, locale)}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                ref={closeRef}
                aria-label={pick(copy.close, locale)}
                onClick={requestClose}
                className="pointer-coarse:size-10"
              >
                <XIcon aria-hidden />
              </Button>
            </div>
          )}

          {/* --------------------------------------------------------- body */}
          {/* Two sections and nothing else (visual pass, owner Oct 23).
              Access: the two docket-wide settings, each with one fixed line,
              so flipping one moves nothing. Cases: three views by what is
              saved (the cases they have, the ones they do not, all), the
              search and stage beside them, then the table. The views are the
              only place "has access" is decided on screen, so nothing else
              repeats it. */}
          <div className="@container/access flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-6">
            <DialogDescription className="sr-only">
              {pick(copy.casesIntro, locale)}
            </DialogDescription>

            {adding ? (
              <section
                aria-labelledby="person-access-who"
                className="flex flex-col gap-3"
              >
                <h3 id="person-access-who" className="text-body font-semibold">
                  {pick(copy.whoLabel, locale)}
                </h3>
                <Field data-invalid={whoError || undefined} className="gap-2">
                  <PeopleInviteField
                    id="person-access-who-field"
                    label={pick(inviteFieldCopy.placeholder, locale)}
                    known={known}
                    value={chosen}
                    onValueChange={setChosen}
                    locale={locale}
                    registeredOnly
                    invalid={whoError}
                    describedBy={whoError ? "person-access-who-error" : undefined}
                  />
                  <FieldError id="person-access-who-error">
                    {whoError ? pick(copy.needPerson, locale) : null}
                  </FieldError>
                </Field>
              </section>
            ) : null}

            {/* One heading for the whole block (owner, Oct 23): "Access to
                cases", the two settings on its line at the right with a
                hairline between them, then the search and the table. On a
                phone the settings drop under the heading. */}
            <section
              aria-labelledby="person-access-cases"
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-3 @2xl/access:flex-row @2xl/access:items-center @2xl/access:justify-between @2xl/access:gap-6">
                <h3
                  id="person-access-cases"
                  className="text-body font-semibold"
                >
                  {pick(copy.casesSection, locale)}
                </h3>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex min-h-10 items-center gap-3">
                    <Checkbox
                      id="access-all-cases"
                      checked={
                        allTicked ? true : tickedCount ? "indeterminate" : false
                      }
                      onCheckedChange={(value) =>
                        // Ticking All cases also turns new cases on; it can be
                        // switched off by hand (owner, Oct 23). Unticking it
                        // ends "all", so new cases go with it in commit().
                        commit(
                          value === true
                            ? new Set(shareableCases.map((c) => c.id))
                            : new Set(),
                          value === true,
                        )
                      }
                    />
                    <Label
                      htmlFor="access-all-cases"
                      className="cursor-pointer text-body-compact font-medium"
                    >
                      {pick(copy.allCases, locale)}
                    </Label>
                  </div>
                  <Separator
                    orientation="vertical"
                    className="hidden h-6 data-vertical:self-center @sm/access:block"
                  />
                  <div className="flex min-h-10 items-center gap-3">
                    {allTicked ? (
                      <Switch
                        id="access-future"
                        checked={future}
                        className={SWITCH_CONCENTRIC}
                        onCheckedChange={(value) =>
                          commit(new Set(ticked), value)
                        }
                      />
                    ) : (
                      /* Off until every case is ticked. A disabled control takes no
                       pointer or focus, so the span carries the hover and the
                       focus for the why (LockedRemove's own trick). */
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              tabIndex={0}
                              aria-describedby="access-future-locked"
                              className="inline-flex rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <Switch
                                id="access-future"
                                checked={false}
                                disabled
                                className={SWITCH_CONCENTRIC}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            id="access-future-locked"
                            className="max-w-80 text-pretty"
                          >
                            {pick(copy.futureLocked, locale)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Label
                      htmlFor="access-future"
                      className={cn(
                        "text-body-compact font-medium",
                        allTicked
                          ? "cursor-pointer"
                          : "cursor-not-allowed text-muted-foreground",
                      )}
                    >
                      {pick(copy.future, locale)}
                    </Label>
                  </div>
                </div>
              </div>

              {casesError ? (
                <p role="alert" className="text-body-compact text-destructive">
                  {pick(copy.needCases, locale)}
                </p>
              ) : null}

              {/* ------------------------------------------------ toolbar */}
              {/* Search takes the width, Stage sits at its end. The cases list's
                  toolbar grammar: no visible label over the box, the label kept
                  for screen readers and voice. */}
              <div className="flex flex-col gap-3 @lg/access:flex-row">
                <Field className="min-w-0 flex-1 gap-0">
                  <FieldLabel className="sr-only">
                    {pick(peopleCopy.caseSearchLabel, locale)}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <SearchIcon aria-hidden />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="search"
                      autoComplete="off"
                      placeholder={pick(copy.searchPlaceholder, locale)}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </InputGroup>
                </Field>
                {/* Several stages at once (owner, Oct 23). "All stages" sits over a
                    hairline: it is the absence of the others, so ticking it
                    clears them and ticking any stage clears it. The menu keeps
                    to the room on screen and scrolls inside it. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`${pick(copy.stageLabel, locale)}: ${stageSummary}`}
                      className={cn(
                        "w-full justify-between font-normal @lg/access:w-56",
                        // Teal while open too: the outline button's own open
                        // fill otherwise covers it until the menu closes.
                        stages.length > 0 &&
                          cn(
                            FILTER_ON,
                            "aria-expanded:bg-brand-muted aria-expanded:text-brand-muted-foreground",
                          ),
                      )}
                    >
                      <span className="truncate">{stageSummary}</span>
                      <ChevronDownIcon
                        aria-hidden
                        className="text-muted-foreground"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={4}
                    collisionPadding={16}
                    className="w-(--radix-dropdown-menu-trigger-width)"
                  >
                    <DropdownMenuCheckboxItem
                      checked={stages.length === 0}
                      onSelect={(event) => event.preventDefault()}
                      onCheckedChange={() => setStages([])}
                    >
                      {pick(copy.stageAll, locale)}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {STAGE_OPTIONS.map((value) => (
                      <DropdownMenuCheckboxItem
                        key={value}
                        checked={stages.includes(value)}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(on) =>
                          setStages((current) =>
                            on
                              ? STAGE_OPTIONS.filter(
                                  (v) => v === value || current.includes(v),
                                )
                              : current.filter((v) => v !== value),
                          )
                        }
                      >
                        {stageFilterLabel(value, locale)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* --------------------------------------------------- cases */}
              {visible.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-12 text-center text-body-compact text-muted-foreground">
                  {pick(copy.noCases, locale)}
                </p>
              ) : (
                <>
                  {/* The table needs room: a mouse and a dialog body at least 768px
                      wide (the dialog sits beside the rail, so the screen's width
                      says little). Touch, or a narrower dialog, gets the list. */}
                  <div className="flex flex-col gap-6 pointer-fine:@3xl/access:hidden">
                    {groups.map((group) => (
                      <section
                        key={group.key}
                        aria-labelledby={`access-group-${group.key}`}
                      >
                        <GroupLabel
                          id={`access-group-${group.key}`}
                          label={pick(group.label, locale)}
                          count={group.entries.length}
                          className="rounded-lg bg-surface-sunken px-3 py-2"
                        />
                        <ul className="flex flex-col divide-y divide-hairline">
                          {group.entries.map((entry) => (
                            <li key={entry.id}>
                              <CaseRow
                                entry={entry}
                                locale={locale}
                                checked={ticked.has(entry.id)}
                                held={saved.has(entry.id)}
                                since={
                                  person.grants.find(
                                    (g) => g.caseId === entry.id,
                                  )?.since
                                }
                                onCheck={(value) => toggleCase(entry.id, value)}
                                onOpen={() => go(openCaseHref(entry))}
                              />
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>

                  <div className="hidden pointer-fine:@3xl/access:block">
                    <Table
                      className="w-full border-separate border-spacing-0"
                      aria-labelledby="person-access-cases"
                    >
                      <TableHeader>
                        <TableRow className={TABLE_HEAD_ROW}>
                          <TableHead className={cn(TABLE_HEAD, "w-12 px-1")}>
                            {/* The rows in view only. "All cases" above speaks for the docket. */}
                            <div className="flex justify-center">
                              <Checkbox
                                checked={headerState}
                                onCheckedChange={(value) =>
                                  setMany(
                                    visible.map((c) => c.id),
                                    value === true,
                                  )
                                }
                                aria-label={fillCopy(
                                  headerState === true
                                    ? copy.clearShown
                                    : copy.selectShown,
                                  locale,
                                  { count: String(visible.length) },
                                )}
                              />
                            </div>
                          </TableHead>
                          <TableHead className={TABLE_HEAD}>
                            {pick(copy.columnCase, locale)}
                          </TableHead>
                          <TableHead className={cn(TABLE_HEAD, "w-48")}>
                            {pick(copy.columnStage, locale)}
                          </TableHead>
                          <TableHead className={cn(TABLE_HEAD, "w-48")}>
                            {pick(copy.columnAccess, locale)}
                          </TableHead>
                          <TableHead className={cn(TABLE_HEAD, "w-12 px-1")}>
                            <span className="sr-only">
                              {pick(peopleCopy.openCase, locale)}
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className={tableBodyClass()}>
                        {groups.map((group, index) => (
                          <React.Fragment key={group.key}>
                            {/* The group's name as a row of its own: the cases
                                they have, then the ones that can be given. */}
                            <TableRow
                              className={tableRowClass({ hover: false })}
                            >
                              <TableCell
                                colSpan={5}
                                className={cn(
                                  TABLE_CELL,
                                  "h-auto px-3 pb-2",
                                  index ? "pt-8" : "pt-4",
                                )}
                              >
                                <GroupLabel
                                  label={pick(group.label, locale)}
                                  count={group.entries.length}
                                />
                              </TableCell>
                            </TableRow>
                            {group.entries.map((entry) => (
                              <CaseTableRow
                                key={entry.id}
                                entry={entry}
                                locale={locale}
                                checked={ticked.has(entry.id)}
                                held={saved.has(entry.id)}
                                since={
                                  person.grants.find(
                                    (g) => g.caseId === entry.id,
                                  )?.since
                                }
                                onCheck={(value) => toggleCase(entry.id, value)}
                                onOpen={() => go(openCaseHref(entry))}
                              />
                            ))}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </section>
          </div>

          {/* ------------------------------------------------------- footer */}
          {/* The bail dialog's footer: the sunken well under a hairline. */}
          <div className="flex shrink-0 flex-col gap-3 border-t border-hairline bg-surface-sunken px-6 py-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:pb-4">
            <p
              className={cn(
                "flex min-h-10 flex-wrap items-center gap-x-2 text-body-compact text-muted-foreground tabular-nums",
                // Nothing pending: no empty line over the buttons on a phone.
                pending.length === 0 && "max-sm:hidden",
              )}
              aria-live="polite"
            >
              {/* How many cases they have now, then what Save will change. */}
              {pending.map((part, index) => (
                <React.Fragment key={part.text}>
                  {index ? <span aria-hidden>·</span> : null}
                  <span
                    className={cn(
                      part.tone && "font-medium",
                      part.tone === "add" && "text-success-ink",
                      part.tone === "remove" && "text-destructive-ink",
                    )}
                  >
                    {part.text}
                  </span>
                </React.Fragment>
              ))}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={requestClose}
              >
                {pick(peopleCopy.removeAllCancel, locale)}
              </Button>
              <Button
                type="button"
                className="flex-1 sm:flex-none"
                // A person's access has nothing to save until something
                // changes; Add person always answers, pointing at what is
                // missing.
                disabled={adding ? false : !canSave}
                onClick={save}
              >
                {saveLabel}
              </Button>
            </div>
          </div>
        </FlowDialogContent>
      </Dialog>

      {/* ---------------------------------------------------- confirm save */}
      {/* Wider than the DS default so the heading holds one line, and a
          hairline under the heading the way the footer has one over it
          (owner, Oct 23). */}
      <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
        <ChromeAlertDialogContent className={CONFIRM_CONTENT}>
          <AlertDialogHeader className={CONFIRM_HEADER}>
            {/* A quiet line under the heading when the save reaches cases the
                filter is hiding: context, not a change, so not a point. */}
            <div className={CONFIRM_HEAD_BLOCK}>
              <AlertDialogTitle className="text-body font-semibold text-pretty">
                {confirmTitle}
              </AlertDialogTitle>
              {/* Whenever a filter is on at save, not only when it hides a
                  change: the advocate picked from a narrowed list, so it is
                  worth a second look (owner, Oct 23). Warning ink to catch the
                  eye; the words carry it, not the colour. */}
              {filtered ? (
                <p className="text-caption font-medium text-warning-ink">
                  {pick(copy.confirmOutsideFilter, locale)}
                </p>
              ) : null}
            </div>
            <AlertDialogDescription asChild>
              <ul className="flex w-full flex-col gap-2 text-left text-pretty">
                {confirmPoints.map((point) => (
                  <li
                    key={point.key}
                    className={cn(
                      "grid grid-cols-[--spacing(4)_minmax(0,1fr)] items-baseline gap-x-2",
                      point.note ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {/* One marker column for every point, so the words line up.
                        The sign carries the colour; the words say it too. */}
                    <span
                      aria-hidden
                      className={cn(
                        "text-center font-semibold",
                        point.sign === "+" && "text-success-ink",
                        point.sign === "−" && "text-destructive-ink",
                        !point.sign && "text-muted-foreground",
                      )}
                    >
                      {point.sign ?? "•"}
                    </span>
                    <span>{point.text}</span>
                  </li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {pick(peopleCopy.removeAllCancel, locale)}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={confirmTakesAway ? "destructive" : "default"}
              onClick={apply}
            >
              {saveLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>

      {/* ----------------------------------------------- remove from office */}
      <AlertDialog open={confirmRemoveAll} onOpenChange={setConfirmRemoveAll}>
        <ChromeAlertDialogContent className={CONFIRM_CONTENT}>
          <AlertDialogHeader className={CONFIRM_HEADER}>
            <AlertDialogTitle className={CONFIRM_TITLE}>
              {fillCopy(peopleCopy.removeAllTitle, locale, {
                name: person.name,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {fillCopy(peopleCopy.removeAllBody, locale, {
                count: String(saved.size),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {pick(peopleCopy.removeAllCancel, locale)}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                removeAll(person.id);
                setDraft(null);
                toast.success(
                  fillCopy(peopleCopy.removedAllNote, locale, {
                    name: person.name,
                  }),
                );
                onOpenChange(false);
              }}
            >
              {pick(peopleCopy.removeAllConfirm, locale)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>

      {/* ------------------------------------------- leave with unsaved ticks */}
      <AlertDialog
        open={leave !== null}
        onOpenChange={(next) => {
          if (!next) setLeave(null);
        }}
      >
        <ChromeAlertDialogContent className={CONFIRM_CONTENT}>
          <AlertDialogHeader className={CONFIRM_HEADER}>
            <AlertDialogTitle className={CONFIRM_TITLE}>
              {pick(copy.leaveTitle, locale)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {adding
                ? pick(copy.leaveBodyAdd, locale)
                : fillCopy(copy.leaveBody, locale, { name: person.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {pick(copy.leaveCancel, locale)}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = leave;
                setDraft(null);
                setLeave(null);
                onOpenChange(false);
                if (target?.to === "href") router.push(target.href);
              }}
            >
              {pick(copy.leaveConfirm, locale)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** The access cell: when it was given, or what Save will do to it. Words, never colour alone. */
function AccessState({
  locale,
  checked,
  held,
  since,
  dateOnly = false,
  labelled = false,
}: {
  locale: Locale;
  checked: boolean;
  held: boolean;
  since?: string;
  /** Under the table's "Access granted" heading the date stands alone; the
      phone list has no heading, so it keeps "Since". */
  dateOnly?: boolean;
  /** In a list, where no column heading names the date. */
  labelled?: boolean;
}) {
  if (checked && !held) {
    return <Badge variant="success">{pick(copy.willAdd, locale)}</Badge>;
  }
  if (!checked && held) {
    return <Badge variant="destructive">{pick(copy.willRemove, locale)}</Badge>;
  }
  if (held && since) {
    return (
      <span className="text-muted-foreground">
        {labelled ? (
          <>
            {pick(copy.columnAccess, locale)}
            <span aria-hidden> · </span>
            <span className="text-foreground">{since}</span>
          </>
        ) : dateOnly ? (
          since
        ) : (
          fillCopy(copy.since, locale, { date: since })
        )}
      </span>
    );
  }
  // Under "No access yet" the group heading already says it.
  return null;
}

/** One case in the table. The whole row ticks; its own controls keep their clicks. */
function CaseTableRow({
  entry,
  locale,
  checked,
  held,
  since,
  onCheck,
  onOpen,
}: {
  entry: AccessCase;
  locale: Locale;
  checked: boolean;
  held: boolean;
  since?: string;
  onCheck: (on: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <TableRow
      className={cn(tableRowClass(), "cursor-pointer")}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a, [role=checkbox]"))
          return;
        onCheck(!checked);
      }}
    >
      <TableCell className={cn(TABLE_CELL, "w-12 px-1")}>
        <div className="flex justify-center">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onCheck(value === true)}
            aria-label={fillCopy(copy.selectCase, locale, {
              case: caseLabel(entry),
            })}
          />
        </div>
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "min-w-64 whitespace-normal")}>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-pretty">{entry.title}</span>
          <CaseMeta entry={entry} locale={locale} />
        </div>
      </TableCell>
      <TableCell
        className={cn(TABLE_CELL, "whitespace-nowrap text-muted-foreground")}
      >
        {stageText(entry, locale)}
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
        <AccessState
          locale={locale}
          checked={checked}
          held={held}
          since={since}
          dateOnly
        />
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "w-12 px-1")}>
        <div className="flex justify-center">
          <OpenCaseButton entry={entry} locale={locale} onOpen={onOpen} />
        </div>
      </TableCell>
    </TableRow>
  );
}

/** A group's name and how many cases it holds, over its rows. */
function GroupLabel({
  id,
  label,
  count,
  className,
}: {
  id?: string;
  label: string;
  count: number;
  className?: string;
}) {
  return (
    <h4
      id={id}
      className={cn(
        "flex items-center gap-2 text-body-compact font-semibold",
        className,
      )}
    >
      {label}
      <Badge variant="secondary" className="tabular-nums">
        {count}
      </Badge>
    </h4>
  );
}

/**
 * The way into a case from its row. Named in a tooltip, since it is an icon
 * alone. Its hover is a white chip with a hairline: the row under the pointer
 * already wears the warm sunken fill, and the ghost button's own hover is a
 * step of the same grey, so it vanished against it (owner, Oct 23).
 */
function OpenCaseButton({
  entry,
  locale,
  onOpen,
  className,
  touch = false,
}: {
  entry: AccessCase;
  locale: Locale;
  onOpen: () => void;
  className?: string;
  /** Under a finger: the 40px button, the DS touch floor. */
  touch?: boolean;
}) {
  // The tooltip says the act; the row already says which case. Screen
  // readers get the case too, since they do not see the row around it.
  const act = pick(entry.draft ? copy.openDraft : peopleCopy.openCase, locale);
  const label = `${act}: ${caseLabel(entry)}`;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={touch ? "icon" : "icon-sm"}
            aria-label={label}
            onClick={onOpen}
            className={cn(
              "border border-transparent hover:border-hairline hover:bg-card",
              className,
            )}
          >
            <ExternalLinkIcon aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{act}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Under a case's name: its number, or that it is a draft not filed yet. */
function CaseMeta({ entry, locale }: { entry: AccessCase; locale: Locale }) {
  return (
    <span className="text-caption text-muted-foreground">
      {entry.draft ? (
        pick(copy.notFiled, locale)
      ) : (
        <Identifier value={entry.caseNumber} label="case number" />
      )}
    </span>
  );
}

/**
 * One case: the tick, the title with its number and stage under it, what Save
 * will do or since when they have it, and a way into the case. The whole row
 * ticks, the way a label does; its own controls keep their clicks.
 */
function CaseRow({
  entry,
  locale,
  checked,
  held,
  since,
  onCheck,
  onOpen,
}: {
  entry: AccessCase;
  locale: Locale;
  checked: boolean;
  held: boolean;
  since?: string;
  onCheck: (on: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <div
      className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-4 transition-colors hover:bg-accent"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a, [role=checkbox]"))
          return;
        onCheck(!checked);
      }}
    >
      <Checkbox
        className="mt-0.5"
        checked={checked}
        onCheckedChange={(value) => onCheck(value === true)}
        aria-label={fillCopy(copy.selectCase, locale, {
          case: caseLabel(entry),
        })}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 @lg/access:flex-row @lg/access:items-start @lg/access:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-body-compact font-medium text-pretty">
            {entry.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
            <CaseMeta entry={entry} locale={locale} />
            <span aria-hidden>·</span>
            <span>{stageText(entry, locale)}</span>
          </span>
        </div>
        {/* A list has no column heading, so the date carries its own label,
            "Access granted", on a line set apart from the case's number and
            stage (owner, Oct 23). Beside the case on a wide list. */}
        <div className="mt-2 shrink-0 text-caption empty:hidden @lg/access:mt-0 @lg/access:pt-0.5 @lg/access:text-right">
          <AccessState
            locale={locale}
            checked={checked}
            held={held}
            since={since}
            labelled
          />
        </div>
      </div>
      <OpenCaseButton
        entry={entry}
        locale={locale}
        onOpen={onOpen}
        touch
        className="-my-2"
      />
    </div>
  );
}
