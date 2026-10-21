"use client";

import * as React from "react";

import { bulkApi, type BatchView } from "./api";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Autosave for one case's details: what is typed is held as an edit until the field is
 * left (or a choice is made), then saved on its own. Saves run one after another, so the
 * batch that comes back after the last one is the batch as it now stands. `flush` waits
 * for any save still running, for moving on to another case.
 */
export function useAutosave({
  batch,
  setBatch,
  caseId,
  everyCase,
}: {
  batch: BatchView;
  setBatch: (b: BatchView) => void;
  caseId: string | null;
  /** Fields whose fix applies to every case in the batch (an advocate's Bar number). */
  everyCase: (path: string) => boolean;
}) {
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [state, setState] = React.useState<SaveState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const queue = React.useRef<Promise<void>>(Promise.resolve());
  const latest = React.useRef({ batchId: batch.id, caseId, everyCase, setBatch });
  React.useEffect(() => {
    latest.current = { batchId: batch.id, caseId, everyCase, setBatch };
  });

  const setEdit = React.useCallback((path: string, value: string) => setEdits((e) => ({ ...e, [path]: value })), []);

  const commit = React.useCallback((path: string, value: string) => {
    const { batchId, caseId: id, everyCase: wide, setBatch: apply } = latest.current;
    if (!id) return;
    setState("saving");
    queue.current = queue.current.then(async () => {
      try {
        apply(await bulkApi.act(batchId, { action: "fix", caseId: id, path, value, everyCase: wide(path) }));
        // Drop the edit once saved, unless it was typed over meanwhile.
        setEdits((e) => {
          if (e[path] !== value) return e;
          const next = { ...e };
          delete next[path];
          return next;
        });
        setState("saved");
        setError(null);
      } catch (e) {
        setState("error");
        setError((e as Error).message);
      }
    });
  }, []);

  const flush = React.useCallback(() => queue.current, []);
  const reset = React.useCallback(() => {
    setEdits({});
    setState("idle");
    setError(null);
  }, []);

  return { edits, setEdit, commit, flush, reset, state, error };
}

/** "Saving…", "Saved", or why not: one quiet line beside the case. */
export function saveLabel(state: SaveState, error: string | null): string | null {
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved";
  if (state === "error") return error ?? "Not saved";
  return null;
}
