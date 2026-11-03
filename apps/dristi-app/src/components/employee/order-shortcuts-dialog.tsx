"use client";

import * as React from "react";

import type { RichTextSuggestion } from "@/components/cases/rich-text-field";
import { ShortcutsPanel } from "@/components/employee/shortcuts-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
              detail: entry.text,
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
 * Shortcuts — a name and the text it stands for (owner, 2026-10-14) — in the panel
 * Recorded statements uses (owner, 2026-10-28): the list on the left with Insert, the
 * form beside it.
 *
 * The text is the order page's own rich text field, not a textarea (owner, 2026-10-16),
 * so a shortcut can carry paragraphs, bold, lists and tables — whole orders, not only
 * phrases — with the page's breath between paragraphs, so it reads here as it will there.
 */
export function OrderShortcutsDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Put this one in the order and go back to it. */
  onInsert: (entry: OrderShortcut) => void;
}) {
  const shortcuts = useOrderShortcuts();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Side by side from md, each pane scrolling on its own; stacked below, the
          window scrolls. */}
      <DialogContent className="flex max-h-[90svh] flex-col gap-6 overflow-y-auto sm:max-w-3xl md:max-w-5xl md:overflow-hidden">
        <DialogHeader>
          <DialogTitle>Shortcuts</DialogTitle>
          <DialogDescription>
            In the order, type <kbd className="font-mono">/</kbd> to list them
            and the start of a name to narrow the list, then press Enter to put
            one in.
          </DialogDescription>
        </DialogHeader>
        <ShortcutsPanel
          shortcuts={shortcuts}
          htmlOf={shortcutHtml}
          nameTaken={(name, except) => shortcutNameTaken(shortcuts, name, except)}
          onSave={(id, name, text) => {
            const body = { text: text.text, html: text.html };
            if (id) updateOrderShortcut(id, { name, ...body });
            else addOrderShortcut(name, body);
          }}
          onRemove={removeOrderShortcut}
          onInsert={onInsert}
          tables
          textClassName="[&_[data-slot=input-group-control]]:min-h-80 [&_[data-slot=input-group-control]>*+*]:mt-4"
        />
      </DialogContent>
    </Dialog>
  );
}
