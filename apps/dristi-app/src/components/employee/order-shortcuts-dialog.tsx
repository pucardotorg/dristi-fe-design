"use client";

import * as React from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";

import type { RichTextSuggestion } from "@/components/cases/rich-text-field";
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
import { Textarea } from "@/components/ui/textarea";
import {
  addOrderShortcut,
  matchOrderShortcuts,
  readOrderShortcuts,
  removeOrderShortcut,
  serverOrderShortcuts,
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
        return entry ? { kind: "inline", text: entry.text } : null;
      },
    }),
    [shortcuts],
  );
}

/**
 * Shortcuts — a name and the text it stands for (owner, 2026-10-14). Listed, changed and
 * removed here; added with the form at the foot. Nothing more to configure.
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
  const [text, setText] = React.useState("");
  const [tried, setTried] = React.useState(false);
  const nameId = React.useId();
  const textId = React.useId();

  const taken = shortcutNameTaken(shortcuts, name, editing ?? undefined);
  const nameError = !name.trim()
    ? "Give the shortcut a name."
    : taken
      ? "Another shortcut has this name."
      : null;
  const textError = !text.trim() ? "Give the text it types." : null;

  function reset() {
    setEditing(null);
    setName("");
    setText("");
    setTried(false);
  }

  function save() {
    setTried(true);
    if (nameError || textError) return;
    if (editing) updateOrderShortcut(editing, { name, text });
    else addOrderShortcut(name, text);
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
      <DialogContent className="flex max-h-[85svh] flex-col gap-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Shortcuts</DialogTitle>
          <DialogDescription>
            In the order, type <kbd className="font-mono">/</kbd> and the start
            of a name, then press Tab to put its text in.
          </DialogDescription>
        </DialogHeader>

        <ul className="-mx-2 flex min-h-0 flex-col overflow-y-auto">
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
                  setText(entry.text);
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
            <FieldLabel htmlFor={textId}>Text</FieldLabel>
            <Textarea
              id={textId}
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={tried && textError ? true : undefined}
              className="min-h-24"
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
