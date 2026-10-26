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
import { Separator } from "@/components/ui/separator";
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
 * Shortcuts — a name and the text it types — listed, changed and removed, and added with
 * the form at the foot: the order screen's Shortcuts dialog, here as a stage of the
 * recording window rather than a second window over it. What is being recorded decides
 * which come first, the 351 questions in an examination.
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
    <div className="flex flex-col gap-6">
      <ul className="-mx-2 flex flex-col">
        {listed.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 rounded-lg px-2 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-body-compact font-medium">{entry.name}</p>
              <p className="line-clamp-2 text-body-compact text-muted-foreground">
                {entry.text}
              </p>
            </div>
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
          </li>
        ))}
        {listed.length === 0 ? (
          <li className="px-2 py-3 text-body-compact text-muted-foreground">
            No shortcuts yet. Add one below.
          </li>
        ) : null}
      </ul>

      <Separator className="bg-hairline" />

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <h3 className="text-body-compact font-semibold">
          {editing ? "Edit shortcut" : "New shortcut"}
        </h3>
        <Field data-invalid={tried && nameError ? true : undefined}>
          <FieldLabel htmlFor={nameId}>Name</FieldLabel>
          <Input
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
          <Button type="submit" variant="outline">
            {editing ? "Save shortcut" : "Add shortcut"}
          </Button>
        </div>
      </form>
    </div>
  );
}
