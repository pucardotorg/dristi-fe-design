"use client";

import * as React from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import {
  EMPTY_RICH_TEXT,
  RichTextField,
  type RichTextSuggestion,
  type RichTextValue,
} from "@/components/cases/rich-text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  addDepositionShortcut,
  depositionShortcutNameTaken,
  isExaminationShortcut,
  matchDepositionShortcuts,
  readDepositionShortcuts,
  removeDepositionShortcut,
  serverDepositionShortcuts,
  subscribeToDepositionShortcuts,
  updateDepositionShortcut,
  type DepositionShortcut,
} from "@/lib/employee/deposition-shortcuts";

export function useDepositionShortcuts(): readonly DepositionShortcut[] {
  return React.useSyncExternalStore(
    subscribeToDepositionShortcuts,
    readDepositionShortcuts,
    serverDepositionShortcuts,
  );
}

/**
 * The field's `/` completion over the shortcuts, as on the order screen: names only, and
 * the shortcut's text in place of `/` and the query, as paragraphs of its own.
 */
export function useDepositionSuggestion(
  kind: "deposition" | "examination",
): RichTextSuggestion {
  const shortcuts = useDepositionShortcuts();
  return React.useMemo(
    () => ({
      resolve: (query, mode) =>
        mode === "trigger"
          ? matchDepositionShortcuts(shortcuts, query, kind).map((entry) => ({
              key: entry.id,
              label: entry.name,
              ghost: entry.name,
            }))
          : [],
      accept: (key) => {
        const entry = shortcuts.find((shortcut) => shortcut.id === key);
        return entry ? { kind: "block", html: entry.html } : null;
      },
    }),
    [shortcuts, kind],
  );
}

/**
 * Shortcuts — a name and the text it types — listed, changed and removed in a well on
 * the left, and added or changed with the form beside it, so the form is always in view
 * (owner, 2026-10-27). Below md the two stack, list first. What is being recorded
 * decides which come first, the 351 questions in an examination.
 */
export function DepositionShortcutsPanel({
  kind,
  onInsert,
}: {
  kind: "deposition" | "examination";
  /** Put this one in the text and go back to it. */
  onInsert: (entry: DepositionShortcut) => void;
}) {
  const shortcuts = useDepositionShortcuts();
  const listed = [...shortcuts].sort(
    (a, b) =>
      Number(isExaminationShortcut(a) !== (kind === "examination")) -
      Number(isExaminationShortcut(b) !== (kind === "examination")),
  );
  const [editing, setEditing] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [text, setText] = React.useState<RichTextValue>(EMPTY_RICH_TEXT);
  /* The field reads its value once, when it mounts — so opening another shortcut, or
     clearing the form, mounts a fresh one. */
  const [formKey, setFormKey] = React.useState(0);
  const [tried, setTried] = React.useState(false);
  const nameId = React.useId();
  const textId = React.useId();
  const listId = React.useId();
  const formId = React.useId();
  const nameRef = React.useRef<HTMLInputElement>(null);
  const editingEntry = shortcuts.find((entry) => entry.id === editing);
  /* What the list holds past its edges, drawn as fades in place of a scrollbar. */
  const listRef = React.useRef<HTMLUListElement>(null);
  const [overflow, setOverflow] = React.useState({ above: false, below: false });

  /* The fades follow the pane's size as well as its scroll, and a shortcut added or
     removed. */
  React.useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const measure = () => setOverflow((current) => readOverflow(node, current));
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [listed.length]);

  const taken = depositionShortcutNameTaken(shortcuts, name, editing ?? undefined);
  const nameError = !name.trim()
    ? "Give the shortcut a name."
    : taken
      ? "Another shortcut has this name."
      : null;
  const textError = !text.text.trim() ? "Give the text it types." : null;

  function reset() {
    setEditing(null);
    setName("");
    setText(EMPTY_RICH_TEXT);
    setFormKey((key) => key + 1);
    setTried(false);
  }

  function save() {
    setTried(true);
    if (nameError || textError) return;
    if (editing) updateDepositionShortcut(editing, name, text.html);
    else addDepositionShortcut(name, text.html);
    reset();
  }

  return (
    <div className="flex flex-col gap-6 md:grid md:min-h-0 md:flex-1 md:grid-cols-2 md:grid-rows-1">
      <section aria-labelledby={listId} className="flex min-h-0 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id={listId} className="text-body-compact font-semibold">
            All shortcuts
          </h3>
          <span className="text-body-compact text-muted-foreground tabular-nums">
            {listed.length}
          </span>
        </div>
        {/* Capped below md too, so the form under it stays a short scroll away. */}
        <div className="relative flex max-h-96 min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-hairline bg-surface-sunken md:max-h-none">
          <ul
            ref={listRef}
            onScroll={(event) => {
              const node = event.currentTarget;
              setOverflow((current) => readOverflow(node, current));
            }}
            className="@container flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2 [scrollbar-width:none]"
          >
            {listed.map((entry) => (
              <li
                key={entry.id}
                aria-current={editing === entry.id ? "true" : undefined}
                className="flex flex-col gap-2 rounded-lg border border-hairline bg-card p-3 aria-[current=true]:border-primary @md:flex-row @md:items-start"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-body-compact font-medium">{entry.name}</p>
                  <p className="line-clamp-2 text-body-compact text-muted-foreground">
                    {entry.text}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end @md:self-auto">
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Insert ${entry.name}`}
                    onClick={() => onInsert(entry)}
                  >
                    Insert
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${entry.name}`}
                    onClick={() => {
                      setEditing(entry.id);
                      setName(entry.name);
                      setText({ html: entry.html, text: entry.text });
                      setFormKey((key) => key + 1);
                      setTried(false);
                      nameRef.current?.focus();
                    }}
                  >
                    <PencilIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${entry.name}`}
                    onClick={() => {
                      removeDepositionShortcut(entry.id);
                      if (editing === entry.id) reset();
                    }}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
            {listed.length === 0 ? (
              <li className="p-3 text-body-compact text-muted-foreground">
                No shortcuts yet. Add one with the form.
              </li>
            ) : null}
          </ul>
          <div
            aria-hidden
            data-shown={overflow.above}
            className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-linear-to-b from-surface-sunken to-transparent opacity-0 transition-opacity data-[shown=true]:opacity-100 motion-reduce:transition-none"
          />
          <div
            aria-hidden
            data-shown={overflow.below}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-surface-sunken to-transparent opacity-0 transition-opacity data-[shown=true]:opacity-100 motion-reduce:transition-none"
          />
        </div>
      </section>

      <form
        aria-labelledby={formId}
        className="flex flex-col gap-4 md:min-h-0 md:overflow-y-auto"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <h3 id={formId} className="text-body-compact font-semibold">
          {editingEntry ? `Edit “${editingEntry.name}”` : "New shortcut"}
        </h3>
        <Field data-invalid={tried && nameError ? true : undefined}>
          <FieldLabel htmlFor={nameId}>Name</FieldLabel>
          <Input
            ref={nameRef}
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={tried && nameError ? true : undefined}
          />
          {tried && nameError ? <FieldError>{nameError}</FieldError> : null}
        </Field>
        <Field data-invalid={tried && textError ? true : undefined}>
          <FieldLabel id={textId}>Text</FieldLabel>
          <RichTextField
            key={formKey}
            labelId={textId}
            value={text}
            onChange={setText}
            className="[&_[data-slot=input-group-control]]:min-h-40"
          />
          <FieldDescription>
            Start a line with Q: for a question and A: for its answer. Square brackets
            mark a blank to fill, like [answer].
          </FieldDescription>
          {tried && textError ? <FieldError>{textError}</FieldError> : null}
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {editing ? (
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit">{editing ? "Save shortcut" : "Add shortcut"}</Button>
        </div>
      </form>
    </div>
  );
}

type Overflow = { above: boolean; below: boolean };

/** Whether the list runs past its top or foot — the same object when nothing changed. */
function readOverflow(node: HTMLElement, current: Overflow): Overflow {
  const above = node.scrollTop > 1;
  const below = node.scrollHeight - node.scrollTop - node.clientHeight > 1;
  return above === current.above && below === current.below ? current : { above, below };
}
