"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmMark, notify } from "@/components/feedback";
import {
  ChevronDownIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FolderCheckIcon,
  FolderKeyIcon,
  LayersIcon,
  ListChecksIcon,
  InfoIcon,
  SearchXIcon,
  SearchIcon,
  UserXIcon,
  XIcon,
} from "lucide-react";

import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { FlowStepper } from "@/components/cases/flow-stepper";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
  registeredUserByPhone,
  type AccessCase,
  type AccessPerson,
} from "@/lib/access/content";
import { ACTIVE_STAGES, stageLabel, type CounselSide } from "@/lib/cases/types";
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
 * Access is one choice first (owner, Oct 24): All cases (every case now and
 * every new one) or Specific cases. Only Specific cases opens the case table,
 * so the long list is never the first thing on screen.
 *
 * On a phone it is the flow window: the whole screen, in from the right.
 */

/** One stage the filter can hold. None held means all stages. */
type StageValue =
  "draft" | "disposed" | (typeof ACTIVE_STAGES)[number]["value"];

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

/** All cases, or only the cases ticked. */
type Mode = "all" | "specific";

/** Specific cases, split by what is saved: the ones they have, the rest. */
type AccessTab = "held" | "other";

/** Add person's two steps (owner, Oct 26): who, then what they can access. */
type AddStep = 1 | 2;

/** An act waiting on its confirmation. */
type Act = "remove" | "give" | "all" | "specific";

/** What the list is being edited towards. `null` means no edits yet. */
type Draft = { ticked: Set<string>; mode: Mode };

/** The representation filter: one side, or both when `null`. */
type SideValue = CounselSide | null;

function sideText(entry: AccessCase, locale: Locale): string {
  if (entry.side === "accused") return pick(copy.sideAccused, locale);
  if (entry.side === "complainant") return pick(copy.sideComplainant, locale);
  return "—";
}

/** An advocate's Bar ID, from the person or, failing that, their account. */
function barIdOf(person: AccessPerson): string | undefined {
  return person.barId ?? registeredUserByPhone(person.phone)?.barId;
}

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
  /* The whole registry, the office marked: people already in it show greyed
     when searched, so the search says why they can't be added (owner, Oct
     26). Their access is changed from their own row on People. */
  const known = directoryOptions(office.map((p) => p.phone));
  const outside = known.filter((option) => !option.inOffice);
  /* Demo only (Anshumanth, Oct 26): two whole numbers and a Bar ID of people
     not in the office yet, and the name of someone who is, so every kind of
     search has something to find. Remove with the demo registry. */
  const examples = [
    outside.find((option) => option.type === "advocate")?.phone,
    outside.find((option) => option.type === "clerk")?.phone,
    outside.filter((option) => option.barId)[1]?.barId,
    known.find((option) => option.inOffice)?.name,
  ].filter((value): value is string => Boolean(value));
  const [addStep, setAddStep] = React.useState<AddStep>(1);

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const [query, setQuery] = React.useState("");
  /* Several stages at once, as the cases list filters them; none is all. */
  const [stages, setStages] = React.useState<StageValue[]>([]);
  const [side, setSide] = React.useState<SideValue>(null);
  const [confirmSave, setConfirmSave] = React.useState(false);
  const [confirmRemoveAll, setConfirmRemoveAll] = React.useState(false);
  /** Unsaved ticks asked about before the dialog closes or a case opens. */
  const [leave, setLeave] = React.useState<Leave | null>(null);
  /* A person's own access (lead designer, Oct 26): the open tab, the cases
     selected in it, and the act waiting on its confirmation. */
  const [tab, setTab] = React.useState<AccessTab>("held");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [act, setAct] = React.useState<Act | null>(null);

  const saved = React.useMemo(
    () => new Set(live?.grants.map((g) => g.caseId) ?? []),
    [live],
  );
  const savedFuture = Boolean(live?.allCases);
  const ticked = draft?.ticked ?? saved;

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
  /* All cases or Specific cases (owner, Oct 24). Add person starts with
     neither, so the choice is made, not defaulted. */
  const mode: Mode | null =
    draft?.mode ?? (savedFuture ? "all" : live ? "specific" : null);
  const future = mode === "all";

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
    if (side && entry.side !== side) return false;
    // On what is saved, so unticking a row does not make it vanish.
    return true;
  });
  const adds = shareableCases.filter(
    (c) => ticked.has(c.id) && !saved.has(c.id),
  );
  const removes = shareableCases.filter(
    (c) => !ticked.has(c.id) && saved.has(c.id),
  );
  const futureChanged = future !== savedFuture;
  /* A search or a stage is narrowing the list. Saving from a narrowed list
     earns a note in the confirmation (owner, Oct 23). */
  const filtered = Boolean(needle) || stages.length > 0 || side !== null;
  const dirty = adding
    ? chosen.length > 0 || Boolean(draft)
    : Boolean(draft) && (!sameSet(ticked, saved) || futureChanged);
  /** Add person needs someone, and All cases or at least one case. */
  const hasAccess = future || tickedCount > 0;
  // Each clears the moment it is put right.
  const whoError = adding && tried && addStep === 1 && chosen.length === 0;
  const modeError = adding && tried && mode === null;
  const casesError =
    adding && tried && mode === "specific" && tickedCount === 0;

  /** Every tick goes through here. Ticks are Specific cases only. */
  function commit(next: Set<string>) {
    setDraft({ ticked: next, mode: "specific" });
  }

  /**
   * Add person's dropdown. The cases picked under Specific cases are kept
   * while All cases is on, so trying All and coming back loses nothing.
   */
  function chooseMode(next: Mode) {
    setDraft({ mode: next, ticked: draft?.ticked ?? new Set() });
    clearFilters();
  }

  /**
   * A new scope asks a new question, so the list starts unfiltered (owner,
   * Oct 26): a filter left on from Specific made All cases look like fewer.
   */
  function clearFilters() {
    setQuery("");
    setStages([]);
    setSide(null);
  }

  function toggleCase(caseId: string, on: boolean) {
    const next = new Set(ticked);
    if (on) next.add(caseId);
    else next.delete(caseId);
    commit(next);
  }

  function setMany(ids: string[], on: boolean) {
    const next = new Set(ticked);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    commit(next);
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
      if (future) invite(phones, [], { allCases: true });
      else
        invite(
          phones,
          shareableCases.filter((c) => ticked.has(c.id)).map((c) => c.id),
        );
      notify.success(
        chosen.length === 1
          ? pick(copy.addedToastOne, locale)
          : fillCopy(copy.addedToast, locale, {
              count: String(chosen.length),
            }),
      );
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
      notify.success(
        fillCopy(peopleCopy.removedAllNote, locale, { name: live.name }),
      );
      onOpenChange(false);
      return;
    }
    notify.success(fillCopy(copy.savedToast, locale, { name: live.name }));
  }

  /** Add person's Continue: who first, then on to their access. */
  function toAccess() {
    if (chosen.length === 0) {
      setTried(true);
      document.getElementById("person-access-who-field")?.focus();
      return;
    }
    setTried(false);
    setAddStep(2);
  }

  function save() {
    // Add person never greys its button out (owner, Oct 23): pressing it with
    // something missing points at what is missing instead.
    if (adding && !hasAccess) {
      setTried(true);
      if (mode === null) {
        document.getElementById("person-access-scope")?.focus();
      } else {
        document
          .getElementById("person-access-cases")
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      }
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

  /* ------------------------------------------- a person's own access */
  /* No Save (owner, Oct 26): each act applies on its own confirmation, the
     way Remove from office does, so nothing waits half done. */
  const heldTotal = shareableCases.filter((c) => saved.has(c.id)).length;
  const otherTotal = total - heldTotal;
  const inTab = (id: string) =>
    tab === "held" ? saved.has(id) : !saved.has(id);
  const tabRows = savedFuture ? visible : visible.filter((e) => inTab(e.id));
  /* Only what is still in this tab: a case that moved under the selection is
     not acted on from here. */
  const selectedIds = shareableCases
    .filter((c) => selected.has(c.id) && inTab(c.id))
    .map((c) => c.id);
  const leftAfterRemove = heldTotal - selectedIds.length;

  /* Add person's access step shares this list (owner, Oct 26): the same
     dropdown, tabs and selection line. Nobody has a case yet, so its tabs are
     Your cases and Selected, and a tick is the pick itself. */
  const listAll = adding ? mode === "all" : savedFuture;
  const listRows = adding ? visible : tabRows;
  const listChecked = (id: string) =>
    adding ? ticked.has(id) : selected.has(id);
  const listCount = adding ? tickedCount : selectedIds.length;
  const listShownChecked = listRows.filter((e) => listChecked(e.id)).length;
  const listSelectState: boolean | "indeterminate" =
    listShownChecked === 0
      ? false
      : listShownChecked === listRows.length
        ? true
        : "indeterminate";

  function listCheck(id: string, on: boolean) {
    if (adding) toggleCase(id, on);
    else select(id, on);
  }

  function listSelectShown(on: boolean) {
    if (adding)
      setMany(
        listRows.map((e) => e.id),
        on,
      );
    else selectShown(on);
  }

  function clearSelection() {
    if (adding) commit(new Set());
    else setSelected(new Set());
  }

  function select(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function selectShown(on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      tabRows.forEach((e) => (on ? next.add(e.id) : next.delete(e.id)));
      return next;
    });
  }

  function switchTab(next: AccessTab) {
    setTab(next);
    setSelected(new Set());
  }

  /**
   * The dropdown. Either way it asks first, in the same points (owner, Oct
   * 26): All gives every case and new ones; Specific keeps their cases and
   * stops new ones.
   */
  function chooseScope(next: Mode) {
    if (!live || next === (savedFuture ? "all" : "specific")) return;
    setAct(next);
  }

  function doAct() {
    if (!live || !act) return;
    const name = live.name;
    if (act === "remove") {
      selectedIds.forEach((id) => removeGrant(live.id, id));
      if (leftAfterRemove === 0) {
        // No case left: they leave the office, and the dialog with them.
        notify.success(fillCopy(peopleCopy.removedAllNote, locale, { name }));
        onOpenChange(false);
      } else {
        notify.success(fillCopy(copy.savedToast, locale, { name }));
      }
    } else if (act === "give") {
      invite([live.phone], selectedIds);
      notify.success(fillCopy(copy.savedToast, locale, { name }));
    } else if (act === "specific") {
      setAllCases(live.id, false);
      setTab("held");
      clearFilters();
      notify.success(fillCopy(copy.savedToast, locale, { name }));
    } else {
      setAllCases(live.id, true);
      clearFilters();
      notify.success(fillCopy(copy.savedToast, locale, { name }));
    }
    setSelected(new Set());
    setAct(null);
  }

  if (!person) return null;
  const stageSummary =
    stages.length === 0
      ? pick(copy.stageAll, locale)
      : stages.length === 1
        ? stageFilterLabel(stages[0], locale)
        : `${stageFilterLabel(stages[0], locale)} +${stages.length - 1}`;
  const role = designation(person, locale);
  const barId = barIdOf(person);
  const sideSummary = side
    ? pick(side === "accused" ? copy.sideAccused : copy.sideComplainant, locale)
    : pick(copy.sideAll, locale);
  /* The save confirmation (owner, Oct 23): one heading and one button for
     every save, the changes as points under it. The button turns red when
     the save takes access away. */
  const futureOff = futureChanged && !future;
  const confirmTakesAway = removes.length > 0 || futureOff;
  const confirmTitle = adding
    ? chosen.length === 1
      ? pick(copy.addConfirmTitleOne, locale)
      : fillCopy(copy.addConfirmTitle, locale, {
          count: String(chosen.length),
        })
    : fillCopy(copy.confirmTitle, locale, { name: person.name });
  const saveLabel = pick(adding ? copy.addAction : copy.save, locale);
  const casesWord = (count: number, one: Copy, many: Copy) =>
    count === 1
      ? pick(one, locale)
      : fillCopy(many, locale, { count: String(count) });
  /* The act's confirmation, in the points the save used to show: + gives in
     the success ink, − takes in the destructive ink, the words saying it too. */
  const actName = { name: displayName(person) };
  const actTitle =
    act === "remove"
      ? fillCopy(copy.removeTitle, locale, actName)
      : act === "give"
        ? fillCopy(copy.giveTitle, locale, actName)
        : act === "specific"
          ? fillCopy(copy.specificTitle, locale, actName)
          : fillCopy(copy.allTitle, locale, actName);
  const actPoints: { key: string; sign?: "+" | "−"; text: string }[] =
    act === "remove"
      ? [
          {
            key: "remove",
            sign: "−",
            text: casesWord(
              selectedIds.length,
              copy.pointRemoveOne,
              copy.pointRemove,
            ),
          },
          ...(leftAfterRemove === 0
            ? [{ key: "leave", text: pick(copy.confirmLeave, locale) }]
            : []),
        ]
      : act === "give"
        ? [
            {
              key: "give",
              sign: "+",
              text: casesWord(
                selectedIds.length,
                copy.pointAddOne,
                copy.pointAdd,
              ),
            },
          ]
        : act === "specific"
          ? [
              {
                key: "future",
                sign: "−" as const,
                text: pick(copy.confirmFutureOff, locale),
              },
              {
                key: "keep",
                text: fillCopy(copy.pointKeep, locale, {
                  count: String(heldTotal),
                }),
              },
            ]
        : [
            ...(otherTotal
              ? [
                  {
                    key: "give",
                    sign: "+" as const,
                    text: casesWord(
                      otherTotal,
                      copy.pointAddOne,
                      copy.pointAdd,
                    ),
                  },
                ]
              : []),
            {
              key: "future",
              sign: "+" as const,
              text: pick(copy.confirmFutureOn, locale),
            },
          ];
  const actLabel = pick(
    act === "remove"
      ? copy.removeAccess
      : act === "give"
        ? copy.giveAccess
        : act === "specific"
          ? copy.specificAction
          : copy.allAction,
    locale,
  );
  const confirmPoints: {
    key: string;
    sign?: "+" | "−";
    text: string;
    note?: boolean;
  }[] = adding
    ? future
      ? [
          {
            key: "all",
            sign: "+",
            text: fillCopy(copy.pointAddAll, locale, { count: String(total) }),
          },
          { key: "future-on", sign: "+", text: pick(copy.confirmFutureOn, locale) },
        ]
      : [
          {
            key: "add",
            sign: "+",
            text: casesWord(tickedCount, copy.pointAddOne, copy.pointAdd),
          },
        ]
    : [
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
  const addSteps = [
    { step: 1, title: pick(copy.stepPeople, locale) },
    { step: 2, title: pick(copy.stepAccess, locale) },
  ];

  /* Search, Stage and Representation: one toolbar for every case list here. */
  const toolbar = (
    <>
      {/* Search takes the width, Stage sits at its end. The cases list's
                  toolbar grammar: no visible label over the box, the label kept
                  for screen readers and voice. */}
      <div className="flex flex-col gap-3 @3xl/access:flex-row">
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
        {/* The filters share a row under the search until all three fit
            on one line, so the search is never squeezed (iPad mini). */}
        <div className="grid grid-cols-2 gap-3 @3xl/access:flex @3xl/access:shrink-0">
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
                "w-full justify-between font-normal @3xl/access:w-56",
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
              <ChevronDownIcon aria-hidden className="text-muted-foreground" />
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
        {/* Which side the advocate is for in the case (owner, Oct 24). */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label={`${pick(copy.sideLabel, locale)}: ${sideSummary}`}
              className={cn(
                "w-full justify-between font-normal @3xl/access:w-56",
                side !== null &&
                  cn(
                    FILTER_ON,
                    "aria-expanded:bg-brand-muted aria-expanded:text-brand-muted-foreground",
                  ),
              )}
            >
              <span className="truncate">{sideSummary}</span>
              <ChevronDownIcon aria-hidden className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={4}
            collisionPadding={16}
            className="w-(--radix-dropdown-menu-trigger-width)"
          >
            <DropdownMenuRadioGroup
              value={side ?? "all"}
              onValueChange={(value) =>
                setSide(value === "all" ? null : (value as CounselSide))
              }
            >
              <DropdownMenuRadioItem value="all">
                {pick(copy.sideAll, locale)}
              </DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value="complainant">
                {pick(copy.sideComplainant, locale)}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="accused">
                {pick(copy.sideAccused, locale)}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </>
  );

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
            <>
              {/* The Add Power of Attorney holder dialog's step band (owner,
                  Oct 26), centred on its own line under a hairline. */}
              <div className="relative shrink-0 border-b border-hairline px-14 pt-6 pb-4">
                {/* One heading per step, in the body (owner, Oct 26). */}
                <DialogTitle className="sr-only">
                  {pick(copy.addTitle, locale)}
                </DialogTitle>
                <div className="mx-auto max-w-md">
                  <FlowStepper
                    steps={addSteps}
                    current={addStep}
                    label={pick(copy.addProgress, locale)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  ref={closeRef}
                  aria-label={pick(copy.close, locale)}
                  onClick={requestClose}
                  className="absolute top-3 right-3 pointer-coarse:size-10"
                >
                  <XIcon aria-hidden />
                </Button>
              </div>
            </>
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
                    {barId ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="flex items-baseline gap-1.5">
                          {pick(peopleCopy.barIdLabel, locale)}
                          <Identifier
                            value={barId}
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
              {pick(adding ? copy.casesIntro : copy.casesSection, locale)}
            </DialogDescription>

            {adding && addStep === 1 ? (
              <section
                aria-labelledby="person-access-who"
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col gap-1">
                  <h3
                    id="person-access-who"
                    className="text-body font-semibold"
                  >
                    {pick(copy.peopleHeading, locale)}
                  </h3>
                  <p className="text-body-compact text-pretty text-muted-foreground">
                    {pick(copy.addIntro, locale)}
                  </p>
                </div>
                <Field data-invalid={whoError || undefined} className="gap-2">
                  <PeopleInviteField
                    id="person-access-who-field"
                    label={pick(inviteFieldCopy.placeholder, locale)}
                    known={known}
                    value={chosen}
                    onValueChange={setChosen}
                    locale={locale}
                    registeredOnly
                    officeTaken
                    invalid={whoError}
                    describedBy={
                      whoError ? "person-access-who-error" : undefined
                    }
                  />
                  <FieldError id="person-access-who-error">
                    {whoError ? pick(copy.needPerson, locale) : null}
                  </FieldError>
                  {examples.length ? (
                    <p className="text-caption text-pretty text-muted-foreground">
                      {pick(copy.examplesLabel, locale)}{" "}
                      {examples.map((example, index) => (
                        <React.Fragment key={example}>
                          {index ? <span aria-hidden> · </span> : null}
                          <span className="font-medium text-foreground tabular-nums">
                            {example}
                          </span>
                        </React.Fragment>
                      ))}
                    </p>
                  ) : null}
                </Field>
              </section>
            ) : null}

            {/* Who has what, and changing it (lead designer, Oct 26): the
                dropdown names the scope, the tabs split the cases, a tick
                only selects. Add person's access step is the same list. */}
            {adding && addStep === 1 ? null : (
              <section
                aria-labelledby="person-access-cases"
                className={cn(
                  "flex flex-col gap-6",
                  // Room for the prompt to sit in the middle of the body.
                  adding && mode === null && "flex-1",
                )}
              >
                {/* The heading and the scope on one line, phones too: the
                    dropdown names what they have and changes it. */}
                <div className="flex flex-col gap-1">
                {/* Add people stacks the heading over the dropdown until the
                    dialog is wide (phones, iPad mini upright), where a side by
                    side pair read cramped (owner, Oct 26). */}
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-2",
                    adding &&
                      "flex-col items-stretch @3xl/access:flex-row @3xl/access:items-center",
                  )}
                >
                  <h3
                    id="person-access-cases"
                    className="text-body font-semibold"
                  >
                    {pick(adding ? copy.accessHeading : copy.casesSection, locale)}
                  </h3>
                  <Select
                    value={
                      adding ? (mode ?? "") : savedFuture ? "all" : "specific"
                    }
                    onValueChange={(value) =>
                      adding
                        ? chooseMode(value as Mode)
                        : chooseScope(value as Mode)
                    }
                  >
                    <SelectTrigger
                      id="person-access-scope"
                      aria-label={pick(copy.scopeLabel, locale)}
                      aria-invalid={modeError || undefined}
                      aria-describedby={
                        modeError ? "person-access-scope-error" : undefined
                      }
                      className={cn(
                        "min-w-44 flex-1 font-medium @md/access:flex-none",
                        adding &&
                          "order-2 w-full @3xl/access:order-none @3xl/access:w-auto",
                        /* The scope stands out by ink and an icon, never by
                           size or a fill (owner, Oct 26): a teal fill means a
                           filter is on. Unchosen in Add people, a teal edge. */
                        "font-semibold text-brand-muted-foreground data-placeholder:font-medium",
                        adding &&
                          mode === null &&
                          !modeError &&
                          "border-brand-accent",
                      )}
                    >
                      <SelectValue
                        placeholder={pick(copy.scopePlaceholder, locale)}
                      />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {/* The icon shows in the trigger too, so the scope reads
                          at a glance. */}
                      <SelectItem value="all">
                        <LayersIcon aria-hidden className="text-brand-muted-foreground" />
                        {pick(copy.allCases, locale)}
                      </SelectItem>
                      <SelectItem value="specific">
                        <ListChecksIcon aria-hidden className="text-brand-muted-foreground" />
                        {pick(copy.specificCases, locale)}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Said once for everyone being added, never as a list of
                      names (owner, Oct 26). Stacked, it sits between the
                      heading and the dropdown; side by side, under both. */}
                  {/* Only before a choice: once one is made, the note or the
                      list's own line says it (owner, Oct 26). */}
                  {adding && mode === null ? (
                    <p className="order-1 text-body-compact text-pretty text-muted-foreground @3xl/access:order-last @3xl/access:basis-full">
                      {pick(
                        chosen.length === 1
                          ? copy.accessIntroOne
                          : copy.accessIntro,
                        locale,
                      )}
                    </p>
                  ) : null}
                </div>
                </div>

                {modeError ? (
                  <p
                    id="person-access-scope-error"
                    role="alert"
                    className="-mt-4 text-body-compact text-destructive"
                  >
                    {pick(copy.needMode, locale)}
                  </p>
                ) : null}

                {adding && mode === null ? null : listAll ? (
                  /* All cases says plainly that new cases follow, and lists
                     what they can open. Nothing to select: to take a case
                     away, Specific cases first. */
                  <Alert variant="info" className="px-3 py-2.5">
                    <InfoIcon aria-hidden />
                    <AlertDescription className="text-body-compact text-pretty">
                      {adding
                        ? fillCopy(copy.futureNoteAdd, locale, {
                            count: String(total),
                          })
                        : fillCopy(copy.futureNote, locale, {
                            name: displayName(person),
                            count: String(total),
                          })}
                    </AlertDescription>
                  </Alert>
                ) : adding ? (
                  /* Where All cases puts its note (owner, Oct 26): what to
                     do with the list, over its search. */
                  <p className="text-body-compact text-pretty text-muted-foreground">
                    {pick(copy.accessIntroOne, locale)}
                  </p>
                ) : (
                  /* Two tabs, not two stacked groups: a long Has access
                     list buried the cases they do not have yet. */
                  <Tabs
                    value={tab}
                    onValueChange={(value) => switchTab(value as AccessTab)}
                  >
                    <TabsList
                      aria-label={pick(copy.casesTabs, locale)}
                      className="w-full group-data-horizontal/tabs:h-10"
                    >
                      <TabsTrigger value="held" className="px-3 text-body-compact">
                        {pick(copy.groupHeld, locale)}
                        <TabCount count={heldTotal} active={tab === "held"} />
                      </TabsTrigger>
                      <TabsTrigger value="other" className="px-3 text-body-compact">
                        {pick(copy.tabOther, locale)}
                        <TabCount count={otherTotal} active={tab === "other"} />
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}

                {casesError ? (
                  <p
                    role="alert"
                    className="-mt-4 text-body-compact text-destructive"
                  >
                    {pick(copy.needCases, locale)}
                  </p>
                ) : null}

                {adding && mode === null ? (
                  /* Not an empty state: a pointer to the dropdown, in the
                     middle where the eye lands when the body is bare (owner,
                     Oct 26). No button, so nothing is chosen by accident. */
                  <Empty className="flex-1 py-12">
                    <EmptyHeader className="max-w-md">
                      <EmptyMedia
                        variant="icon"
                        className="size-16 rounded-full bg-brand-muted text-brand-muted-foreground [&_svg:not([class*='size-'])]:size-8"
                      >
                        <FolderKeyIcon aria-hidden />
                      </EmptyMedia>
                      <EmptyTitle>{pick(copy.chooseAccessTitle, locale)}</EmptyTitle>
                      <EmptyDescription>
                        {pick(copy.chooseAccessBody, locale)}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : !adding &&
                  !savedFuture &&
                  tab === "other" &&
                  otherTotal === 0 ? (
                  <Empty className="py-16">
                    <EmptyHeader className="max-w-xl">
                      <EmptyMedia
                        variant="icon"
                        className="size-12 rounded-full bg-brand-muted text-brand-muted-foreground [&_svg:not([class*='size-'])]:size-6"
                      >
                        <FolderCheckIcon aria-hidden />
                      </EmptyMedia>
                      <EmptyTitle>
                        {fillCopy(copy.emptyOtherTitle, locale, {
                          name: displayName(person),
                        })}
                      </EmptyTitle>
                      <EmptyDescription>
                        {pick(copy.emptyOtherBody, locale)}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <div className="flex flex-col gap-4">
                    {toolbar}

                    {/* What is selected and the one act for it, on a plain
                        line over the list. It stays put: pinned, it slid over
                        the table's header (owner, Oct 26). */}
                    {!listAll && listRows.length > 0 ? (
                      <div className="flex min-h-10 items-center gap-3">
                        <p
                          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 text-body-compact text-muted-foreground"
                          aria-live="polite"
                        >
                          <span className="tabular-nums">
                            {listCount
                              ? casesWord(
                                  listCount,
                                  copy.selectedOne,
                                  copy.selectedMany,
                                )
                              : pick(
                                  adding
                                    ? copy.noneSelected
                                    : tab === "other"
                                      ? copy.selectHintOther
                                      : copy.selectHintHeld,
                                  locale,
                                )}
                          </span>
                          {listCount ? (
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 font-normal underline"
                              onClick={clearSelection}
                            >
                              {pick(copy.clearSelection, locale)}
                            </Button>
                          ) : null}
                        </p>
                        {/* Add person gives the picks with Add to office. */}
                        {!adding && selectedIds.length ? (
                          <Button
                            type="button"
                            variant={tab === "held" ? "destructive" : "default"}
                            onClick={() =>
                              setAct(tab === "held" ? "remove" : "give")
                            }
                          >
                            {pick(
                              tab === "held"
                                ? copy.removeAccess
                                : copy.giveAccess,
                              locale,
                            )}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    {listRows.length === 0 ? (
                      <Empty className="py-16">
                        <EmptyHeader className="max-w-xl">
                          <EmptyMedia
                            variant="icon"
                            className="size-12 rounded-full bg-muted [&_svg:not([class*='size-'])]:size-6"
                          >
                            <SearchXIcon aria-hidden />
                          </EmptyMedia>
                          <EmptyTitle>{pick(copy.noMatchTitle, locale)}</EmptyTitle>
                          <EmptyDescription>
                            {pick(copy.noMatchBody, locale)}
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={clearFilters}
                          >
                            {pick(copy.clearFilters, locale)}
                          </Button>
                        </EmptyContent>
                      </Empty>
                    ) : (
                      <>
                        <ul className="flex flex-col divide-y divide-hairline @3xl/access:hidden">
                          {listRows.map((entry) => (
                            <li key={entry.id}>
                              <CaseRow
                                entry={entry}
                                locale={locale}
                                checked={listChecked(entry.id)}
                                held={listChecked(entry.id)}
                                selectOnly
                                readOnly={listAll}
                                onCheck={(value) => listCheck(entry.id, value)}
                                onOpen={() => go(openCaseHref(entry))}
                              />
                            </li>
                          ))}
                        </ul>
                        <div className="hidden @3xl/access:block">
                          <Table
                            className="w-full border-separate border-spacing-0"
                            aria-labelledby="person-access-cases"
                          >
                            <TableHeader>
                              <TableRow className={TABLE_HEAD_ROW}>
                                {listAll ? null : (
                                  <TableHead
                                    className={cn(TABLE_HEAD, "w-12 px-1")}
                                  >
                                    <div className="flex justify-center">
                                      <Checkbox
                                        checked={listSelectState}
                                        onCheckedChange={(value) =>
                                          listSelectShown(value === true)
                                        }
                                        aria-label={fillCopy(
                                          copy.selectAllShown,
                                          locale,
                                          {
                                            count: String(listRows.length),
                                          },
                                        )}
                                      />
                                    </div>
                                  </TableHead>
                                )}
                                <TableHead className={cn(TABLE_HEAD, "w-44")}>
                                  {pick(copy.columnCaseNumber, locale)}
                                </TableHead>
                                <TableHead className={TABLE_HEAD}>
                                  {pick(copy.columnCase, locale)}
                                </TableHead>
                                <TableHead className={cn(TABLE_HEAD, "w-48")}>
                                  {pick(copy.columnStage, locale)}
                                </TableHead>
                                <TableHead className={cn(TABLE_HEAD, "w-44")}>
                                  {pick(copy.sideLabel, locale)}
                                </TableHead>
                                <TableHead
                                  className={cn(TABLE_HEAD, "w-12 px-1")}
                                >
                                  <span className="sr-only">
                                    {pick(peopleCopy.openCase, locale)}
                                  </span>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className={tableBodyClass()}>
                              {listRows.map((entry) => (
                                <CaseTableRow
                                  key={entry.id}
                                  entry={entry}
                                  locale={locale}
                                  checked={listChecked(entry.id)}
                                  held={listChecked(entry.id)}
                                  selectOnly
                                  readOnly={listAll}
                                  onCheck={(value) => listCheck(entry.id, value)}
                                  onOpen={() => go(openCaseHref(entry))}
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* ------------------------------------------------------- footer */}
          {/* The bail dialog's footer: the sunken well under a hairline. A
              person's own access has none: each act applies on its confirm. */}
          {adding ? (
            <div className="flex shrink-0 flex-col gap-3 border-t border-hairline bg-surface-sunken px-6 py-4 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:pb-4">
              {/* The PoA dialog's footer: Back on the left from step 2,
                  the step's one act on the right (owner, Oct 26). */}
              {addStep === 2 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="max-sm:order-last"
                  onClick={() => {
                    setTried(false);
                    setAddStep(1);
                  }}
                >
                  {pick(copy.back, locale)}
                </Button>
              ) : (
                <span aria-hidden className="hidden sm:block" />
              )}
              <Button
                type="button"
                onClick={addStep === 1 ? toAccess : save}
              >
                {pick(addStep === 1 ? copy.continueAction : copy.addAction, locale)}
              </Button>
            </div>
          ) : null}
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
              {filtered && !(adding && future) ? (
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

      {/* ------------------------------------------------- confirm an act */}
      <AlertDialog
        open={act !== null}
        onOpenChange={(next) => {
          if (!next) setAct(null);
        }}
      >
        <ChromeAlertDialogContent className={CONFIRM_CONTENT}>
          <AlertDialogHeader className={CONFIRM_HEADER}>
            <div className={CONFIRM_HEAD_BLOCK}>
              <AlertDialogTitle className="text-body font-semibold text-pretty">
                {actTitle}
              </AlertDialogTitle>
              {/* The save's filter warning, kept for Remove / Give access:
                  ticks outlive a filter change, so the selection can hold
                  cases the filters hide (owner, Oct 27). A scope switch acts
                  on every case, so it needs no warning. */}
              {filtered && (act === "remove" || act === "give") ? (
                <p className="text-caption font-medium text-warning-ink">
                  {pick(copy.confirmOutsideFilter, locale)}
                </p>
              ) : null}
            </div>
            <AlertDialogDescription asChild>
              <ul className="flex w-full flex-col gap-2 text-left text-pretty">
                {actPoints.map((point) => (
                  <li
                    key={point.key}
                    className="grid grid-cols-[--spacing(4)_minmax(0,1fr)] items-baseline gap-x-2 text-foreground"
                  >
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
              variant={
                act === "remove" || act === "specific"
                  ? "destructive"
                  : "default"
              }
              onClick={doAct}
            >
              {actLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>

      {/* ----------------------------------------------- remove from office */}
      <AlertDialog open={confirmRemoveAll} onOpenChange={setConfirmRemoveAll}>
        <ChromeAlertDialogContent>
          <AlertDialogHeader>
            <ConfirmMark danger icon={UserXIcon} />
            <AlertDialogTitle>
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
                notify.success(
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

/** What Save will do to a case, in words, never colour alone. Nothing when
    Save leaves it as it is. */
function PendingBadge({
  locale,
  checked,
  held,
}: {
  locale: Locale;
  checked: boolean;
  held: boolean;
}) {
  if (checked && !held) {
    return <Badge variant="success">{pick(copy.willAdd, locale)}</Badge>;
  }
  if (!checked && held) {
    return <Badge variant="destructive">{pick(copy.willRemove, locale)}</Badge>;
  }
  return null;
}

/** One case in the table. The whole row ticks; its own controls keep their clicks. */
function CaseTableRow({
  entry,
  locale,
  checked,
  held,
  selectOnly = false,
  readOnly = false,
  onCheck,
  onOpen,
}: {
  entry: AccessCase;
  locale: Locale;
  checked: boolean;
  held: boolean;
  /** The tick selects for an act; it says nothing about access. */
  selectOnly?: boolean;
  /** A list to look at: no tick, and the row does not select. */
  readOnly?: boolean;
  onCheck: (on: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <TableRow
      className={cn(tableRowClass({ hover: !readOnly }), !readOnly && "cursor-pointer")}
      onClick={(event) => {
        if (readOnly) return;
        if ((event.target as HTMLElement).closest("button, a, [role=checkbox]"))
          return;
        onCheck(!checked);
      }}
    >
      {readOnly ? null : (
        <TableCell className={cn(TABLE_CELL, "w-12 px-1")}>
          <div className="flex justify-center">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => onCheck(value === true)}
              aria-label={fillCopy(
                selectOnly ? copy.selectRow : copy.selectCase,
                locale,
                {
                  case: caseLabel(entry),
                },
              )}
            />
          </div>
        </TableCell>
      )}
      {/* Number and name in columns of their own (owner, Oct 24). */}
      <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
        <CaseMeta entry={entry} locale={locale} />
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "min-w-64 whitespace-normal")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-pretty">{entry.title}</span>
          <PendingBadge locale={locale} checked={checked} held={held} />
        </div>
      </TableCell>
      <TableCell
        className={cn(TABLE_CELL, "whitespace-nowrap text-muted-foreground")}
      >
        {stageText(entry, locale)}
      </TableCell>
      <TableCell
        className={cn(TABLE_CELL, "whitespace-nowrap text-muted-foreground")}
      >
        {sideText(entry, locale)}
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "w-12 px-1")}>
        <div className="flex justify-center">
          <OpenCaseButton entry={entry} locale={locale} onOpen={onOpen} />
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * A tab's count as a small pill (owner, Oct 26): the plain grey number was
 * lost. Teal on the open tab; white on the grey track for the other, since a
 * grey pill would vanish into it.
 */
function TabCount({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-caption font-medium tabular-nums",
        active
          ? "bg-brand-muted text-brand-muted-foreground"
          : "bg-card text-muted-foreground",
      )}
    >
      {count}
    </span>
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
function CaseMeta({
  entry,
  locale,
  className = "text-muted-foreground",
}: {
  entry: AccessCase;
  locale: Locale;
  className?: string;
}) {
  return (
    <span className={className}>
      {entry.draft ? (
        pick(copy.notFiled, locale)
      ) : (
        <Identifier value={entry.caseNumber} label="case number" />
      )}
    </span>
  );
}

/**
 * One case: the tick, the title with its number, stage and side under it, what Save
 * will do to it, and a way into the case. The whole row
 * ticks, the way a label does; its own controls keep their clicks.
 */
function CaseRow({
  entry,
  locale,
  checked,
  held,
  selectOnly = false,
  readOnly = false,
  onCheck,
  onOpen,
}: {
  entry: AccessCase;
  locale: Locale;
  checked: boolean;
  held: boolean;
  /** The tick selects for an act; it says nothing about access. */
  selectOnly?: boolean;
  /** A list to look at: no tick, and the row does not select. */
  readOnly?: boolean;
  onCheck: (on: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg px-3 py-4",
        !readOnly && "cursor-pointer transition-colors hover:bg-accent",
      )}
      onClick={(event) => {
        if (readOnly) return;
        if ((event.target as HTMLElement).closest("button, a, [role=checkbox]"))
          return;
        onCheck(!checked);
      }}
    >
      {readOnly ? null : (
        <Checkbox
          className="mt-0.5"
          checked={checked}
          onCheckedChange={(value) => onCheck(value === true)}
          aria-label={fillCopy(
            selectOnly ? copy.selectRow : copy.selectCase,
            locale,
            {
              case: caseLabel(entry),
            },
          )}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 @lg/access:flex-row @lg/access:items-start @lg/access:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-body-compact font-medium text-pretty">
            {entry.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
            <CaseMeta entry={entry} locale={locale} />
            <span aria-hidden>·</span>
            <span>{stageText(entry, locale)}</span>
            <span aria-hidden>·</span>
            <span>{sideText(entry, locale)}</span>
          </span>
        </div>
        <div className="mt-2 shrink-0 text-caption empty:hidden @lg/access:mt-0 @lg/access:pt-0.5 @lg/access:text-right">
          <PendingBadge locale={locale} checked={checked} held={held} />
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
