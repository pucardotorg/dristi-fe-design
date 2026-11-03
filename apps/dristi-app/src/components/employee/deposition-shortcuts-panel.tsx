"use client";

import * as React from "react";

import type { RichTextSuggestion } from "@/components/cases/rich-text-field";
import { ShortcutsPanel } from "@/components/employee/shortcuts-panel";
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
              detail: entry.text,
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
 * The statements' shortcuts in the shared panel. What is being recorded decides which
 * come first, the 351 questions in an examination.
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
  return (
    <ShortcutsPanel
      shortcuts={listed}
      htmlOf={(entry) => entry.html}
      nameTaken={(name, except) => depositionShortcutNameTaken(shortcuts, name, except)}
      onSave={(id, name, text) => {
        if (id) updateDepositionShortcut(id, name, text.html);
        else addDepositionShortcut(name, text.html);
      }}
      onRemove={removeDepositionShortcut}
      onInsert={onInsert}
      textHint={
        <>
          Start a line with Q: for a question and A: for its answer. Square brackets
          mark a blank to fill, like [answer].
        </>
      }
    />
  );
}
