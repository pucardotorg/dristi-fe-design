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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  addOrderShortcut,
  matchOrderShortcuts,
  readOrderShortcuts,
  removeOrderShortcut,
  serverOrderShortcuts,
  shortcutHtml,
  shortcutInsertion,
  shortcutNameTaken,
  subscribeToOrderShortcuts,
  updateOrderShortcut,
  type OrderShortcut,
} from "@/lib/employee/order-shortcuts";

export function useOrderShortcuts(): readonly OrderShortcut[] {
  return React.useSyncExternalStore(
    subscribeToOrderShortcuts,
    readOrderShortcuts,
    serverOrderShortcuts,
  );
}

/**
 * The editor's `/` completion over the shortcuts: names only — a sentence being typed is
 * never finished for the typist — and the shortcut's text in place of `/` and the query.
 */
export function useShortcutSuggestion(): RichTextSuggestion {
  const shortcuts = useOrderShortcuts();
  return React.useMemo(
    () => ({
      resolve: (query, mode) =>
        mode === "trigger"
          ? matchOrderShortcuts(shortcuts, query).map((entry) => ({
              key: entry.id,
              label: entry.name,
              ghost: entry.name,
            }))
          : [],
      accept: (key) => {
        const entry = shortcuts.find((shortcut) => shortcut.id === key);
        return entry ? shortcutInsertion(entry) : null;
      },
    }),
    [shortcuts],
  );
}

/**
 * Shortcuts — a name and the text it stands for (owner, 2026-10-14). Listed, changed and
 * removed here; added with the form at the foot. Nothing more to configure.
 *
 * The text is the order page's own rich text field at full size, not a textarea
 * (owner, 2026-10-16), so a shortcut can carry paragraphs, bold and lists — whole
 * orders, not only phrases. The dialog widens to give it a page's measure.
 */
export function OrderShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const shortcuts = useOrderShortcuts();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [text, setText] = React.useState<RichTextValue>(EMPTY_RICH_TEXT);
  /* The field reads its value once, when it mounts — so opening another shortcut, or
     clearing the form, mounts a fresh one. */
  const [formKey, setFormKey] = React.useState(0);
  const [tried, setTried] = React.useState(false);
  const nameId = React.useId();
  const textId = React.useId();

  const taken = shortcutNameTaken(shortcuts, name, editing ?? undefined);
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
    const body = { text: text.text, html: text.html };
    if (editing) updateOrderShortcut(editing, { name, ...body });
    else addOrderShortcut(name, body);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[90svh] flex-col gap-6 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Shortcuts</DialogTitle>
          <DialogDescription>
            In the order, type <kbd className="font-mono">/</kbd> and the start
            of a name, then press Tab to put its text in.
          </DialogDescription>
        </DialogHeader>

        <ul className="-mx-2 flex max-h-72 min-h-32 shrink-0 flex-col overflow-y-auto">
          {shortcuts.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-3 rounded-lg px-2 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-body-compact font-medium">{entry.name}</p>
                <p className="line-clamp-2 text-body-compact text-muted-foreground">
                  {entry.text}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Edit ${entry.name}`}
                onClick={() => {
                  setEditing(entry.id);
                  setName(entry.name);
                  setText({ html: shortcutHtml(entry), text: entry.text });
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
                  removeOrderShortcut(entry.id);
                  if (editing === entry.id) reset();
                }}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </li>
          ))}
          {shortcuts.length === 0 ? (
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
              tables
              /* The order page's breath between paragraphs, so a shortcut reads here as
                 it will on the page. */
              className="[&_[data-slot=input-group-control]]:min-h-80 [&_[data-slot=input-group-control]>*+*]:mt-4"
            />
            {tried && textError ? <FieldError>{textError}</FieldError> : null}
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {editing ? (
              <Button type="button" variant="outline" onClick={reset}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit">
              {editing ? "Save shortcut" : "Add shortcut"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
