"use client";

import type * as React from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ChevronDownIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  TableIcon,
  UnderlineIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  GHOST_ATTRIBUTE,
  matchSpan,
  pickSuggestion,
  readProsePrefix,
  readSuggestTrigger,
  stripGhostHtml,
  suggestionHost,
} from "@/lib/rich-text/ghost";
import {
  addColumnRight,
  addRowBelow,
  caretInto,
  cellAt,
  deleteColumn,
  deleteRow,
  deleteTable,
  ensureLineAfterTables,
  hasTable,
  siblingCell,
  tableHtml,
} from "@/lib/rich-text/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFieldControlProps } from "@/components/ui/field";
import { MENU_GROW } from "@/components/chrome/motion";
import { InputGroup } from "@/components/ui/input-group";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * Formatted long-form input, composed at screen level.
 *
 * The design system has no rich text editor (ds-requests #7), so this borrows
 * DS chrome rather than inventing any: an InputGroup supplies the bordered
 * well, focus ring and invalid state that Textarea would have given, and the
 * marks are DS ToggleGroups in a `role="toolbar"` strip. Nothing under
 * `components/ui` is edited or forked.
 *
 * **The toolbar is transparent, and the 40px buttons stay 40px** (2026-09-14). The marks
 * were `ToggleGroup variant="outline"`, so every one of the seven carried a border and a
 * card fill: three bordered blocks of form-weight controls above a paragraph, which is
 * the whole reason the field read as unfinished. `default` is the toolbar treatment — the
 * button is nothing at rest, `accent` on hover, `accent-strong` when it is on, so the one
 * mark on the strip is the format actually in force. **Do not shrink the buttons to make
 * the strip lighter**: `ACCESSIBILITY.md` §8 puts the interactive floor at 40×40 and says
 * a smaller visual must expand its hit area to reach it, so the size is the target and
 * the size was never what looked heavy. The border was.
 *
 * InputGroupAddon is not the toolbar. That slot is prefix chrome (a dialling
 * code, a search icon) — `cursor-text`, muted label colour, click-to-focus an
 * `<input>`. Putting ToggleGroups there made the strip read as a second field
 * row. The layout hook InputGroup already exposes (`h-auto flex-col`) is
 * enough to stack a toolbar above the control.
 *
 * The editing surface itself is the piece the DS cannot supply — a
 * contentEditable region driven by document.execCommand. That API is
 * deprecated but still the only dependency-free way to get bold, italic,
 * lists and alignment out of one surface.
 */

/*
 * Restores what Preflight strips, for the editor *and* for `RichTextValueView` — the two
 * have to agree about what the same markup looks like. `[&_u]:underline` is belt and
 * braces: `u` keeps its default rule today, and an underline that silently rendered as
 * plain text would be a mark the typist applied and the order never showed.
 */
const LIST_CLASSES =
  "[&_ol]:list-decimal [&_ol]:ps-6 [&_ul]:list-disc [&_ul]:ps-6 [&_u]:underline";

/*
 * Tables, for the fields that allow them (`tables`), and on every view — a value that
 * holds a table must read the same wherever it is shown, and on the order paper that is
 * what prints. Fixed layout so a blank table opens with even columns and a long word
 * wraps in its cell instead of pushing the page wider; the `border` token rather than
 * `hairline`, because a grid that disappears on paper is not a table. A row never splits
 * across a printed page.
 */
const TABLE_CLASSES =
  "[&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse [&_tr]:break-inside-avoid [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:align-top [&_th]:font-semibold [&_th]:wrap-break-word [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:wrap-break-word";

/** What the editor and `RichTextValueView` both wear, so the two always agree. */
const CONTENT_CLASSES = cn(LIST_CLASSES, TABLE_CLASSES);

/** Both shapes are kept: html renders the formatting, text drives validation. */
export type RichTextValue = {
  html: string;
  text: string;
};

export const EMPTY_RICH_TEXT: RichTextValue = { html: "", text: "" };

type MarkCommand = "bold" | "italic" | "underline";
type ListCommand = "insertUnorderedList" | "insertOrderedList";
type AlignCommand = "justifyLeft" | "justifyCenter" | "justifyRight";

const MARKS: { command: MarkCommand; label: string; Icon: typeof BoldIcon }[] = [
  { command: "bold", label: "Bold", Icon: BoldIcon },
  { command: "italic", label: "Italic", Icon: ItalicIcon },
  { command: "underline", label: "Underline", Icon: UnderlineIcon },
];

const LISTS: { command: ListCommand; label: string; Icon: typeof BoldIcon }[] = [
  { command: "insertUnorderedList", label: "Bulleted list", Icon: ListIcon },
  { command: "insertOrderedList", label: "Numbered list", Icon: ListOrderedIcon },
];

const ALIGNMENTS: {
  command: AlignCommand;
  label: string;
  Icon: typeof BoldIcon;
}[] = [
  { command: "justifyLeft", label: "Align left", Icon: AlignLeftIcon },
  { command: "justifyCenter", label: "Align centre", Icon: AlignCenterIcon },
  { command: "justifyRight", label: "Align right", Icon: AlignRightIcon },
];

function commandState(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

/**
 * Toggling a formatting command is symmetric — execCommand flips it either
 * way — so run whichever entry differs between the old and new selection.
 */
function changedCommands(next: string[], current: string[]): string[] {
  return [...new Set([...next, ...current])].filter(
    (command) => next.includes(command) !== current.includes(command)
  );
}

/**
 * What one accepted completion puts in the field.
 *
 * Two shapes, because the two things this composer completes are not the same kind of
 * writing: a *direction* the court passed is a paragraph of its own — running two of
 * them together would make the court say something neither says — while a *phrase* is a
 * sentence in the one being typed. Inline arrives as text through `insertText`, so it
 * carries no markup and the browser's own undo keeps working on it.
 */
export type RichTextInsertion =
  | { kind: "inline"; text: string }
  | { kind: "block"; html: string };

/**
 * Inline completion, off unless a screen asks for it.
 *
 * The field owns the mechanics — when a completion is being asked for, the preview, the
 * keys, and keeping the preview out of the value — and the caller owns the meaning: what
 * the corpus is, how it is ranked, and what accepting one *records*. Three screens on
 * the citizen side use this field without passing this, and nothing about them changes.
 */
/**
 * Where a completion came from, because the two are not the same offer.
 *
 * `"trigger"`: the reader typed the trigger and a word, and is *naming* something — so
 * the trigger and the word were a search, and accepting replaces them.
 *
 * `"prose"`: they are typing a sentence and it is being finished for them. Nothing they
 * typed is replaced; the completion is only ever the part they have not reached.
 */
export type SuggestMode = "trigger" | "prose";

/**
 * One answer. Finishing a sentence, `ghost` is shown and `label` is said. Naming one
 * after the trigger, the slash menu lists `label`, with `detail` — a line of what it
 * puts in — under it.
 */
type SuggestAnswer = { key: string; label: string; ghost: string; detail?: string };

/**
 * The slash menu: every answer to the query, the one Enter would take, and what was
 * typed. Kept, with `open` false, while it fades out, so it does not empty as it goes.
 */
type SlashMenu = {
  answers: readonly SuggestAnswer[];
  active: number;
  query: string;
  open: boolean;
};

export type RichTextSuggestion = {
  /** What the typed words could become, best first. */
  resolve: (query: string, mode: SuggestMode) => readonly SuggestAnswer[];
  /** Accepted — record it, and return what to put in the document. */
  accept: (
    key: string,
    query: string,
    mode: SuggestMode,
  ) => RichTextInsertion | null;
};

export function RichTextField({
  value,
  onChange,
  labelId,
  className,
  suggestion,
  compact = false,
  header,
  footer,
  pageClassName,
  tables = false,
}: {
  value: RichTextValue;
  onChange: (value: RichTextValue) => void;
  /** The FieldLabel's id — a contentEditable region is not labelable. */
  labelId: string;
  className?: string;
  /** See `RichTextSuggestion`. Absent on every field that does not want it. */
  suggestion?: RichTextSuggestion;
  /** Inside a dialog: a textarea's height and type, and a 32px toolbar. The
   *  full-page size made one optional field fill the whole modal. */
  compact?: boolean;
  /**
   * Fixed lines around the editable text, below the toolbar — a document's own heading
   * and signature block, shown on the page but not typed into (order screen E, owner
   * 2026-10-14). With either, the three sit in one wrapper that takes `pageClassName`,
   * so a page can scroll under a toolbar that stays put.
   */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  pageClassName?: string;
  /**
   * Inserting and editing tables — off unless a screen asks (order screen E's order
   * page and its shortcut templates). The citizen-side fields never offer it. A value
   * that already holds a table renders it either way.
   */
  tables?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initialHtmlRef = useRef(value.html);
  const fieldProps = useFieldControlProps({});
  const [marks, setMarks] = useState<string[]>([]);
  const [lists, setLists] = useState<string[]>([]);
  const [alignment, setAlignment] = useState<AlignCommand>("justifyLeft");
  /**
   * The completion on screen, and what the reader has done to it.
   *
   * `ghostRef` is the node itself, held so the value can be read without it (see
   * `emitChange`) and removed the instant any other key is pressed. `heldRef` and
   * `indexRef` are the reader's place in the answers: held so that recomputing on every
   * keystroke does not swap the passage under their eyes, and the index so that ↓ stays
   * where they put it until the query changes.
   */
  const ghostRef = useRef<HTMLElement | null>(null);
  const heldRef = useRef<string | null>(null);
  const indexRef = useRef(0);
  const queryRef = useRef<string | null>(null);
  const modeRef = useRef<SuggestMode | null>(null);
  const [shown, setShown] = useState<{ key: string; label: string } | null>(
    null,
  );
  const [menu, setMenu] = useState<SlashMenu | null>(null);
  /** What the menu hangs from: the slash and the query typed after it, live. */
  const anchorRef = useRef<{
    getBoundingClientRect: () => DOMRect;
    contextElement: Element;
  } | null>(null);
  /** The slash Escape put away, so typing on after it does not bring the menu back. */
  const dismissedRef = useRef<{ host: Node; slash: number } | null>(null);
  const menuContentRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const menuLabelId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  /**
   * The table cell the caret was last in. Held rather than read at the moment of use,
   * because opening the table menu moves focus off the editor — the menu acts on the
   * cell the typist was in when they opened it. `landRef` is where the caret goes once
   * the menu has closed.
   */
  const cellRef = useRef<HTMLTableCellElement | null>(null);
  const landRef = useRef<Element | null>(null);
  const [inTable, setInTable] = useState(false);

  const syncToolbar = useCallback(() => {
    setMarks(MARKS.map((m) => m.command).filter(commandState));
    setLists(LISTS.map((l) => l.command).filter(commandState));
    setAlignment(
      ALIGNMENTS.find((item) => commandState(item.command))?.command ??
        "justifyLeft"
    );
    if (tables) {
      const editor = editorRef.current;
      const selection = window.getSelection();
      const node =
        selection && selection.rangeCount > 0
          ? selection.getRangeAt(0).startContainer
          : null;
      const cell = editor && node ? cellAt(editor, node) : null;
      cellRef.current = cell;
      setInTable(cell !== null);
    }
  }, [tables]);

  /**
   * The one place a value leaves this field — so it is the one place the preview has to
   * be gone.
   *
   * The node is detached, both halves are read, and it goes straight back: `innerText`
   * would otherwise hand the caller the suggested words as though the typist had written
   * them, and `innerHTML` would put them in the draft, on the page beside the composer,
   * and into what gets signed. `stripGhostHtml` is the belt behind the braces — one
   * regex at the chokepoint, in case a preview ever reaches the markup by a path this
   * function does not know about.
   */
  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const ghost = ghostRef.current;
    const parent = ghost?.parentNode ?? null;
    const next = ghost?.nextSibling ?? null;
    if (ghost && parent) parent.removeChild(ghost);
    const emitted = {
      html: stripGhostHtml(editor.innerHTML),
      text: editor.innerText,
    };
    if (ghost && parent) parent.insertBefore(ghost, next);
    onChange(emitted);
  }, [onChange]);

  /** Take the preview off the screen. Called before any key that is not about it. */
  const clearGhost = useCallback(() => {
    ghostRef.current?.remove();
    ghostRef.current = null;
    setShown((current) => (current === null ? current : null));
  }, []);

  const closeMenu = useCallback(() => {
    setMenu((current) => (current?.open ? { ...current, open: false } : current));
  }, []);

  /** Put away whatever is offered — the preview or the menu. */
  const dismiss = useCallback(() => {
    clearGhost();
    closeMenu();
  }, [clearGhost, closeMenu]);

  /* Whether the menu's list runs past its top or foot — drawn as fades. */
  const [listOverflow, setListOverflow] = useState<ListOverflow>({
    above: false,
    below: false,
  });
  const measureList = useCallback((node: HTMLElement) => {
    setListOverflow((current) => readOverflow(node, current));
  }, []);
  /* Measured as the list mounts — in a portal, a render after the menu opens — and
     again when its height or its rows change: typing narrows it under the fades. */
  const watchList = useCallback(
    (node: HTMLUListElement | null) => {
      if (!node) return;
      const measure = () => measureList(node);
      const resize = new ResizeObserver(measure);
      const rows = new MutationObserver(measure);
      resize.observe(node);
      rows.observe(node, { childList: true });
      measure();
      return () => {
        resize.disconnect();
        rows.disconnect();
      };
    },
    [measureList],
  );

  /* The row ↑ and ↓ land on stays in view in a list longer than the menu. */
  useEffect(() => {
    if (!menu?.open || menu.active < 0) return;
    document
      .getElementById(`${listboxId}-option-${menu.active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [menu, listboxId]);

  /**
   * Where the caret is, in the terms the trigger rule is written in.
   *
   * **Only at the end of its block.** A preview is drawn by appending one node to the
   * block the caret is in, which is exact and caret-safe precisely because nothing has
   * to be split to do it. Arming a completion in the middle of a line would mean
   * splitting the text node the caret sits in on every keystroke — the caret is the one
   * thing a typist cannot afford this screen to lose — so mid-line the trigger types a
   * plain slash and offers nothing. Stated rather than hidden: it is the common case
   * while dictation is being typed, and the uncommon one is left alone.
   */
  const caretReading = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || !selection.isCollapsed) return null;
    if (selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer)) return null;

    /**
     * **The host has to be an element, and the caret is often not inside one.**
     *
     * An empty order box has no paragraph in it: click into it and type, and the browser
     * puts a bare text node straight into the `contentEditable` div. Walking up to "the
     * child of the editor the caret is under" then lands on that *text node*, and this
     * function used to hand it back as the host — which read the caret wrongly and then
     * threw on `appendChild`, because a text node cannot take a child. So typing `/`
     * into an empty order did nothing at all, which is the first thing anyone would try
     * (owner, 2026-09-16).
     *
     * An element child is the host; anything else — a bare text node, or the caret
     * sitting directly in the editor before anything has been typed — makes the editor
     * itself the host. Both can hold the preview, and `before` is measured from the same
     * node it is later searched in, so the trigger is found in the same coordinates it
     * was read in.
     */
    /* Both of this function's own failures live in `suggestionHost`, with the tests
       that pin them: an empty box has no paragraph to append to, and a caret on the
       editor must not send the walk climbing out of it. */
    /* Inside a table cell the cell is the block: the preview goes in the cell, and
       "nothing after the caret" means nothing after it *in that cell*, not in every
       cell to its right. */
    const scope = cellAt(editor, range.startContainer) ?? editor;
    const host = suggestionHost(scope, range.startContainer) as HTMLElement | null;
    if (!host) return null;

    const after = document.createRange();
    after.setStart(range.startContainer, range.startOffset);
    after.setEnd(host, host.childNodes.length);
    if (after.toString().trim() !== "") return null;

    const before = document.createRange();
    before.setStart(host, 0);
    before.setEnd(range.startContainer, range.startOffset);
    return { host, before: before.toString() };
  }, []);

  // Restore on mount — rewriting innerHTML while typing eats the caret.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && initialHtmlRef.current) {
      editor.innerHTML = initialHtmlRef.current;
    }
  }, []);

  /**
   * **A value that arrives after mount is taken in — but never under the typist.**
   *
   * A saved draft loads from the browser after hydration, so the field mounts on the
   * server's empty value and the draft arrives a moment later. Read on mount only, the
   * page stayed blank while the draft still held the words (2026-10-16: an order typed,
   * reloaded, showed nothing). So when the value differs from what is on the page and
   * the reader is not in the field, the page takes the value. While they are in it, the
   * page is the truth and the value only follows it, so nothing is rewritten.
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const active = document.activeElement;
    if (active && (active === editor || editor.contains(active))) return;
    if (stripGhostHtml(editor.innerHTML) !== value.html) {
      editor.innerHTML = value.html;
    }
  }, [value.html]);

  // Keep the pressed states honest as the caret moves through the content.
  useEffect(() => {
    function handleSelectionChange() {
      if (document.activeElement === editorRef.current) syncToolbar();
    }
    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, [syncToolbar]);

  /**
   * Draw — or redraw — the completion for what has been typed.
   *
   * Runs on every keystroke, which is why it holds its answer: `heldRef` keeps the
   * passage the reader is looking at while it still answers the query, so narrowing
   * `/s` to `/su` does not flick through three directions on the way. The index resets
   * when the query changes, because ↓ meant "the second answer to *that*".
   */
  function paintSuggestion() {
    if (!suggestion) return;
    /* **Off the screen before the caret is read.** The preview is appended to the block
       the caret is in, which puts it *between* the caret and the end of that block — so
       `caretReading`, which is the rule "nothing after the caret", answers `null` while
       a preview is up. Every path that reads the caret takes the node down first: this
       one so that ↓ can redraw, and `acceptSuggestion` so that Tab can find the trigger
       at all. */
    /* Detached to be measured, and put back in the same task, so nothing is ever
       painted without it: `caretReading` asks "is there anything after the caret", and
       the preview itself is after the caret. Taking it down across two tasks — which is
       what clearing on `keydown` and redrawing on `input` did — blinked it on every
       keystroke, which is most of what made this read as forced (owner, 2026-09-16). */
    const standing = ghostRef.current;
    standing?.remove();
    const reading = caretReading();
    /* **The trigger is asked first, and it wins.** A slash in the line means the reader
       is naming a standing order; without one they are writing a sentence, and the
       sentence itself is the query. Only one of the two rules ever answers — see
       `readProsePrefix`, which hands anything holding a slash back. */
    const trigger = reading ? readSuggestTrigger(reading.before) : null;
    const prose = reading && trigger === null
      ? readProsePrefix(reading.before)
      : null;
    const mode: SuggestMode = trigger === null ? "prose" : "trigger";
    const query = trigger ?? prose;
    if (!reading || query === null) {
      queryRef.current = null;
      modeRef.current = null;
      ghostRef.current = null;
      dismissedRef.current = null;
      dismiss();
      return;
    }
    if (query !== queryRef.current || mode !== modeRef.current) {
      queryRef.current = query;
      modeRef.current = mode;
      indexRef.current = 0;
    }
    const answers = suggestion.resolve(query, mode);
    if (mode === "trigger") {
      ghostRef.current = null;
      showMenu(reading, query, answers);
      return;
    }
    closeMenu();
    if (answers.length === 0) {
      ghostRef.current = null;
      clearGhost();
      return;
    }
    const pick = pickSuggestion(answers, heldRef.current, indexRef.current);
    if (!pick) {
      ghostRef.current = null;
      clearGhost();
      return;
    }
    heldRef.current = pick.key;

    /* Exactly what the caller said to show: the part of the sentence not yet typed,
       which joins the words already on the line with no space of its own. */
    const words = pick.ghost;
    /* The same node, moved, when it says the same thing: a held candidate is the common
       case while a query narrows, and replacing the node then would restart it. */
    if (standing && standing.textContent === words) {
      reading.host.appendChild(standing);
      ghostRef.current = standing;
    } else {
      ghostRef.current = drawGhost(reading.host, words);
    }
    setShown((current) =>
      current?.key === pick.key ? current : { key: pick.key, label: pick.label },
    );
  }

  /**
   * **The slash opens a menu of every shortcut, and typing narrows it** (owner,
   * 2026-10-29, after Notion's slash command). It replaced one muted guess drawn after
   * the caret, which showed a single name at a time and hid that any others existed:
   * ↓ walked through them blind.
   *
   * The top row is the best match and the one Enter takes; the letters typed are set in
   * bold in each name, so it is plain why a row is there. The menu hangs from the slash
   * and moves with it — **always below it** (owner, 2026-10-29: flipped above the line it
   * *looks weird*). With the slash near the foot of the screen, the page scrolls up to
   * make room as it opens, and whatever room is left caps the list, which scrolls inside
   * it. A query that has run into a space and names nothing is a
   * sentence, not a search, and closes the menu; a single word that names nothing keeps
   * it open to say so.
   */
  function showMenu(
    reading: { host: HTMLElement; before: string },
    query: string,
    answers: readonly SuggestAnswer[],
  ) {
    const slash = reading.before.length - query.length - 1;
    const dismissed = dismissedRef.current;
    if (dismissed && dismissed.host === reading.host && dismissed.slash === slash) {
      dismiss();
      return;
    }
    dismissedRef.current = null;
    if (answers.length === 0 && /\s/.test(query)) {
      dismiss();
      return;
    }
    const start = pointAt(reading.host, slash);
    const selection = window.getSelection();
    if (start && selection && selection.rangeCount > 0) {
      const caret = selection.getRangeAt(0);
      const search = document.createRange();
      search.setStart(start.node, start.offset);
      search.setEnd(caret.startContainer, caret.startOffset);
      anchorRef.current = {
        /* Always below the slash, so it cannot step aside on the screen's edge: it is
           held inside the gutter here instead, by its own width. */
        getBoundingClientRect: () => {
          const rect = search.getBoundingClientRect();
          const width = menuContentRef.current?.offsetWidth ?? 0;
          const last = document.documentElement.clientWidth - MENU_GUTTER - width;
          const left = Math.max(MENU_GUTTER, Math.min(rect.left, last));
          return new DOMRect(left, rect.top, rect.width, rect.height);
        },
        /* So the menu follows the page when the order scrolls inside its frame. */
        contextElement: reading.host,
      };
      if (!menu?.open) {
        makeRoomBelow(reading.host, search.getBoundingClientRect().bottom);
      }
    }
    const count = answers.length;
    const active = count === 0 ? -1 : ((indexRef.current % count) + count) % count;
    const pick = active < 0 ? null : answers[active];
    setMenu({ answers, active, query, open: true });
    setShown((current) =>
      !pick
        ? null
        : current?.key === pick.key
          ? current
          : { key: pick.key, label: pick.label },
    );
  }

  /**
   * Escape on the menu: hold that slash closed while the typing goes on after it. Called
   * from the Popover's own Escape as well as the field's — the Popover hears the key
   * first and closes, so by the field's turn the menu may already read as shut.
   */
  function rememberDismissal() {
    const reading = caretReading();
    const query = queryRef.current;
    if (!reading || query === null || modeRef.current !== "trigger") return;
    dismissedRef.current = {
      host: reading.host,
      slash: reading.before.length - query.length - 1,
    };
  }

  /** The row under the pointer becomes the one Enter takes, as the keys would make it. */
  function pointMenuAt(index: number) {
    if (!menu || menu.active === index) return;
    const answer = menu.answers[index];
    if (!answer) return;
    indexRef.current = index;
    setMenu({ ...menu, active: index });
    setShown({ key: answer.key, label: answer.label });
  }

  /**
   * Put the shown completion in the document.
   *
   * The trigger and the words typed after it are what gets replaced — they were a
   * search, not prose — so the range from the slash to the caret goes, and the insertion
   * takes its place. A *direction* lands as its own block after the one being typed; a
   * *phrase* lands as text at the caret, through `insertText`, so the browser's undo
   * still knows what happened.
   *
   * Then the caret goes to the first `[…]` the insertion carries, selected rather than
   * collapsed in front of it: the token is a thing to be replaced, and a typist who
   * accepted an order with three blanks in it is going to type over the first.
   */
  function acceptSuggestion(key = shown?.key) {
    if (!suggestion || !key) return false;
    const query = queryRef.current;
    const mode = modeRef.current;
    dismiss();
    const reading = caretReading();
    if (!reading || query === null || mode === null) return false;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const insertion = suggestion.accept(key, query, mode);
    if (!insertion) return false;

    /**
     * **Only a search gets replaced.**
     *
     * Naming a standing order, the trigger and the word after it were never prose — they
     * were the question — so the range from the slash to the caret goes and the answer
     * takes its place. Finishing a sentence, the reader's own characters are the start of
     * it: nothing is deleted and the completion is only what they had not reached yet.
     * The second case is the whole reason this stopped feeling forced.
     */
    /* A slash typed after a space: the space goes with the search and comes back with
       the answer. Left behind, it is the block's trailing whitespace once the search is
       deleted, and the browser drops it on the insert — so the shortcut ran into the
       word before it (2026-10-14). */
    let lead = "";
    if (mode === "trigger") {
      let slash = reading.before.length - query.length - 1;
      if (
        insertion.kind === "inline" &&
        slash > 0 &&
        /\s/.test(reading.before[slash - 1])
      ) {
        slash -= 1;
        lead = " ";
      }
      const start = pointAt(reading.host, slash);
      if (!start) return false;
      const search = document.createRange();
      search.setStart(start.node, start.offset);
      search.setEnd(
        selection.getRangeAt(0).startContainer,
        selection.getRangeAt(0).startOffset,
      );
      search.deleteContents();
      selection.removeAllRanges();
      selection.addRange(search);
    }

    if (insertion.kind === "inline") {
      document.execCommand("insertText", false, lead + insertion.text);
      emitChange();
      return true;
    }

    const editor = editorRef.current;
    if (!editor) return false;
    /* **A table never lands inside another.** A shortcut whose text holds a table,
       accepted from inside a cell, goes in after the table the caret is in. */
    const cell = cellAt(editor, reading.host);
    const outerTable =
      cell && hasTable(insertion.html) ? cell.closest("table") : null;
    if (outerTable) {
      outerTable.insertAdjacentHTML("afterend", insertion.html);
      placeCaret(outerTable.nextElementSibling);
      ensureLineAfterTables(editor);
      emitChange();
      return true;
    }
    /* The editor itself, or a cell with no block inside it: no block to put the
       insertion after, so it goes in at the caret. */
    const host =
      reading.host === editor || reading.host === cell ? null : reading.host;
    if (!host) {
      document.execCommand("insertHTML", false, insertion.html);
      ensureLineAfterTables(editor);
      emitChange();
      return true;
    }
    host.insertAdjacentHTML("afterend", insertion.html);
    const placed = host.nextElementSibling;
    /* **The line the search was typed on goes if the search was all it held.** `/bail`
       on a fresh line is the common case, and leaving the emptied paragraph behind would
       put a blank line above every direction accepted that way. A line with the typist's
       own words on it stays, because the direction is a new paragraph under what they
       were already writing. */
    if ((host.textContent ?? "").trim() === "") host.remove();
    placeCaret(placed);
    ensureLineAfterTables(editor);
    emitChange();
    return true;
  }

  /**
   * A blank table at the caret — three columns, a header row and two body rows. Size is
   * not asked up front: rows and columns are one menu pick away once it is there, and
   * Tab in the last cell adds a row, so the default is never a commitment. With the
   * caret already in a table, the new one goes after it rather than inside it.
   */
  function insertTable() {
    const editor = editorRef.current;
    if (!editor) return;
    dismiss();
    const wasFocused = document.activeElement === editor;
    if (!wasFocused) editor.focus();
    const selection = window.getSelection();
    const anchor =
      wasFocused && selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).startContainer
        : null;
    const before = new Set(editor.querySelectorAll("table"));
    const current = anchor ? cellAt(editor, anchor)?.closest("table") : null;
    if (current) current.insertAdjacentHTML("afterend", tableHtml());
    else if (!anchor || !editor.contains(anchor))
      editor.insertAdjacentHTML("beforeend", tableHtml());
    else document.execCommand("insertHTML", false, tableHtml());
    const added = Array.from(editor.querySelectorAll("table")).find(
      (table) => !before.has(table),
    );
    ensureLineAfterTables(editor);
    caretInto(added?.querySelector("th, td") ?? null);
    emitChange();
    syncToolbar();
  }

  /** One of the table menu's edits, on the cell the caret was in when it opened. */
  function editTable(edit: (cell: HTMLTableCellElement) => Element | null) {
    const editor = editorRef.current;
    const cell = cellRef.current;
    if (!editor || !cell || !editor.contains(cell)) return;
    landRef.current = edit(cell);
    ensureLineAfterTables(editor);
    emitChange();
  }

  /** Back to the page once the menu closes — into the cell the edit left the caret in. */
  function returnFromTableMenu(event: Event) {
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const land = landRef.current ?? cellRef.current;
    landRef.current = null;
    if (land && editor.contains(land)) caretInto(land);
    syncToolbar();
  }

  /**
   * Tab walks the cells; Shift+Tab walks back. Tab in the last cell adds a row, as in
   * every word processor. Shift+Tab in the first cell is left to the browser, so the
   * field is never a keyboard trap: it leaves the field as Tab does outside a table.
   */
  function tabThroughTable(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const cell = cellAt(editor, selection.getRangeAt(0).startContainer);
    if (!cell) return;
    const next = siblingCell(cell, event.shiftKey ? -1 : 1);
    if (next) {
      event.preventDefault();
      caretInto(next);
      return;
    }
    if (event.shiftKey) return;
    event.preventDefault();
    caretInto(addRowBelow(cell));
    emitChange();
  }

  function run(commands: string[]) {
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement !== editor) editor.focus();
    for (const command of commands) document.execCommand(command);
    emitChange();
    syncToolbar();
  }

  const menuListed = menu !== null && menu.open && menu.answers.length > 0;

  const editable = (
    <div
      {...fieldProps}
      ref={editorRef}
      data-slot="input-group-control"
      role="textbox"
      aria-multiline="true"
      aria-labelledby={labelId}
      /* The slash menu is this field's popup list: focus stays here, and the row Enter
         would take is pointed to, as a combobox does (WAI-ARIA 1.2). */
      aria-autocomplete={suggestion ? "list" : undefined}
      aria-controls={menuListed ? listboxId : undefined}
      aria-activedescendant={
        menuListed && menu.active >= 0 ? optionId(menu.active) : undefined
      }
      contentEditable
      suppressContentEditableWarning
      className={cn(
        "w-full outline-none",
        compact
          ? "min-h-24 px-3 py-2 text-body-compact"
          : "min-h-64 px-4 py-3 text-body",
        CONTENT_CLASSES
      )}
      onInput={() => {
        if (tables && editorRef.current) ensureLineAfterTables(editorRef.current);
        emitChange();
        paintSuggestion();
      }}
      onFocus={syncToolbar}
      onBlur={dismiss}
      /**
       * The keys the completion answers to.
       *
       * **In the slash menu, Enter and Tab both take the highlighted row** and ↑ ↓ move
       * it, wrapping round, as in Notion (owner, 2026-10-29). Enter is safe there because
       * the menu is on screen saying what it will do; with no row to take — nothing
       * matches — Enter is a new line as ever. Not while an input method is composing:
       * Indic keyboards use Enter to commit a word.
       *
       * **Finishing a sentence, Tab accepts and Enter never does.** Enter is a paragraph
       * break, and the preview is easy to miss, so a typist reaching for a new line
       * would otherwise put the court's words into the order. ↓ and ↑ walk the other
       * answers inline.
       *
       * Escape puts either away and leaves every character the reader typed, including
       * the slash: taking their text back out on their behalf would be this field
       * editing a court record nobody asked it to touch.
       *
       * **Only the keys that could edit *into* the node take it down.** Every key used
       * to, and redrawing on the `input` that followed meant the preview blinked out
       * and back on every character typed — the jitter that made this read as forced.
       * A printable key inserts at the caret, which is *before* the node, so the node
       * is in no danger and stays where it is; `paintSuggestion` then moves it without
       * a repaint. Backspace and Delete work at exactly the boundary it sits on, and
       * Enter would split the block around it, so those three clear it first and the
       * next `input` draws it again.
       */
      onKeyDown={(event) => {
        /* A shown completion takes Tab first; with none, Tab in a table walks it. */
        if (tables && !(suggestion && shown)) tabThroughTable(event);
        if (event.defaultPrevented || !suggestion) return;
        if (event.nativeEvent.isComposing) return;
        const menuOpen = Boolean(menu?.open);
        if (
          shown &&
          (event.key === "Tab" ||
            (menuOpen && event.key === "Enter" && !event.shiftKey))
        ) {
          event.preventDefault();
          acceptSuggestion();
          return;
        }
        if ((shown || menuOpen) && event.key === "Escape") {
          event.preventDefault();
          if (menuOpen) rememberDismissal();
          queryRef.current = null;
          dismiss();
          return;
        }
        if (menu?.open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();
          if (menu.answers.length === 0) return;
          indexRef.current = menu.active + (event.key === "ArrowDown" ? 1 : -1);
          paintSuggestion();
          return;
        }
        /* The caret walking off the end of the search ends it. */
        if (
          menuOpen &&
          ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(
            event.key,
          )
        ) {
          dismiss();
          return;
        }
        if (shown && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
          event.preventDefault();
          indexRef.current = Math.max(
            0,
            indexRef.current + (event.key === "ArrowDown" ? 1 : -1),
          );
          paintSuggestion();
          return;
        }
        if (
          event.key === "Backspace" ||
          event.key === "Delete" ||
          event.key === "Enter"
        ) {
          clearGhost();
        }
      }}
      onPaste={(event) => {
        // Only ever hold markup this toolbar produced — paste arrives flat.
        event.preventDefault();
        document.execCommand(
          "insertText",
          false,
          event.clipboardData.getData("text/plain")
        );
        emitChange();
      }}
      onDrop={(event) => event.preventDefault()}
    />
  );

  return (
    <InputGroup className={cn("h-auto flex-col items-stretch", className)}>
      <div
        role="toolbar"
        aria-label="Formatting"
        /* `px-1` against the control's `px-4`: a 40px button centres a 16px icon at
           12px, so 4 + 12 lands the first icon on the same 16px line the text below it
           starts from. The toolbar and the paragraph read as one left edge instead of
           two that nearly agree. */
        className="flex w-full flex-wrap items-center gap-2 border-b border-hairline px-1 py-1"
        onMouseDownCapture={(event) => {
          // A button mousedown would steal focus and collapse the range
          // before execCommand runs. Cancel the default; the click still
          // fires and the selection stays in the textbox.
          event.preventDefault();
        }}
      >
        <ToggleGroup
          type="multiple"
          spacing={0}
          value={marks}
          onValueChange={(next: string[]) => run(changedCommands(next, marks))}
          aria-label="Text style"
        >
          {MARKS.map(({ command, label, Icon }) => (
            <ToggleGroupItem
              key={command}
              value={command}
              aria-label={label}
              className={compact ? "size-8" : "size-10"}
            >
              <Icon aria-hidden />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ToggleGroup
          type="multiple"
          spacing={0}
          value={lists}
          onValueChange={(next: string[]) => run(changedCommands(next, lists))}
          aria-label="Lists"
        >
          {LISTS.map(({ command, label, Icon }) => (
            <ToggleGroupItem
              key={command}
              value={command}
              aria-label={label}
              className={compact ? "size-8" : "size-10"}
            >
              <Icon aria-hidden />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/*
          Multiple, not single: ToggleGroup's single mode claims radiogroup
          semantics but its arrow keys only move focus, never select. Toggle
          buttons in a toolbar are the honest reading — and execCommand's
          justify* commands set rather than toggle, so only the newly picked
          one runs and alignment can never be left unset.
        */}
        <ToggleGroup
          type="multiple"
          spacing={0}
          value={[alignment]}
          onValueChange={(next: string[]) => {
            const picked = next.find((command) => command !== alignment);
            if (picked) run([picked]);
          }}
          aria-label="Alignment"
        >
          {ALIGNMENTS.map(({ command, label, Icon }) => (
            <ToggleGroupItem
              key={command}
              value={command}
              aria-label={label}
              className={compact ? "size-8" : "size-10"}
            >
              <Icon aria-hidden />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {tables ? (
          <div role="group" aria-label="Table" className="flex items-center">
            {/* Ghost is the toolbar treatment the toggles wear: nothing at rest,
                `accent` on hover. A button, not a toggle — inserting has no "on". */}
            <Button
              type="button"
              variant="ghost"
              size={compact ? "icon-xs" : "icon"}
              aria-label="Insert table"
              title="Insert table"
              onClick={insertTable}
            >
              <TableIcon aria-hidden />
            </Button>
            {/* Only while the caret is in a table — the edits have nothing to act on
                anywhere else. A visible word rather than a second icon, so a voice
                user can say what they see (ACCESSIBILITY §9). */}
            {inTable ? (
              <DropdownMenu
                onOpenChange={(open) => {
                  /* Read the cell again as the menu opens: the toolbar's mousedown
                     keeps the selection in the editor, so it is the cell the typist
                     is in right now, not whichever one last fired selectionchange. */
                  if (open) syncToolbar();
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size={compact ? "xs" : "default"}
                  >
                    Table
                    <ChevronDownIcon data-icon="inline-end" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-auto"
                  onCloseAutoFocus={returnFromTableMenu}
                >
                  <DropdownMenuItem onSelect={() => editTable(addRowBelow)}>
                    Add row below
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => editTable(addColumnRight)}>
                    Add column right
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => editTable(deleteRow)}>
                    Delete row
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => editTable(deleteColumn)}>
                    Delete column
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => editTable(deleteTable)}
                  >
                    Delete table
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ) : null}
      </div>

      {header || footer ? (
        <div className={cn("flex w-full min-w-0 flex-col", pageClassName)}>
          {header}
          {editable}
          {footer}
        </div>
      ) : (
        editable
      )}

      {/* **The preview is decoration; this is the affordance.** The ghost node is
          `aria-hidden`, because an inline completion read out as part of the paragraph
          would tell a screen-reader user the order already says something it does not.
          What they get instead is the offer itself, politely, with the key that takes
          it — the DS's own rule for content that changes without a press
          (ACCESSIBILITY §3). Off entirely on the three fields that pass no
          `suggestion`. In the slash menu it says where the highlight is and how many
          there are — `aria-activedescendant` alone is read unevenly in an editable
          region. */}
      {suggestion ? (
        <p aria-live="polite" className="sr-only">
          {menu?.open
            ? menu.answers.length === 0
              ? "No shortcut matches."
              : `${shown?.label ?? ""}, ${menu.active + 1} of ${menu.answers.length}. Press Enter to insert.`
            : shown
              ? `Suggestion: ${shown.label}. Press Tab to accept.`
              : ""}
        </p>
      ) : null}

      {/* The Popover places the menu and keeps it on screen; it is never focused, so
          the typing never leaves the page. Its own dialog role is set aside: what it
          holds is this field's popup list, and the field points into it. Pressing in it
          keeps the caret in the page (mousedown), so a click takes the row there. */}
      {suggestion ? (
        <Popover
          open={Boolean(menu?.open)}
          onOpenChange={(open) => {
            if (!open) dismiss();
          }}
        >
          <PopoverAnchor virtualRef={anchorRef} />
          <PopoverContent
            ref={menuContentRef}
            role="presentation"
            side="bottom"
            align="start"
            avoidCollisions={false}
            collisionPadding={MENU_GUTTER}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onEscapeKeyDown={rememberDismissal}
            onMouseDown={(event) => event.preventDefault()}
            className={cn(
              "w-80 max-w-(--radix-popover-content-available-width) max-h-(--radix-popover-content-available-height) gap-1 p-1",
              MENU_GROW,
            )}
          >
            <p
              id={menuLabelId}
              className="px-2.5 pt-1.5 text-caption font-medium text-muted-foreground"
            >
              Shortcuts
            </p>
            {menu && menu.answers.length > 0 ? (
              <div className="relative flex min-h-0 flex-col">
                <ul
                  ref={watchList}
                  onScroll={(event) => measureList(event.currentTarget)}
                  role="listbox"
                  id={listboxId}
                  aria-labelledby={menuLabelId}
                  /* No scrollbar (owner, 2026-10-29), as on the pill row
                     (`chrome/pill-plate.ts`). What the list holds past its edges is
                     drawn as fades instead, as in the Shortcuts window's list (owner,
                     same day: *not clear that there is more below*). The scroll padding
                     keeps the row ↑ ↓ land on clear of the fade. The WebKit rule covers
                     Safari before it took `scrollbar-width`. */
                  className="flex max-h-72 min-h-0 scroll-py-12 flex-col overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {menu.answers.map((answer, index) => (
                    <li
                      key={answer.key}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === menu.active}
                      onPointerMove={() => pointMenuAt(index)}
                      onClick={() => acceptSuggestion(answer.key)}
                      className="flex min-h-10 cursor-default flex-col justify-center gap-0.5 rounded-md px-2.5 py-2 select-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <span className="text-body-compact">
                        <MatchedName name={answer.label} query={menu.query} />
                      </span>
                      {answer.detail ? (
                        <span className="line-clamp-1 text-caption text-muted-foreground">
                          {answer.detail}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div
                  aria-hidden
                  data-shown={listOverflow.above}
                  className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-linear-to-b from-popover to-transparent opacity-0 transition-opacity data-[shown=true]:opacity-100 motion-reduce:transition-none"
                />
                <div
                  aria-hidden
                  data-shown={listOverflow.below}
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-popover to-transparent opacity-0 transition-opacity data-[shown=true]:opacity-100 motion-reduce:transition-none"
                />
              </div>
            ) : (
              <p className="px-2.5 py-2 text-body-compact text-muted-foreground">
                No shortcut matches “{menu?.query}”.
              </p>
            )}
          </PopoverContent>
        </Popover>
      ) : null}
    </InputGroup>
  );
}

/** The slash menu's distance from the screen's edges — the product's phone gutter. */
const MENU_GUTTER = 16;

/** Room the slash menu wants below the slash on opening: its heading and five rows. */
const MENU_ROOM = 240;

/**
 * Scroll whatever holds the page up until `MENU_ROOM` fits below `bottom` — the slash's
 * foot — so the menu can open under it near the end of the screen. Each scrolling
 * ancestor gives what it can, nearest first; the window gives the rest.
 */
function makeRoomBelow(from: Element, bottom: number) {
  const viewport = window.visualViewport?.height ?? window.innerHeight;
  let short = bottom + MENU_ROOM - (viewport - MENU_GUTTER);
  if (short <= 0) return;
  const behavior: ScrollBehavior = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches
    ? "auto"
    : "smooth";
  for (let node = from.parentElement; node && short > 0; node = node.parentElement) {
    if (!/auto|scroll/.test(getComputedStyle(node).overflowY)) continue;
    const spare = node.scrollHeight - node.clientHeight - node.scrollTop;
    if (spare <= 0) continue;
    const by = Math.min(short, spare);
    node.scrollBy({ top: by, behavior });
    short -= by;
  }
  if (short > 0) window.scrollBy({ top: short, behavior });
}

type ListOverflow = { above: boolean; below: boolean };

/**
 * Whether a list runs past its top or foot — the same object when nothing changed. The
 * Shortcuts window's list reads its edges the same way (`shortcuts-panel.tsx`).
 */
function readOverflow(node: HTMLElement, current: ListOverflow): ListOverflow {
  const above = node.scrollTop > 1;
  const below = node.scrollHeight - node.scrollTop - node.clientHeight > 1;
  return above === current.above && below === current.below ? current : { above, below };
}

/** A shortcut's name in the slash menu, with the letters typed so far in bold. */
function MatchedName({ name, query }: { name: string; query: string }) {
  const span = matchSpan(name, query);
  if (!span) return name;
  return (
    <>
      {name.slice(0, span.start)}
      <span className="font-semibold">{name.slice(span.start, span.end)}</span>
      {name.slice(span.end)}
    </>
  );
}

/**
 * The preview node itself, drawn into the block the caret is in.
 *
 * Module level, and it returns the node rather than reaching for a ref: drawing into
 * the document is the DOM's business, not React's, and the compiler's own lint refuses
 * a component to assign to a node that reached it through a hook — correctly, since a
 * value React is tracking is not a value React expects to be mutated.
 *
 * Every attribute here is load-bearing. `contenteditable="false"` keeps an edit from
 * landing inside a passage nobody has accepted; `GHOST_ATTRIBUTE` is what
 * `stripGhostHtml` finds; `aria-hidden` keeps an unaccepted suggestion out of what a
 * screen reader reads as the order (the live region carries the offer instead);
 * `select-none` keeps it off the clipboard when a selection runs through it; and the
 * muted ink is the DS's vetted 4.5:1 pair rather than an alpha of the body colour,
 * because this is text a reader has to read before accepting it (ACCESSIBILITY §5).
 */
function drawGhost(host: HTMLElement, words: string): HTMLElement {
  const node = document.createElement("span");
  node.setAttribute(GHOST_ATTRIBUTE, "");
  node.setAttribute("contenteditable", "false");
  node.setAttribute("aria-hidden", "true");
  node.className = "pointer-events-none select-none text-muted-foreground";
  node.textContent = words;
  host.appendChild(node);
  return node;
}

/**
 * The (node, offset) a character offset into a block lands on.
 *
 * Counted across the block's text nodes rather than assumed to be one of them: by the
 * time a completion is accepted the line may hold a bold word or a link, and the trigger
 * has to be found in the block as it is rather than in the block as it was typed.
 */
function pointAt(
  block: Node,
  offset: number,
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let seen = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const length = node.textContent?.length ?? 0;
    if (seen + length >= offset) return { node, offset: offset - seen };
    seen += length;
  }
  return null;
}

/** The first `[…]` the court left to fill, selected — or the caret after the passage. */
function placeCaret(inserted: Element | null): void {
  if (!inserted) return;
  const selection = window.getSelection();
  if (!selection) return;
  const walker = document.createTreeWalker(inserted, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const slot = /\[[^\]]+\]/.exec(node.textContent ?? "");
    if (!slot) continue;
    const range = document.createRange();
    range.setStart(node, slot.index);
    range.setEnd(node, slot.index + slot[0].length);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }
  const end = document.createRange();
  end.selectNodeContents(inserted);
  end.collapse(false);
  selection.removeAllRanges();
  selection.addRange(end);
}

/**
 * Read-only render of a RichTextField value. Safe because the value can only
 * contain execCommand output — the editor blocks HTML paste and drop.
 */
export function RichTextValueView({
  value,
  className,
}: {
  value: RichTextValue;
  className?: string;
}) {
  return (
    <div
      className={cn(CONTENT_CLASSES, className)}
      dangerouslySetInnerHTML={{ __html: value.html }}
    />
  );
}
