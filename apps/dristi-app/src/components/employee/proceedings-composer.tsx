"use client";

import * as React from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  FileStackIcon,
  GripVerticalIcon,
  PanelRightIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Identifier } from "@/components/chrome/identifier";
import {
  ApplicationsSection,
  AttendanceSection,
  OrderIndex,
  PageViewSwitch,
  type ComposerApplication,
  type ComposerFact,
  type IndexGroup,
  type PageView,
} from "@/components/employee/order-composer";
import { OrderCasePanel } from "@/components/employee/order-case-panel";
import {
  BlockIconTile,
  OrderItemPicker,
  type PickerChoice,
} from "@/components/employee/order-item-picker";
import { OrderSaveIndicator } from "@/components/employee/order-save-indicator";
import {
  caretOffset,
  nextBlank,
  paintBlanks,
  paragraphHTML,
  ProceedingsParagraph,
  readParagraph,
  selectRange,
  setCaret,
  textLength,
  type Trigger,
} from "@/components/employee/proceedings-editable";
import { ProceedingsItem } from "@/components/employee/proceedings-item";
import {
  BlankCombo,
  CaretMenu,
  firstSelectable,
  stepSelection,
  type MenuGroup,
} from "@/components/employee/proceedings-menus";
import { ProceedingsTemplateChooser } from "@/components/employee/proceedings-template-chooser";
import { TypedDateField } from "@/components/employee/typed-date-field";
import { PurposeField } from "@/components/employee/purpose-field";
import { PANEL_CLASS } from "@/components/shell/panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  CASE_FILE_TREE,
  flattenLeaves,
  isCaseFileFolder,
} from "@/lib/cases/case-file";
import {
  courtHearingPurposeLabel,
  formatListingDate,
  formatOrderDate,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";
import type { ListingApplicationDecision } from "@/lib/employee/listing-applications";
import {
  blockGaps,
  blockSummary,
  createItemBlock,
  createTextBlock,
  setItemRecipients,
  setItemValue,
  type ComposerBlock,
  type ComposerContext,
  type ItemBlock,
  type TextBlock,
} from "@/lib/employee/order-composer";
import {
  attendanceRecital,
  type Appearance,
  type OrderDraft,
} from "@/lib/employee/order-draft";
import {
  blankOptions,
  blanksIn,
  citedIds,
  closingItem,
  itemGapCount,
  itemParts,
  itemValuePiece,
  nextApplies,
  paraParts,
  proceedingsToFill,
  signingConsequences,
  suggestedTemplates,
  templateBlocks,
  templateFromBlocks,
  type FinishStep,
  type ProceedingsTemplate,
} from "@/lib/employee/order-proceedings";
import {
  browsableTemplates,
  combinationConflict,
  likelyTemplatesFor,
  ORDER_GROUPS,
  orderTemplate,
  unavailableReason,
  type OrderTemplate,
  type OrderTemplateId,
} from "@/lib/employee/order-templates";
import { cn } from "@/lib/utils";

/** An application standing on the listing, as this screen shows and words it. */
export type ProceedingsApplication = ComposerApplication & {
  /** "accused" / "complainant" — who filed it. */
  filedBy: string;
  /** What the order says once it is decided. */
  sentence: (decision: ListingApplicationDecision) => string;
};

/* Templates the court saved from its own proceedings — kept for the sitting. */
let SAVED: ProceedingsTemplate[] = [];
/* Listings whose chooser has already been put in front of the drafter this sitting. */
const CHOOSER_SHOWN = new Set<string>();

const LEAVES = flattenLeaves(CASE_FILE_TREE);

/**
 * Version C of the order composer — the owner's order-screen v14 (2026-10-13).
 *
 * **Drafting** records what happened: attendance and applications one tap each, the
 * proceedings typed as the hearing goes with order items set between the paragraphs as
 * boxes of their own, and the next date. `/` in the text adds an order item, `@` cites a
 * document, a [blank] left in the words is filled later from a short list drawn from the
 * case, and Tab walks the blanks. **Preview order** is the order in words.
 *
 * Opening a hearing's order first asks how to start: a template for the hearing's purpose,
 * or a blank page. The index (left) and the case file (right) are the block composer's
 * (A), held level with the page as it scrolls.
 *
 * **Outside a hearing** (Take cognizance, Issue notice, Dismiss) there was no sitting, so
 * there is no attendance, no listing's applications and no purpose to start a template
 * from: `appearances` and `purpose` are absent and those parts do not show. The act's own
 * items arrive in the proceedings and are fixed, as they are in A and B (owner,
 * 2026-10-13).
 */
export function ProceedingsComposer({
  draftKey,
  heading,
  facts,
  navAction,
  courtLine,
  subLine,
  signatory,
  context,
  today,
  purpose,
  inHearing,
  appearances: sittingAppearances,
  applications = [],
  onOpenApplication,
  applicationDialog,
  draft,
  setDraft,
  fixedIds = [],
  overview,
  overviewContent,
  historyContent,
  hearingsContent,
  previewInPanel = false,
}: {
  draftKey: string;
  heading: string;
  facts: ComposerFact[];
  navAction: React.ReactNode;
  courtLine: string;
  subLine: string;
  signatory: string;
  context: ComposerContext;
  today: string;
  /** The hearing's purpose. Absent outside a hearing. */
  purpose?: CourtHearingPurposeId;
  inHearing: boolean;
  /** Who is listed to appear. Absent outside a hearing, where nobody was called. */
  appearances?: Appearance[];
  applications?: ProceedingsApplication[];
  onOpenApplication?: (id: string) => void;
  applicationDialog?: (
    decide: (id: string, decision: ListingApplicationDecision | null) => void,
  ) => React.ReactNode;
  draft: OrderDraft;
  setDraft: (update: (current: OrderDraft) => OrderDraft) => void;
  /** Blocks that cannot be removed — an act's own items. */
  fixedIds?: readonly string[];
  overview: { label: string; value: string }[];
  overviewContent?: React.ReactNode;
  historyContent?: React.ReactNode;
  /** The case's hearings with the order passed at each — shows the Hearings tab. */
  hearingsContent?: React.ReactNode;
  /**
   * Version D (owner, 2026-10-14): Preview order leaves the order's own bar and becomes
   * the right panel's first tab, live beside the drafting — every word typed and every
   * value set shows on the paper as it happens, and the case file is a tab away. The
   * panel takes an equal share of the width for the paper, the index and the drafting
   * page giving up the room.
   */
  previewInPanel?: boolean;
}) {
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [view, setView] = React.useState<PageView>("drafting");
  const [openItem, setOpenItem] = React.useState<string | null>(null);
  const [revs, setRevs] = React.useState<Record<string, number>>({});
  const [menu, setMenu] = React.useState<null | {
    mode: "slash" | "at";
    trigger: Trigger;
    paraId: string;
    selected: string | null;
  }>(null);
  const [pickerAt, setPickerAt] = React.useState<string | null>(null);
  const [combo, setCombo] = React.useState<null | {
    range: Range;
    rect: DOMRect | null;
    label: string;
    paraId: string;
  }>(null);
  /* A sitting is what attendance and the purpose's templates are about. */
  const sitting = sittingAppearances !== undefined;
  const appearances = React.useMemo(
    () => sittingAppearances ?? [],
    [sittingAppearances],
  );
  /* The chooser opens on a hearing's first visit, with nothing yet written. */
  const [chooserOpen, setChooserOpen] = React.useState(
    () =>
      purpose !== undefined &&
      !CHOOSER_SHOWN.has(draftKey) &&
      !Object.keys(draft.marks).length &&
      !draft.blocks.some((block) => block.kind === "item" || block.text),
  );
  const [saved, setSaved] = React.useState<ProceedingsTemplate[]>(SAVED);
  const [askOpen, setAskOpen] = React.useState(false);
  const [viewRequest, setViewRequest] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  /* The empty paragraph at the end, before the draft has one of its own. */
  const [trailingId] = React.useState(() => createTextBlock().id);
  const focusAfter = React.useRef<null | {
    id: string;
    at: number | "end" | "blank" | "field";
    key?: string;
  }>(null);
  /* Where the caret goes once the template chooser has finished closing. */
  const afterChooser = React.useRef<typeof focusAfter.current>(null);
  const menuId = React.useId();

  /* The side panels and the page sit level under the sticky header and above the sticky
     footer, so their heights follow those bands' heights. */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [bands, setBands] = React.useState({ head: 0, foot: 0 });
  React.useEffect(() => {
    const root = rootRef.current;
    const head = root?.querySelector<HTMLElement>("header[data-proc-head]");
    const foot = root?.querySelector<HTMLElement>("footer[data-proc-foot]");
    if (!head || !foot) return;
    const measure = () =>
      setBands((current) =>
        current.head === head.offsetHeight && current.foot === foot.offsetHeight
          ? current
          : { head: head.offsetHeight, foot: foot.offsetHeight },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(head);
    observer.observe(foot);
    return () => observer.disconnect();
  }, []);

  /* ── the blocks, always ending in an empty paragraph to type into ── */
  const blocks = React.useMemo<ComposerBlock[]>(() => {
    const last = draft.blocks[draft.blocks.length - 1];
    return last && last.kind === "text" && !last.text
      ? [...draft.blocks]
      : [...draft.blocks, { id: trailingId, kind: "text", text: "" }];
  }, [draft.blocks, trailingId]);
  const pageEmpty = !blocks.some(
    (block) => block.kind === "item" || block.text,
  );

  function writeBlocks(change: (current: ComposerBlock[]) => ComposerBlock[]) {
    setDraft((current) => {
      const last = current.blocks[current.blocks.length - 1];
      const base =
        last && last.kind === "text" && !last.text
          ? [...current.blocks]
          : [
              ...current.blocks,
              { id: trailingId, kind: "text" as const, text: "" },
            ];
      const next = change(base);
      const end = next[next.length - 1];
      if (!end || end.kind !== "text" || end.text) next.push(createTextBlock());
      return { ...current, blocks: next };
    });
  }

  function bump(...ids: string[]) {
    setRevs((current) => {
      const next = { ...current };
      for (const id of ids) next[id] = (next[id] ?? 0) + 1;
      return next;
    });
  }

  /* ── where focus goes once the page has rendered ── */
  React.useLayoutEffect(() => {
    const wanted = focusAfter.current;
    if (!wanted) return;
    focusAfter.current = null;
    if (wanted.at === "field") {
      if (!wanted.key) {
        /* No field named: the first one still to fill, from the blocks as rendered. */
        const block = blocks.find(
          (entry): entry is ItemBlock =>
            entry.id === wanted.id && entry.kind === "item",
        );
        const first = block
          ? blockGaps(block, context).find(
              (gap) => gap.key !== "text" && !gap.key.startsWith("bracket"),
            )?.key
          : undefined;
        wanted.key = first?.startsWith("recipients") ? "recipients" : first;
      }
      const box = window.document.getElementById(`block-${wanted.id}`);
      box?.scrollIntoView({ block: "nearest", behavior: motion() });
      const controls =
        ":is(input,textarea,button[role=radio][data-state=on],button[role=radio],[data-slot=select-trigger],button):not([disabled])";
      const field =
        (wanted.key &&
          box?.querySelector<HTMLElement>(
            wanted.key.startsWith("recipients")
              ? `[data-slot=select-trigger]`
              : `[data-field="${CSS.escape(wanted.key)}"] ${controls}`,
          )) ||
        box?.querySelector<HTMLElement>(
          "#fx-" +
            CSS.escape(wanted.id) +
            " :is(input,button[role=radio],[data-slot=segmented-control-item],[data-slot=select-trigger],button):not([disabled])",
        );
      field?.focus({ preventScroll: true });
      return;
    }
    const el = window.document.querySelector<HTMLElement>(
      `[data-para="${CSS.escape(wanted.id)}"]`,
    );
    if (!el) return;
    if (wanted.at === "blank") {
      const range = nextBlank(el);
      if (range) {
        el.scrollIntoView({ block: "center", behavior: motion() });
        selectRange(range);
        return;
      }
      setCaret(el, "end");
      return;
    }
    setCaret(el, wanted.at);
  });

  /* ── the chooser has opened once for this listing this sitting ── */
  React.useEffect(() => {
    CHOOSER_SHOWN.add(draftKey);
  }, [draftKey]);

  React.useEffect(() => {
    paintBlanks();
  });

  /* ── what is left ── */
  const left = proceedingsToFill({
    appearances,
    draft: { ...draft, blocks },
    context,
  });
  const closing = closingItem(blocks);
  const listing = nextApplies({ blocks, next: draft.next });
  const cited = citedIds(blocks);
  const labelFor = React.useCallback(
    (id: string) => {
      const application = applications.find((entry) => entry.id === id);
      if (application) return `${application.type} · ${application.number}`;
      return LEAVES.find((leaf) => leaf.id === id)?.label ?? id;
    },
    [applications],
  );

  /* ── items ── */
  function reasonFor(template: OrderTemplate): string | null {
    const items = blocks.filter(
      (block): block is ItemBlock => block.kind === "item",
    );
    return (
      unavailableReason(template, { hearingOngoing: inHearing }) ??
      combinationConflict(
        template.id,
        items.map((block) => ({
          type: block.type,
          applicationId: block.applicationId,
        })),
      )
    );
  }

  function updateItem(id: string, change: (block: ItemBlock) => ItemBlock) {
    writeBlocks((current) =>
      current.map((block) =>
        block.id === id && block.kind === "item" ? change(block) : block,
      ),
    );
  }

  /** After an item: the paragraph below it, or a new one, with the caret in it. */
  function caretAfter(itemId: string) {
    writeBlocks((current) => {
      const at = current.findIndex((block) => block.id === itemId);
      const next = current[at + 1];
      if (next && next.kind === "text" && !next.text) {
        focusAfter.current = { id: next.id, at: 0 };
        return current;
      }
      const made = createTextBlock();
      focusAfter.current = { id: made.id, at: 0 };
      return [...current.slice(0, at + 1), made, ...current.slice(at + 1)];
    });
  }

  /** Opens an item on the field asked for, or on the first one still to fill. */
  function openItemAt(id: string, key?: string, made?: ItemBlock) {
    const block =
      made ??
      blocks.find(
        (entry): entry is ItemBlock => entry.id === id && entry.kind === "item",
      );
    const first = block
      ? blockGaps(block, context).find(
          (gap) => gap.key !== "text" && !gap.key.startsWith("bracket"),
        )?.key
      : undefined;
    setOpenItem(id);
    focusAfter.current = {
      id,
      at: "field",
      key: key ?? (first?.startsWith("recipients") ? "recipients" : first),
    };
  }

  function addFrom(choice: PickerChoice, after: string) {
    if (choice === "text") {
      writeBlocks((current) => {
        const at =
          after === "end"
            ? current.length - 1
            : current.findIndex((block) => block.id === after) + 1;
        const next = current[at];
        if (next && next.kind === "text" && !next.text) {
          focusAfter.current = { id: next.id, at: 0 };
          return current;
        }
        const made = createTextBlock();
        focusAfter.current = { id: made.id, at: 0 };
        return [...current.slice(0, at), made, ...current.slice(at)];
      });
      return;
    }
    const item = createItemBlock(choice, context);
    writeBlocks((current) => {
      const at =
        after === "end"
          ? current.length - 1
          : current.findIndex((block) => block.id === after) + 1;
      return [...current.slice(0, at), item, ...current.slice(at)];
    });
    const asks = orderTemplate(choice).fields.some((field) => !field.derived);
    setAnnouncement(`${orderTemplate(choice).label} added.`);
    if (asks) openItemAt(item.id, undefined, item);
    else caretAfter(item.id);
  }

  function removeBlock(id: string) {
    if (fixedIds.includes(id)) return;
    const snapshot = draft.blocks;
    const block = blocks.find((entry) => entry.id === id);
    writeBlocks((current) => current.filter((entry) => entry.id !== id));
    if (openItem === id) setOpenItem(null);
    const name =
      block?.kind === "item" ? orderTemplate(block.type).label : "Paragraph";
    toast(`${name} removed`, {
      action: {
        label: "Undo",
        onClick: () => {
          setDraft((current) => ({ ...current, blocks: snapshot }));
          bump(...snapshot.map((entry) => entry.id));
        },
      },
    });
  }

  function moveBlock(id: string, by: -1 | 1) {
    writeBlocks((current) => {
      const at = current.findIndex((block) => block.id === id);
      const to = at + by;
      if (at < 0 || to < 0 || to >= current.length - 1) return current;
      const next = [...current];
      [next[at], next[to]] = [next[to], next[at]];
      return next;
    });
    bump(id);
  }

  /* ── the `/` and `@` menu ── */
  /*
   * The `/` and `@` menu's lists, ranked for typing: what starts a word with what was
   * typed comes first, what merely contains it after. `@` offers the people of the case
   * first — a name is written into the text as it stands — then the papers to cite.
   */
  const menuGroups: MenuGroup[] = React.useMemo(() => {
    if (!menu) return [];
    const needle = menu.trigger.query.trim().toLowerCase();
    const rank = (words: string) => {
      if (!needle) return 0;
      const text = words.toLowerCase();
      if (text.startsWith(needle)) return 0;
      if (text.split(/[\s·,()/-]+/).some((word) => word.startsWith(needle)))
        return 1;
      return text.includes(needle) ? 2 : -1;
    };
    const ranked = <T,>(items: T[], words: (item: T) => string) =>
      items
        .map((item) => ({ item, score: rank(words(item)) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => a.score - b.score)
        .map((entry) => entry.item);

    if (menu.mode === "at") {
      const groups: MenuGroup[] = [];
      const people = [
        /* A side's counsel is one roll row, but each advocate is someone to name. */
        ...appearances.flatMap((entry) =>
          entry.advocates
            ? entry.advocates.map((name) => ({ name, role: entry.role }))
            : [{ name: entry.name, role: entry.role }],
        ),
        ...context.people
          .filter((person) => person.kind === "witness")
          .map((person) => ({ name: person.name, role: person.role })),
      ];
      const peopleShown = ranked(
        people,
        (person) => `${person.name} ${person.role}`,
      );
      if (peopleShown.length) {
        groups.push({
          heading: "People",
          entries: peopleShown.map((person) => ({
            id: `person:${person.name}`,
            label: person.name,
            detail: person.role,
          })),
        });
      }
      const apps = ranked(
        applications,
        (entry) => `${entry.type} ${entry.number}`,
      );
      if (apps.length) {
        groups.push({
          heading: "Applications",
          entries: apps.map((entry) => ({
            id: entry.id,
            label: `${entry.type} · ${entry.number}`,
            detail: entry.filed,
          })),
        });
      }
      for (const section of CASE_FILE_TREE) {
        const leaves = isCaseFileFolder(section)
          ? flattenLeaves(section.children ?? [])
          : [section];
        const shown = ranked(
          leaves,
          (leaf) => `${leaf.label} ${section.label}`,
        );
        if (shown.length) {
          groups.push({
            heading: section.label,
            entries: shown.map((leaf) => ({ id: leaf.id, label: leaf.label })),
          });
        }
      }
      return groups;
    }
    const entry = (template: OrderTemplate) => ({
      id: template.id,
      label: template.label,
      icon: <BlockIconTile group={template.group} />,
      disabled: reasonFor(template),
    });
    const likely = ranked(
      purpose ? likelyTemplatesFor(purpose) : [],
      (template) => template.label,
    );
    const groups: MenuGroup[] = [];
    if (!needle && likely.length)
      groups.push({
        heading: "Likely at this hearing",
        entries: likely.map(entry),
      });
    for (const group of ORDER_GROUPS) {
      const members = ranked(
        browsableTemplates().filter(
          (template) =>
            template.group === group.id &&
            (needle || !likely.some((other) => other.id === template.id)),
        ),
        (template) => template.label,
      );
      if (members.length)
        groups.push({ heading: group.label, entries: members.map(entry) });
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reasonFor reads blocks
  }, [menu, applications, purpose, blocks, appearances, context]);

  /* A query that has run past a space and matches nothing is just writing: the menu
     steps out of the way rather than holding the keys. */
  const menuShown =
    menu !== null && (menuGroups.length > 0 || !/\s/.test(menu.trigger.query));

  function onTrigger(paraId: string, trigger: Trigger | null) {
    if (!trigger) {
      setMenu(null);
      return;
    }
    setMenu((current) => ({
      mode: trigger.mode,
      trigger,
      paraId,
      selected:
        current && current.mode === trigger.mode ? current.selected : null,
    }));
  }

  const selectedEntry = menu
    ? (menuGroups
        .flatMap((group) => group.entries)
        .find((entry) => entry.id === menu.selected && !entry.disabled) ??
      menuGroups
        .flatMap((group) => group.entries)
        .find((entry) => !entry.disabled))
    : undefined;

  function pick(entryId: string) {
    if (!menu) return;
    const { mode, trigger, paraId } = menu;
    setMenu(null);
    const el = window.document.querySelector<HTMLElement>(
      `[data-para="${CSS.escape(paraId)}"]`,
    );
    if (!el) return;
    const range = window.document.createRange();
    range.setStart(trigger.node, trigger.start);
    range.setEnd(trigger.node, trigger.end);
    range.deleteContents();
    if (mode === "at" && entryId.startsWith("person:")) {
      const name = window.document.createTextNode(`${entryId.slice(7)} `);
      range.insertNode(name);
      const caret = window.document.createRange();
      caret.setStart(name, name.length);
      caret.collapse(true);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(caret);
      const text = readParagraph(el);
      writeBlocks((current) =>
        current.map((block) =>
          block.id === paraId && block.kind === "text"
            ? { ...block, text }
            : block,
        ),
      );
      return;
    }
    if (mode === "at") {
      const holder = window.document.createElement("span");
      holder.innerHTML = paragraphHTML(`@{${entryId}}`, labelFor);
      const chip = holder.firstElementChild as HTMLElement;
      range.insertNode(chip);
      const space = window.document.createTextNode(" ");
      chip.after(space);
      const caret = window.document.createRange();
      caret.setStart(space, 1);
      caret.collapse(true);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(caret);
      const text = readParagraph(el);
      writeBlocks((current) =>
        current.map((block) =>
          block.id === paraId && block.kind === "text"
            ? { ...block, text }
            : block,
        ),
      );
      return;
    }
    /* Typed during the hearing: the item drops in closed, and the typing carries on below. */
    const text = readParagraph(el);
    const item = createItemBlock(entryId as OrderTemplateId, context);
    writeBlocks((current) => {
      const at = current.findIndex((block) => block.id === paraId);
      if (!text)
        return [...current.slice(0, at), item, ...current.slice(at + 1)];
      return [
        ...current.slice(0, at),
        { ...(current[at] as TextBlock), text },
        item,
        ...current.slice(at + 1),
      ];
    });
    bump(paraId);
    setAnnouncement(
      `${orderTemplate(item.type).label} added. Its details can wait.`,
    );
    caretAfter(item.id);
  }

  /* ── typing ── */
  function onParagraphKey(
    block: TextBlock,
    index: number,
    event: React.KeyboardEvent<HTMLDivElement>,
  ) {
    const el = event.currentTarget;
    if (menu && menuShown && menu.paraId === block.id) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setMenu({
          ...menu,
          selected: stepSelection(
            menuGroups,
            selectedEntry?.id ?? null,
            event.key === "ArrowDown" ? 1 : -1,
          ),
        });
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        if (selectedEntry) pick(selectedEntry.id);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMenu(null);
        return;
      }
    }
    if (event.key === "Tab" && !event.shiftKey) {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      let hit = range
        ? nextBlank(el, { node: range.endContainer, offset: range.endOffset })
        : null;
      if (!hit) {
        const later = [
          ...blocks.slice(index + 1),
          ...blocks.slice(0, index + 1),
        ];
        for (const other of later) {
          if (other.kind !== "text" || !blanksIn(other.text).length) continue;
          const host = window.document.querySelector<HTMLElement>(
            `[data-para="${CSS.escape(other.id)}"]`,
          );
          hit = host ? nextBlank(host) : null;
          if (hit) break;
        }
      }
      if (hit) {
        event.preventDefault();
        selectRange(hit);
      }
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!block.text && index === blocks.length - 1) return;
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const tail = window.document.createRange();
      tail.setStart(range.startContainer, range.startOffset);
      tail.setEnd(el, el.childNodes.length);
      const box = window.document.createElement("div");
      box.appendChild(tail.extractContents());
      const head = readParagraph(el);
      const rest = readParagraph(box);
      const made = createTextBlock(rest);
      writeBlocks((current) => {
        const at = current.findIndex((entry) => entry.id === block.id);
        return [
          ...current.slice(0, at),
          { ...block, text: head },
          made,
          ...current.slice(at + 1),
        ];
      });
      bump(block.id, made.id);
      focusAfter.current = { id: made.id, at: 0 };
      return;
    }
    if (
      event.key === "Backspace" &&
      window.getSelection()?.isCollapsed &&
      caretOffset(el) === 0 &&
      index > 0
    ) {
      const previous = blocks[index - 1];
      if (previous.kind === "text") {
        event.preventDefault();
        const prevEl = window.document.querySelector<HTMLElement>(
          `[data-para="${CSS.escape(previous.id)}"]`,
        );
        const at = prevEl ? textLength(prevEl) : 0;
        writeBlocks((current) =>
          current
            .filter((entry) => entry.id !== block.id)
            .map((entry) =>
              entry.id === previous.id && entry.kind === "text"
                ? { ...entry, text: entry.text + block.text }
                : entry,
            ),
        );
        bump(previous.id);
        focusAfter.current = { id: previous.id, at };
      } else if (!block.text) {
        event.preventDefault();
        window.document
          .querySelector<HTMLElement>(
            `[data-toggle="${CSS.escape(previous.id)}"]`,
          )
          ?.focus();
      }
    }
  }

  function fillBlank(value: string) {
    if (!combo) return;
    const { range, paraId } = combo;
    setCombo(null);
    const el = window.document.querySelector<HTMLElement>(
      `[data-para="${CSS.escape(paraId)}"]`,
    );
    if (!el) return;
    range.deleteContents();
    const node = window.document.createTextNode(value);
    range.insertNode(node);
    const upTo = window.document.createRange();
    upTo.selectNodeContents(el);
    upTo.setEndAfter(node);
    const offset = upTo.toString().length;
    const text = readParagraph(el);
    writeBlocks((current) =>
      current.map((block) =>
        block.id === paraId && block.kind === "text"
          ? { ...block, text }
          : block,
      ),
    );
    setCaret(el, offset);
    paintBlanks();
    setAnnouncement(`Filled with ${value}.`);
  }

  /* ── templates ── */
  function applyTemplate(template: ProceedingsTemplate) {
    const snapshot = draft;
    const made = templateBlocks(template, context);
    writeBlocks((current) =>
      pageEmpty
        ? made
        : [
            ...current.filter((block) => block.kind === "item" || block.text),
            ...made,
          ],
    );
    bump(...made.map((block) => block.id));
    const firstWords = made.find(
      (block) => block.kind === "text" && blanksIn(block.text).length,
    );
    const firstItem =
      made.find(
        (block) => block.kind === "item" && itemGapCount(block, context),
      ) ??
      made.find(
        (block) =>
          block.kind === "item" &&
          orderTemplate(block.type).fields.some((field) => !field.derived),
      );
    setOpenItem(firstItem ? firstItem.id : null);
    if (firstWords) afterChooser.current = { id: firstWords.id, at: "blank" };
    else if (firstItem)
      afterChooser.current = { id: firstItem.id, at: "field" };
    else
      afterChooser.current = {
        id: made[made.length - 1]?.id ?? trailingId,
        at: "end",
      };
    toast(`Started from ${template.name}`, {
      action: {
        label: "Undo",
        onClick: () => {
          setDraft(() => snapshot);
          bump(...snapshot.blocks.map((block) => block.id));
        },
      },
    });
  }

  function saveTemplate(): ProceedingsTemplate {
    const made: ProceedingsTemplate = {
      id: `saved-${Date.now()}`,
      name: `Saved proceedings ${SAVED.length + 1}`,
      group: "situation",
      purposes: [],
      blocks: templateFromBlocks(blocks),
    };
    SAVED = [...SAVED, made];
    setSaved(SAVED);
    toast(`Saved as “${made.name}”`);
    return made;
  }

  /* ── going to what is left ── */
  function go(step: FinishStep) {
    setView("drafting");
    if (step.kind === "item") {
      openItemAt(step.id);
      return;
    }
    if (step.kind === "blanks") {
      focusAfter.current = { id: step.id, at: "blank" };
      setRevs((current) => ({ ...current }));
      return;
    }
    requestAnimationFrame(() => {
      const target =
        step.kind === "attendance"
          ? window.document.querySelector<HTMLElement>(
              "#order-attendance [role=radio]",
            )
          : window.document.getElementById(`proc-next-${step.field}`);
      target?.scrollIntoView({ block: "center", behavior: motion() });
      target?.focus({ preventScroll: true });
    });
  }

  function jump(target: string) {
    setView("drafting");
    requestAnimationFrame(() => {
      if (target.startsWith("block-")) {
        const id = target.slice(6);
        const block = blocks.find((entry) => entry.id === id);
        if (
          block?.kind === "item" &&
          orderTemplate(block.type).fields.some((field) => !field.derived)
        ) {
          openItemAt(id);
          requestAnimationFrame(() =>
            flash(
              window.document.querySelector<HTMLElement>(
                `#block-${CSS.escape(id)} > .rounded-xl`,
              ),
            ),
          );
          return;
        }
        if (block?.kind === "text") {
          focusAfter.current = {
            id,
            at: blanksIn(block.text).length ? "blank" : "end",
          };
          setRevs((current) => ({ ...current }));
          return;
        }
      }
      const el = window.document.getElementById(target);
      el?.scrollIntoView({ block: "center", behavior: motion() });
      el?.focus({ preventScroll: true });
      flash(el);
    });
  }

  /* ── the index ── */
  const unmarked = appearances.filter((entry) => !draft.marks[entry.id]).length;
  const present = appearances.filter(
    (entry) => draft.marks[entry.id] === "present",
  ).length;
  const pending = applications.filter(
    (entry) => !draft.applications[entry.id],
  ).length;
  const proceedingsRows = blocks.flatMap((block) => {
    if (block.kind === "item") {
      const gaps = itemGapCount(block, context);
      const asks = orderTemplate(block.type).fields.some(
        (field) => !field.derived,
      );
      return [
        {
          target: `block-${block.id}`,
          state: (asks && gaps ? "todo" : "done") as "todo" | "done",
          title: orderTemplate(block.type).label,
          detail: asks
            ? gaps
              ? `${gaps} to fill`
              : blockSummary(block, context)
            : "",
        },
      ];
    }
    const blanks = blanksIn(block.text);
    return blanks.length
      ? [
          {
            target: `block-${block.id}`,
            state: "todo" as const,
            title: "Words to fill",
            detail: blanks.join(" "),
          },
        ]
      : [];
  });
  const proceedingsGaps = proceedingsRows.filter(
    (row) => row.state === "todo",
  ).length;
  const indexGroups: IndexGroup[] = [
    ...(sitting
      ? [
          {
            target: "order-attendance",
            title: "Attendance",
            state: (unmarked ? "open" : "done") as "open" | "done",
            detail:
              unmarked === appearances.length
                ? "Not marked"
                : unmarked
                  ? `${unmarked} not marked`
                  : `${present} present, ${appearances.length - present} absent`,
            rows: [],
          },
        ]
      : []),
    ...(applications.length
      ? [
          {
            target: "order-applications",
            title: "Applications",
            state: (pending ? "open" : "done") as "open" | "done",
            detail: pending ? `${pending} pending` : "All decided",
            rows: applications.map((entry) => ({
              target: `order-application-${entry.id}`,
              state: (draft.applications[entry.id] ? "done" : "open") as
                "open" | "done",
              title: entry.type,
              detail:
                draft.applications[entry.id] === "allowed"
                  ? "Accepted"
                  : draft.applications[entry.id] === "dismissed"
                    ? "Rejected"
                    : "Pending",
            })),
          },
        ]
      : []),
    {
      target: "proc-proceedings",
      title: "Proceedings",
      state: proceedingsGaps ? "todo" : pageEmpty ? "open" : "done",
      detail: pageEmpty
        ? "Nothing written yet"
        : proceedingsGaps
          ? `${proceedingsGaps} to fill`
          : "Written",
      rows: proceedingsRows,
    },
    {
      target: "proc-next",
      title: "Next hearing",
      state:
        !listing || (draft.nextDate && draft.nextPurpose) ? "done" : "todo",
      detail: closing
        ? "None, the case closes"
        : draft.next === "none"
          ? "Not listed again"
          : draft.nextDate && draft.nextPurpose
            ? `${formatListingDate(draft.nextDate)} · ${courtHearingPurposeLabel(draft.nextPurpose)}`
            : !draft.nextDate && !draft.nextPurpose
              ? "Date and purpose not set"
              : !draft.nextDate
                ? "Date not set"
                : "Purpose not set",
      rows: [],
    },
  ];

  /* ── applications ── */
  function decide(id: string, decision: ListingApplicationDecision | null) {
    setDraft((current) => ({
      ...current,
      applications: { ...current.applications, [id]: decision ?? undefined },
    }));
  }

  const panelApplications = applications.map((entry) => ({
    id: entry.id,
    label: entry.type,
    number: entry.number,
    detail: entry.filed,
    decided: Boolean(draft.applications[entry.id]),
    onOpen: () => onOpenApplication?.(entry.id),
  }));

  /* D's columns: the index a fixed width, the drafting page and the side panel sharing
     the rest — the page the larger share, since it is where the work is, and the paper
     beside it at a reading width (owner, 2026-10-14: an even split read as unbalanced).
     Both are the reader's to drag, or to set from the keyboard; a double press puts
     them back. Held for the visit. */
  const [indexWidth, setIndexWidth] = React.useState(INDEX_DEFAULT);
  const [previewShare, setPreviewShare] = React.useState(SHARE_DEFAULT);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef(0);
  const span = React.useRef(0);
  const columns = panelOpen
    ? `${indexWidth}px 1.5rem minmax(0,${1 - previewShare}fr) 1.5rem minmax(0,${previewShare}fr)`
    : `${indexWidth}px 1.5rem minmax(0,1fr)`;

  /* D: the part of the drafting being worked on, which the order preview follows — kept
     in view as it changes, and marked for a moment when the work moves to it (owner,
     2026-10-14). */
  const [editing, setEditing] = React.useState<string | null>(null);
  const marked = React.useRef<string | null>(null);
  function follow(target: EventTarget) {
    if (!previewInPanel || !(target instanceof HTMLElement)) return;
    const part = target.closest<HTMLElement>(
      "[id^='block-'], #order-attendance, #order-applications, #proc-next",
    );
    if (part) setEditing(part.id);
  }
  React.useEffect(() => {
    if (!previewInPanel || !editing) return;
    /* Only while the Order preview tab is the one showing. */
    const preview = rootRef.current?.querySelector<HTMLElement>(
      "[data-order-preview]",
    );
    const scroller = preview?.closest<HTMLElement>("[role=tabpanel]");
    if (!preview || !scroller) return;
    const lines = [
      ...preview.querySelectorAll<HTMLElement>(
        `[data-preview-line="${CSS.escape(editing)}"]`,
      ),
    ];
    if (!lines.length) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const view = scroller.getBoundingClientRect();
    const top = lines[0].getBoundingClientRect().top;
    const bottom = lines[lines.length - 1].getBoundingClientRect().bottom;
    if (top < view.top + 16 || bottom > view.bottom - 16) {
      /* A third of the way down, so what comes before it reads as well. */
      scroller.scrollTo({
        top: scroller.scrollTop + top - view.top - view.height / 3,
        behavior: still ? "auto" : "smooth",
      });
    }
    if (marked.current !== editing) {
      marked.current = editing;
      if (!still)
        for (const line of lines)
          line.animate(
            [
              { backgroundColor: "var(--brand-muted)" },
              { backgroundColor: "var(--brand-muted)", offset: 0.4 },
              { backgroundColor: "transparent" },
            ],
            { duration: 1400, easing: "ease-out" },
          );
    }
  }, [editing, draft, previewInPanel]);

  /* The order as paper: Preview order's view in C, the panel's live tab in D. */
  const paper = (
    <div data-order-preview="">
      {/* The paper's heading, on the paper only: Drafting starts with what
        happened (owner, 2026-10-13). */}
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="text-body-compact font-semibold">{courtLine}</p>
        <p className="text-body-compact text-muted-foreground">{subLine}</p>
      </header>
      <Separator className="my-6 bg-hairline" />
      <PreviewOrder
        blocks={blocks}
        draft={draft}
        context={context}
        appearances={sitting ? appearances : undefined}
        applications={applications}
        listing={listing}
        signatory={signatory}
        labelFor={labelFor}
        linked={[
          ...new Set([
            ...applications
              .filter((entry) => draft.applications[entry.id])
              .map((entry) => entry.id),
            ...cited,
            ...draft.links,
          ]),
        ]}
        onGap={(target) => jump(target)}
      />
    </div>
  );

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      ref={rootRef}
      style={
        {
          "--order-panel-top": `calc(3.5rem + ${bands.head}px + 2rem)`,
          "--order-panel-height": `calc(100svh - 3.5rem - ${bands.head}px - ${bands.foot}px - 4rem)`,
          /* The page and the case file run to the footer (see the block composer). */
          "--order-panel-fill": `calc(100svh - 3.5rem - ${bands.head}px - ${bands.foot}px - 2rem)`,
        } as React.CSSProperties
      }
    >
      {/* The blanks' tint, painted by the Custom Highlight API over the typed words. */}
      <style>
        {
          "::highlight(proceedings-blank){background-color:var(--warning-muted);color:var(--warning-muted-foreground)}"
        }
      </style>

      <header
        data-proc-head=""
        className="sticky top-14 z-20 flex flex-col gap-3 border-b border-hairline bg-card px-6 py-4 sm:flex-row sm:items-start sm:justify-between md:px-8"
      >
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="min-w-0 text-title font-semibold text-balance">
            {heading}
          </h1>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-6 gap-y-1">
            {facts.map((fact) => (
              <p
                key={fact.label}
                className="flex min-w-0 items-baseline gap-2 text-body-compact"
              >
                <span className="text-muted-foreground">{fact.label}</span>
                {fact.identifier ? (
                  <Identifier
                    value={fact.value}
                    label={fact.label.toLowerCase()}
                  />
                ) : (
                  <span className="tabular-nums">{fact.value}</span>
                )}
              </p>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            aria-pressed={panelOpen}
            aria-controls="order-case-file"
            className="w-full shrink-0 aria-pressed:bg-accent-strong sm:w-fit"
            onClick={() => setPanelOpen((open) => !open)}
          >
            <PanelRightIcon data-icon="inline-start" aria-hidden />
            {/* In D the panel holds the order preview as well as the case file. */}
            {previewInPanel ? "Side panel" : "Case file"}
          </Button>
          {navAction}
        </div>
      </header>

      <div
        ref={gridRef}
        style={
          previewInPanel
            ? ({ "--order-columns": columns } as React.CSSProperties)
            : undefined
        }
        className={cn(
          "grid min-w-0 flex-1 items-start gap-6 bg-muted p-6 md:p-8 lg:pb-0 dark:bg-background",
          previewInPanel
            ? /* D's columns are the reader's to set (see `columns`); the handles sit in
                 the gaps, so the gaps are tracks of their own. */
              "lg:grid-cols-(--order-columns) lg:gap-x-0"
            : !panelOpen
              ? "lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
              : "lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,20rem)] xl:grid-cols-[15rem_minmax(0,1fr)_22rem] 2xl:grid-cols-[16rem_minmax(0,1fr)_24rem]",
        )}
      >
        <OrderIndex
          className="order-2 lg:sticky lg:top-(--order-panel-top) lg:order-none lg:max-h-(--order-panel-height) lg:overflow-y-auto"
          groups={indexGroups}
          toFill={left.count}
          onJump={jump}
        />

        {previewInPanel ? (
          <ColumnResizer
            label="Resize the index"
            valueNow={indexWidth}
            valueMin={INDEX_MIN}
            valueMax={INDEX_MAX}
            valueText={`${indexWidth} pixels wide`}
            onDrag={(dx, start) => {
              if (start) {
                drag.current = indexWidth;
                return;
              }
              setIndexWidth(clamp(drag.current + dx, INDEX_MIN, INDEX_MAX));
            }}
            onStep={(by) =>
              setIndexWidth((width) =>
                clamp(width + by * 16, INDEX_MIN, INDEX_MAX),
              )
            }
            onReset={() => setIndexWidth(INDEX_DEFAULT)}
          />
        ) : null}

        <article
          aria-label="Order"
          onFocus={(event) => follow(event.target)}
          onInput={(event) => follow(event.target)}
          className={cn(
            PANEL_CLASS,
            "flex min-w-0 flex-col rounded-xl border bg-card text-card-foreground lg:sticky lg:top-(--order-panel-top) lg:h-(--order-panel-fill) lg:overflow-hidden lg:rounded-b-none lg:border-b-0",
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-hairline px-6 md:px-8">
            {/* On a phone the bar holds only its controls: the page is the order. */}
            <p className="text-body-compact font-semibold max-sm:sr-only">
              Order
            </p>
            {/* A template starts the whole order, so it is offered on the order's own
                bar, beside the view — in Drafting, where it can be used. The switch
                keeps its place when it goes. On a phone it is its icon alone. */}
            <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
              {view === "drafting" ? (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Templates"
                  className="text-body-compact text-muted-foreground hover:text-foreground max-sm:size-10 max-sm:p-0"
                  onClick={() => setChooserOpen(true)}
                >
                  <FileStackIcon data-icon="inline-start" aria-hidden />
                  <span className="max-sm:sr-only">Templates</span>
                </Button>
              ) : (
                <span aria-hidden />
              )}
              {previewInPanel ? null : (
                <PageViewSwitch value={view} onChange={setView} className="" />
              )}
            </div>
          </div>
          <div className="min-w-0 p-6 md:p-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
            {view === "preview" && !previewInPanel ? (
              paper
            ) : (
              <>
                {sitting ? (
                  <AttendanceSection
                    attendance={{
                      appearances,
                      marks: draft.marks,
                      onMark: (id, mark) =>
                        setDraft((current) => ({
                          ...current,
                          marks: { ...current.marks, [id]: mark },
                        })),
                      onMarkAllPresent: () =>
                        setDraft((current) => ({
                          ...current,
                          marks: Object.fromEntries(
                            appearances.map((entry) => [
                              entry.id,
                              current.marks[entry.id] ?? "present",
                            ]),
                          ),
                        })),
                    }}
                    disabled={false}
                  />
                ) : null}
                {applications.length && onOpenApplication ? (
                  <>
                    <Separator className="my-6 bg-hairline" />
                    <ApplicationsSection
                      applications={{
                        list: applications.map((entry) => ({
                          ...entry,
                          decision: draft.applications[entry.id],
                        })),
                        onDecide: decide,
                        onOpen: onOpenApplication,
                      }}
                      disabled={false}
                    />
                  </>
                ) : null}
                {sitting ? <Separator className="my-6 bg-hairline" /> : null}

                <section
                  id="proc-proceedings"
                  tabIndex={-1}
                  aria-labelledby="proc-proceedings-heading"
                  className="flex min-w-0 scroll-mt-40 flex-col outline-none"
                >
                  <div className="mb-3 flex min-h-10 items-center">
                    <h2
                      id="proc-proceedings-heading"
                      className="text-body-compact font-semibold"
                    >
                      Proceedings
                    </h2>
                  </div>
                  <div className="flex min-w-0 flex-col gap-3">
                    {blocks.map((block, index) => {
                      const last = index === blocks.length - 1;
                      const trailing =
                        last && block.kind === "text" && !block.text;
                      return (
                        <section
                          key={block.id}
                          id={`block-${block.id}`}
                          tabIndex={-1}
                          className={cn(
                            "group/blk relative scroll-mt-40 outline-none",
                            trailing && "flex flex-col items-start gap-2",
                          )}
                        >
                          {trailing ? null : (
                            <BlockGutter
                              kind={block.kind}
                              label={
                                block.kind === "item"
                                  ? orderTemplate(block.type).label
                                  : "this paragraph"
                              }
                              first={index === 0}
                              last={index >= blocks.length - 2}
                              pickerOpen={pickerAt === block.id}
                              onPickerOpenChange={(open) =>
                                setPickerAt(open ? block.id : null)
                              }
                              purpose={purpose}
                              reasonFor={reasonFor}
                              onAdd={(choice) => addFrom(choice, block.id)}
                              onMove={(by) => moveBlock(block.id, by)}
                              onRemove={
                                fixedIds.includes(block.id)
                                  ? undefined
                                  : () => removeBlock(block.id)
                              }
                            />
                          )}
                          {block.kind === "item" ? (
                            <ProceedingsItem
                              block={block}
                              context={context}
                              today={today}
                              open={openItem === block.id}
                              rev={revs[block.id] ?? 0}
                              onToggle={() => {
                                if (openItem === block.id) setOpenItem(null);
                                else openItemAt(block.id);
                              }}
                              onDone={() => {
                                setOpenItem(null);
                                caretAfter(block.id);
                              }}
                              onRemove={
                                fixedIds.includes(block.id)
                                  ? undefined
                                  : () => removeBlock(block.id)
                              }
                              onValue={(key, value) =>
                                updateItem(block.id, (current) =>
                                  setItemValue(current, key, value, context),
                                )
                              }
                              onRecipients={(recipients) =>
                                updateItem(block.id, (current) =>
                                  setItemRecipients(
                                    current,
                                    recipients,
                                    context,
                                  ),
                                )
                              }
                              onWording={(parts) => {
                                updateItem(block.id, (current) => ({
                                  ...current,
                                  wording: parts ?? undefined,
                                }));
                                if (!parts) bump(block.id);
                              }}
                              onLostValue={() =>
                                toast(
                                  "Values come from the fields, so they stay. Change them there.",
                                )
                              }
                              onValueClick={(key) => openItemAt(block.id, key)}
                            />
                          ) : (
                            <>
                              <ProceedingsParagraph
                                id={block.id}
                                text={block.text}
                                rev={revs[block.id] ?? 0}
                                labelFor={labelFor}
                                placeholder={
                                  last
                                    ? pageEmpty
                                      ? "Type what is said. / for an order item, @ for a document"
                                      : "Keep typing"
                                    : undefined
                                }
                                className={cn(
                                  "min-w-0 text-body whitespace-pre-wrap outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
                                  trailing && "self-stretch",
                                )}
                                onText={(text) =>
                                  writeBlocks((current) =>
                                    current.map((entry) =>
                                      entry.id === block.id &&
                                      entry.kind === "text"
                                        ? { ...entry, text }
                                        : entry,
                                    ),
                                  )
                                }
                                onTrigger={(trigger) =>
                                  onTrigger(block.id, trigger)
                                }
                                onKeyDown={(event) =>
                                  onParagraphKey(block, index, event)
                                }
                                onBlank={(range) =>
                                  setCombo({
                                    range: range.cloneRange(),
                                    rect: range.getBoundingClientRect(),
                                    label: range.toString().slice(1, -1),
                                    paraId: block.id,
                                  })
                                }
                                onCite={(id) => {
                                  setPanelOpen(true);
                                  setViewRequest(id);
                                }}
                              />
                              {trailing ? (
                                <OrderItemPicker
                                  open={pickerAt === "end"}
                                  onOpenChange={(open) =>
                                    setPickerAt(open ? "end" : null)
                                  }
                                  purpose={purpose}
                                  reasonFor={reasonFor}
                                  onChoose={(choice) => addFrom(choice, "end")}
                                  align="start"
                                  trigger={
                                    /* Under the line being typed, its plus on the
                                       words' own edge. */
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="-ml-2 text-body-compact text-muted-foreground hover:text-foreground"
                                    >
                                      <PlusIcon
                                        data-icon="inline-start"
                                        aria-hidden
                                      />
                                      Order item
                                    </Button>
                                  }
                                />
                              ) : null}
                            </>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </section>

                <Separator className="my-6 bg-hairline" />
                <NextHearing
                  draft={draft}
                  today={today}
                  closingName={
                    closing ? orderTemplate(closing.type).label : null
                  }
                  onChange={(change) =>
                    setDraft((current) => ({ ...current, ...change }))
                  }
                />
              </>
            )}
          </div>
        </article>

        {previewInPanel && panelOpen ? (
          <ColumnResizer
            label="Resize the order and the side panel"
            valueNow={Math.round(previewShare * 100)}
            valueMin={SHARE_MIN * 100}
            valueMax={SHARE_MAX * 100}
            valueText={`Side panel ${Math.round(previewShare * 100)} percent`}
            onDrag={(dx, start) => {
              if (start) {
                const [, , page, , side] = gridRef.current
                  ? [...gridRef.current.children]
                  : [];
                drag.current = previewShare;
                span.current =
                  (page?.getBoundingClientRect().width ?? 0) +
                  (side?.getBoundingClientRect().width ?? 0);
                return;
              }
              if (span.current > 0)
                setPreviewShare(
                  clamp(drag.current - dx / span.current, SHARE_MIN, SHARE_MAX),
                );
            }}
            onStep={(by) =>
              setPreviewShare((share) =>
                clamp(share - by * 0.025, SHARE_MIN, SHARE_MAX),
              )
            }
            onReset={() => setPreviewShare(SHARE_DEFAULT)}
          />
        ) : null}

        {panelOpen ? (
          <OrderCasePanel
            className="order-3 lg:sticky lg:top-(--order-panel-top) lg:order-none lg:h-(--order-panel-fill) lg:rounded-b-none lg:border-b-0"
            overview={overview}
            applications={panelApplications}
            links={draft.links}
            onLinksChange={(links) =>
              setDraft((current) => ({ ...current, links }))
            }
            disabled={false}
            cited={cited}
            overviewContent={overviewContent}
            historyContent={historyContent}
            hearingsContent={hearingsContent}
            preview={previewInPanel ? paper : undefined}
            requestView={viewRequest}
            onViewRequested={() => setViewRequest(null)}
          />
        ) : null}
      </div>

      <footer
        data-proc-foot=""
        className="sticky bottom-0 z-30 border-t border-hairline bg-card px-6 py-3 md:px-8 md:py-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-h-10 items-center">
            {left.count ? (
              <Button
                type="button"
                variant="ghost"
                aria-label={`${left.count} to fill. Go to the first: ${left.steps[0]?.label ?? ""}`}
                className="-ml-3 text-body-compact font-medium text-warning-ink hover:text-warning-ink"
                onClick={() => left.steps[0] && go(left.steps[0])}
              >
                {left.count} to fill
                <ArrowRightIcon data-icon="inline-end" aria-hidden />
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-body-compact font-medium text-success-ink">
                <CheckIcon className="size-4" aria-hidden />
                Ready to sign
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <OrderSaveIndicator />
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-fit"
              onClick={() =>
                toast("Draft saved. Reopen it from Today’s hearings.")
              }
            >
              Save draft
            </Button>
            <Button
              type="button"
              className="w-full sm:w-fit"
              onClick={() => {
                if (left.count) {
                  if (left.steps[0]) go(left.steps[0]);
                  toast(`${left.count} to fill before it can be signed.`);
                  return;
                }
                setAskOpen(true);
              }}
            >
              Send for signing
            </Button>
          </div>
        </div>
      </footer>

      {menu && menuShown ? (
        <CaretMenu
          id={menuId}
          rect={menu.trigger.rect}
          groups={menuGroups}
          selected={selectedEntry?.id ?? firstSelectable(menuGroups)}
          empty="Nothing matches."
          onPick={(entry) => pick(entry.id)}
          onHover={(id) =>
            setMenu((current) =>
              current ? { ...current, selected: id } : current,
            )
          }
        />
      ) : null}

      {combo ? (
        <BlankCombo
          rect={combo.rect}
          label={combo.label}
          options={blankOptions(combo.label, {
            context,
            applications: applications.map((entry) => ({
              number: entry.number,
              type: entry.type,
              filedBy: entry.filedBy,
            })),
          })}
          onPick={fillBlank}
          onLeave={() => {
            const range = combo.range;
            setCombo(null);
            selectRange(range);
          }}
        />
      ) : null}

      <ProceedingsTemplateChooser
        open={chooserOpen}
        onOpenChange={setChooserOpen}
        purposeLabel={purpose ? courtHearingPurposeLabel(purpose) : undefined}
        suggested={suggestedTemplates(purpose)}
        saved={saved}
        canSave={!pageEmpty}
        onSave={saveTemplate}
        onUse={applyTemplate}
        onBlank={() => {
          afterChooser.current = {
            id: blocks[blocks.length - 1].id,
            at: "end",
          };
        }}
        onClosed={() => {
          focusAfter.current = afterChooser.current ?? {
            id: blocks[blocks.length - 1].id,
            at: "end",
          };
          afterChooser.current = null;
          setRevs((current) => ({ ...current }));
        }}
      />

      <AlertDialog open={askOpen} onOpenChange={setAskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this order for signing?</AlertDialogTitle>
            <AlertDialogDescription>
              {signingConsequences({
                draft: { ...draft, blocks },
                context,
                applications,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                toast("Sent for signing. It is in Sign orders, under Pending.")
              }
            >
              Send for signing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {applicationDialog?.(decide)}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

/* ────────────────────────────────── helpers ────────────────────────────────── */

function motion(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/**
 * A short wash on what a jump landed on, so the eye finds it — a tint that fades back
 * to the thing's own fill, rather than a focus ring on something nobody is typing in.
 */
function flash(el: HTMLElement | null) {
  if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  /* An even margin of air round what can be seen — a section's heading row and its
     last control already hold some space of their own, so the wash is measured from
     the words, not the box, and sits 16px clear of them on all four sides. A thing
     with its own border (an item's box) is washed inside that border, never past it. */
  const AIR = 16;
  const box = el.getBoundingClientRect();
  /* What is seen: the words themselves, and any element with no children (a field, an
     icon, an empty line waiting to be typed in) or with a fill or border of its own. */
  const words: DOMRect[] = [];
  const walker = window.document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim() || node.parentElement?.closest(".sr-only"))
      continue;
    const range = window.document.createRange();
    range.selectNodeContents(node);
    words.push(...range.getClientRects());
  }
  const boxes = [...el.querySelectorAll<HTMLElement>("*")]
    .filter((node) => {
      if (node.children.length === 0 && !node.textContent?.trim()) return true;
      const style = getComputedStyle(node);
      return (
        style.borderTopWidth !== "0px" ||
        style.backgroundColor !== "rgba(0, 0, 0, 0)"
      );
    })
    .map((node) => node.getBoundingClientRect());
  const seen = [...words, ...boxes].filter(
    (rect) =>
      rect.width > 1 &&
      rect.height > 1 &&
      rect.left >= box.left - 1 &&
      rect.right <= box.right + 1,
  );
  const bordered = getComputedStyle(el).borderTopWidth !== "0px";
  const reach = (inside: number) =>
    bordered ? 0 : Math.max(0, Math.round(AIR - inside));
  const top = seen.length
    ? reach(Math.min(...seen.map((rect) => rect.top)) - box.top)
    : 0;
  const bottom = seen.length
    ? reach(box.bottom - Math.max(...seen.map((rect) => rect.bottom)))
    : 0;
  const side = seen.length
    ? reach(Math.min(...seen.map((rect) => rect.left)) - box.left)
    : 0;
  /* Four copies of the box, one pushed to each corner, make one rounded rectangle
     that much larger on each side. */
  const tint = "var(--accent-strong)";
  const wash = [
    [-side, -top],
    [side, -top],
    [-side, bottom],
    [side, bottom],
  ]
    .map(([x, y]) => `${x}px ${y}px 0 0 ${tint}`)
    .join(", ");
  /* A bordered box keeps its own corners and shadow; only its fill is washed. */
  const shape = bordered
    ? {}
    : { borderRadius: "var(--radius-lg)", boxShadow: wash };
  el.animate(
    [
      { backgroundColor: tint, ...shape },
      { backgroundColor: tint, ...shape, offset: 0.35 },
      bordered ? {} : { borderRadius: "var(--radius-lg)" },
    ],
    { duration: 1400, easing: "ease-out" },
  );
}

/* D's column bounds: the index never narrower than its step names need, nor wider
   than a sidebar; the side panel between a third and two thirds of what it shares. */
const INDEX_DEFAULT = 240;
const INDEX_MIN = 192;
const INDEX_MAX = 320;
const SHARE_DEFAULT = 0.45;
const SHARE_MIN = 0.3;
const SHARE_MAX = 0.65;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * A handle in the gap between two of D's columns: drag it, or focus it and use the
 * arrow keys, to give one column room from the other; a double press resets. A hairline
 * shows where it is on hover or focus, with a grip at its middle — at rest the gap is
 * just a gap. It is a `separator` with its value, so it is announced and operable
 * without a pointer.
 */
function ColumnResizer({
  label,
  valueNow,
  valueMin,
  valueMax,
  valueText,
  onDrag,
  onStep,
  onReset,
}: {
  label: string;
  valueNow: number;
  valueMin: number;
  valueMax: number;
  valueText: string;
  /** `start` once as the drag begins (dx 0), then the distance moved since. */
  onDrag: (dx: number, start: boolean) => void;
  /** One step left (-1) or right (1), from the keyboard. */
  onStep: (by: -1 | 1) => void;
  onReset: () => void;
}) {
  const from = React.useRef<number | null>(null);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={valueNow}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      aria-valuetext={valueText}
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        from.current = event.clientX;
        onDrag(0, true);
      }}
      onPointerMove={(event) => {
        if (from.current === null) return;
        onDrag(event.clientX - from.current, false);
      }}
      onPointerUp={(event) => {
        from.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          onStep(event.key === "ArrowLeft" ? -1 : 1);
        }
        if (event.key === "Home" || event.key === "Enter") {
          event.preventDefault();
          onReset();
        }
      }}
      className="group/resize relative hidden cursor-col-resize touch-none justify-center outline-none select-none lg:sticky lg:top-(--order-panel-top) lg:flex lg:h-(--order-panel-fill)"
    >
      <span className="h-full w-px transition-colors group-hover/resize:bg-input group-focus-visible/resize:bg-ring group-active/resize:bg-ring" />
      <span className="absolute top-1/2 h-10 w-1.5 -translate-y-1/2 rounded-full bg-input opacity-0 transition-opacity group-hover/resize:opacity-100 group-focus-visible/resize:bg-ring group-focus-visible/resize:opacity-100 group-active/resize:bg-ring group-active/resize:opacity-100" />
    </div>
  );
}

/**
 * The block's handle, in the page's margin to its left, shown on hover or focus — one
 * control in the margin rather than two, so the page keeps its ordinary padding
 * (owner, 2026-10-13). Its menu adds below, moves, or removes the block. "Order item
 * below" opens the item picker on the handle itself.
 */
function BlockGutter({
  kind,
  label,
  first,
  last,
  pickerOpen,
  onPickerOpenChange,
  purpose,
  reasonFor,
  onAdd,
  onMove,
  onRemove,
}: {
  /** Which line the handle sits level with: an item's header row, or a paragraph's first line. */
  kind: "item" | "text";
  label: string;
  first: boolean;
  last: boolean;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  purpose?: string;
  reasonFor: (template: OrderTemplate) => string | null;
  onAdd: (choice: PickerChoice) => void;
  onMove: (by: -1 | 1) => void;
  /** Absent for a fixed block, which cannot be removed. */
  onRemove?: () => void;
}) {
  /* "Order item below" opens the picker once the menu has closed and let go of focus. */
  const pickerNext = React.useRef(false);
  return (
    <div
      className={cn(
        /* 20px wide and 8px clear of the block, so it sits inside the page's 32px
           margin with room either side. Level with the item's name in its header row
           (10px down), or centred on a paragraph's first 24px line (2px up). */
        "absolute right-full mr-2 hidden transition-opacity md:block",
        kind === "item" ? "top-2.5" : "-top-0.5",
        pickerOpen
          ? "opacity-100"
          : "opacity-0 group-focus-within/blk:opacity-100 group-hover/blk:opacity-100 has-[[aria-expanded=true]]:opacity-100",
      )}
    >
      <OrderItemPicker
        open={pickerOpen}
        onOpenChange={onPickerOpenChange}
        purpose={purpose}
        reasonFor={reasonFor}
        onChoose={onAdd}
        trigger={
          <span aria-hidden className="pointer-events-none absolute inset-0" />
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Add, move or remove ${label}`}
            className="relative flex h-7 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors after:absolute after:-inset-x-2.5 after:-inset-y-1.5 after:content-[''] hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-accent-strong data-[state=open]:text-foreground"
          >
            <GripVerticalIcon aria-hidden className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-52"
          onCloseAutoFocus={(event) => {
            if (!pickerNext.current) return;
            pickerNext.current = false;
            event.preventDefault();
            onPickerOpenChange(true);
          }}
        >
          <DropdownMenuItem onSelect={() => onAdd("text")}>
            <PlusIcon aria-hidden />
            Text below
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              pickerNext.current = true;
            }}
          >
            <PlusIcon aria-hidden />
            Order item below
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={first} onSelect={() => onMove(-1)}>
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={last} onSelect={() => onMove(1)}>
            Move down
          </DropdownMenuItem>
          {onRemove ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                Remove
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** The next date and what it is for — or why there is none. */
function NextHearing({
  draft,
  today,
  closingName,
  onChange,
}: {
  draft: OrderDraft;
  today: string;
  closingName: string | null;
  onChange: (
    change: Partial<Pick<OrderDraft, "next" | "nextDate" | "nextPurpose">>,
  ) => void;
}) {
  if (closingName) {
    return (
      <section
        id="proc-next"
        tabIndex={-1}
        className="flex min-w-0 scroll-mt-40 flex-col gap-1 outline-none"
      >
        <h2 className="flex min-h-10 items-center text-body-compact font-semibold">
          Next hearing
        </h2>
        <p className="text-body-compact text-muted-foreground">
          None. {closingName} closes the case.
        </p>
      </section>
    );
  }
  return (
    <section
      id="proc-next"
      tabIndex={-1}
      aria-labelledby="proc-next-heading"
      className="flex min-w-0 scroll-mt-40 flex-col gap-3 outline-none"
    >
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="proc-next-heading" className="text-body-compact font-semibold">
          Next hearing
        </h2>
        <div className="flex items-center gap-2">
          <Checkbox
            id="proc-next-none"
            checked={draft.next === "none"}
            onCheckedChange={(checked) =>
              onChange({ next: checked === true ? "none" : "list" })
            }
          />
          <Label
            htmlFor="proc-next-none"
            className="cursor-pointer text-body-compact font-normal"
          >
            Not listed again
          </Label>
        </div>
      </div>
      {draft.next === "none" ? null : (
        <div className="grid min-w-0 gap-x-4 gap-y-2 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <span
              id="proc-next-date-label"
              className="text-body-compact font-medium"
            >
              Date
            </span>
            <TypedDateField
              id="proc-next-date"
              labelledBy="proc-next-date-label"
              value={draft.nextDate ?? ""}
              today={today}
              onChange={(iso) => onChange({ nextDate: iso || null })}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <span
              id="proc-next-purpose-label"
              className="text-body-compact font-medium"
            >
              Purpose
            </span>
            <PurposeField
              id="proc-next-purpose"
              value={draft.nextPurpose}
              onChange={(nextPurpose) => onChange({ nextPurpose })}
              labelledBy="proc-next-purpose-label"
            />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Preview order: the order as it will be signed. Read only. A value not yet set still
 * shows as its blank, and pressing it goes to where it is set in Drafting.
 */
function PreviewOrder({
  blocks,
  draft,
  context,
  appearances,
  applications,
  listing,
  signatory,
  labelFor,
  linked,
  onGap,
}: {
  blocks: ComposerBlock[];
  draft: OrderDraft;
  context: ComposerContext;
  /** Absent outside a hearing: no attendance line. */
  appearances?: Appearance[];
  applications: ProceedingsApplication[];
  listing: boolean;
  signatory: string;
  labelFor: (id: string) => string;
  linked: string[];
  onGap: (target: string) => void;
}) {
  const gap = (label: string, target: string, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => onGap(target)}
      className="rounded-sm bg-warning-muted px-0.5 text-warning-muted-foreground hover:underline hover:underline-offset-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {label}
    </button>
  );

  /* A value that is set, marked on the paper as it is in the drafting — and, like a gap,
     a press away from where it is set. */
  const value = (text: string, target: string, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => onGap(target)}
      className="rounded-sm bg-brand-muted px-0.5 text-brand-muted-foreground hover:underline hover:underline-offset-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {text}
    </button>
  );

  /* Each line knows the part of the drafting it comes from, so the paper can follow
     the drafting (`data-preview-line`). */
  const lines: { target: string; node: React.ReactNode }[] = [];
  const push = (target: string, node: React.ReactNode) =>
    lines.push({ target, node });
  if (appearances) {
    const attendance = attendanceRecital(appearances, draft.marks);
    push(
      "order-attendance",
      attendance.length
        ? attendance.map((line) => `${line.label}: ${line.value}`).join(" ")
        : ["Present: ", gap("attendance", "order-attendance", "att"), "."],
    );
  }
  for (const application of applications) {
    const decision = draft.applications[application.id];
    if (decision) push("order-applications", application.sentence(decision));
  }
  for (const block of blocks) {
    if (block.kind === "item") {
      const parts = itemParts(block, context);
      if (!parts.length) continue;
      push(
        `block-${block.id}`,
        parts.map((part, index) => {
          if (typeof part === "string")
            return <React.Fragment key={index}>{part}</React.Fragment>;
          const piece = itemValuePiece(block, part.k, context);
          return piece.missing
            ? gap(piece.label.toLowerCase(), `block-${block.id}`, `${index}`)
            : value(piece.text, `block-${block.id}`, `${index}`);
        }),
      );
      continue;
    }
    if (!block.text.trim()) continue;
    push(
      `block-${block.id}`,
      paraParts(block.text).flatMap((part, index) => {
        if (typeof part !== "string")
          return [
            <React.Fragment key={index}>{labelFor(part.ref)}</React.Fragment>,
          ];
        return part
          .split(/(\[[^\]\n]+\])/)
          .map((piece, inner) =>
            /^\[[^\]\n]+\]$/.test(piece) ? (
              gap(piece.slice(1, -1), `block-${block.id}`, `${index}-${inner}`)
            ) : (
              <React.Fragment key={`${index}-${inner}`}>{piece}</React.Fragment>
            ),
          );
      }),
    );
  }
  if (listing) {
    push("proc-next", [
      "Next hearing is scheduled on ",
      draft.nextDate
        ? value(formatOrderDate(draft.nextDate), "proc-next", "nd")
        : gap("date", "proc-next", "nd"),
      " for ",
      draft.nextPurpose
        ? value(
            courtHearingPurposeLabel(draft.nextPurpose).replace(/^./, (c) =>
              c.toLowerCase(),
            ),
            "proc-next",
            "np",
          )
        : gap("purpose", "proc-next", "np"),
      ".",
    ]);
  } else if (draft.next === "none") {
    push("proc-next", "Not listed again.");
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4">
        {lines.map((line, index) => (
          <p
            key={index}
            data-preview-line={line.target}
            className="-mx-2 rounded-md px-2 text-body"
          >
            {line.node}
          </p>
        ))}
      </div>
      <p className="mt-12 text-right text-body-compact">
        {signatory}
        <br />
        <span className="text-muted-foreground">Not signed</span>
      </p>
      {linked.length ? (
        <p className="mt-8 border-t border-hairline pt-4 text-body-compact text-muted-foreground">
          Linked to {linked.map(labelFor).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
