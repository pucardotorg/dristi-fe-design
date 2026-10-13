"use client";

/**
 * Draft store for the e-filing flow.
 *
 * One provider per draft (mounted by the `/filings/[draftId]` layout). It loads the draft
 * from the repository, holds it in React state, and writes every committed change back
 * (debounced) — "Saving…" / "Saved" / "Couldn't save" reflect the real write. Screens
 * mutate the draft through `update((d) => { … })`; the store clones first, so state stays
 * immutable and every change re-renders subscribers.
 */

import * as React from "react";
import { usePathname } from "next/navigation";

import { buildDocumentGroups } from "./blank";
import { deleteDraftWithFiles, getRepository } from "./data";
import { sectionOpened } from "./selectors";
import { stepFromPathname, stepHref, WALK_ORDER } from "./steps";
import type { FilingDraft, StepId } from "./types";
import { useCourt } from "@/components/court/court-provider";
import { localizeDeep } from "@/lib/court/localize";

export type SaveState = "saving" | "saved" | "error";

type FilingContextValue = {
  draft: FilingDraft;
  saveState: SaveState;
  /** Mutate a clone of the draft; the store commits and persists it. */
  update: (recipe: (draft: FilingDraft) => void) => void;
  /** Route to a step of this draft. */
  hrefFor: (step: StepId) => string;
  /** Persist immediately (used before navigating away from a critical action). */
  flush: () => Promise<void>;
  /** Delete this draft and its files. The caller navigates afterwards. */
  discard: () => Promise<void>;
};

const FilingContext = React.createContext<FilingContextValue | null>(null);

const subscribeNoop = () => () => {};

/**
 * `true` once mounted on the client, `false` during SSR and the hydration pass — so a
 * component can render a server-safe fallback until browser-only state is available.
 */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

const SAVE_DEBOUNCE_MS = 300;

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; draft: FilingDraft };

export function FilingProvider({
  draftId,
  children,
  fallback = null,
  notFound = null,
}: {
  draftId: string;
  children: React.ReactNode;
  /** Rendered while the draft is being read. */
  fallback?: React.ReactNode;
  /** Rendered when no draft has this id (deleted, or a stale link). */
  notFound?: React.ReactNode;
}) {
  // Loaded state is keyed by draft id, so switching drafts reads as "loading" without a
  // synchronous reset in the effect.
  const [loaded, setLoaded] = React.useState<{ id: string; result: LoadState } | null>(null);
  const state = React.useMemo<LoadState>(
    () => (loaded && loaded.id === draftId ? loaded.result : { status: "loading" }),
    [loaded, draftId]
  );
  const setState = React.useCallback(
    (updater: LoadState | ((prev: LoadState) => LoadState)) =>
      setLoaded((prev) => {
        const prevResult: LoadState =
          prev && prev.id === draftId ? prev.result : { status: "loading" };
        const next = typeof updater === "function" ? updater(prevResult) : updater;
        return { id: draftId, result: next };
      }),
    [draftId]
  );
  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const pathname = usePathname();
  const { court } = useCourt();

  // Latest draft for the debounced writer / flush, without re-binding callbacks.
  const draftRef = React.useRef<FilingDraft | null>(null);
  const dirtyRef = React.useRef(false);
  const timerRef = React.useRef<number | null>(null);

  // Load.
  React.useEffect(() => {
    let cancelled = false;
    getRepository()
      .getDraft(draftId)
      .then((d) => {
        if (cancelled) return;
        if (d) {
          // Sample and prefilled drafts are written in Kerala's terms; a draft opens in
          // the selected court's (`CourtSwitch`). Nothing is written back until the
          // filer edits, so the stored draft is unchanged by opening it.
          const voiced = localizeDeep(d, court);
          draftRef.current = voiced;
          setState({ status: "ready", draft: voiced });
        } else {
          setState({ status: "missing" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [draftId, setState, court]);

  const write = React.useCallback(async () => {
    const d = draftRef.current;
    if (!d || !dirtyRef.current) return;
    dirtyRef.current = false;
    try {
      await getRepository().putDraft(d);
      // A newer change may have arrived while writing.
      setSaveState(dirtyRef.current ? "saving" : "saved");
    } catch {
      dirtyRef.current = true;
      setSaveState("error");
    }
  }, []);

  const schedule = React.useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void write();
    }, SAVE_DEBOUNCE_MS);
  }, [write]);

  const flush = React.useCallback(async () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await write();
  }, [write]);

  // Write pending changes when the tab is hidden or unloads.
  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush]);

  const commit = React.useCallback(
    (recipe: (d: FilingDraft) => void) => {
      setState((prev: LoadState) => {
        if (prev.status !== "ready") return prev;
        const next = structuredClone(prev.draft);
        recipe(next);
        // The list of documents mirrors the case (cheques, parties, intake) — keep it in step.
        next.documents = buildDocumentGroups(next);
        next.updatedAt = new Date().toISOString();
        draftRef.current = next;
        dirtyRef.current = true;
        return { status: "ready", draft: next };
      });
      setSaveState("saving");
      schedule();
    },
    [schedule, setState]
  );

  // Remember where the person is, so "Continue draft" resumes here, and that they have
  // opened this section — which is what lets it count towards progress.
  const step = stepFromPathname(pathname);
  React.useEffect(() => {
    if (state.status !== "ready" || !step) return;
    const { visited, lastStep } = state.draft;
    if (lastStep === step && visited?.includes(step)) return;
    commit((d) => {
      // A draft from before sections were recorded starts its record from what it had
      // walked, so moving on from it does not lose the sections before.
      d.visited ??= WALK_ORDER.filter((s) => sectionOpened(d, s));
      d.lastStep = step;
      if (!d.visited.includes(step)) d.visited.push(step);
    });
  }, [step, state, commit]);

  const hrefFor = React.useCallback((s: StepId) => stepHref(draftId, s), [draftId]);

  const discard = React.useCallback(async () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dirtyRef.current = false;
    await deleteDraftWithFiles(draftId);
  }, [draftId]);

  const draft = state.status === "ready" ? state.draft : null;
  const value = React.useMemo<FilingContextValue | null>(
    () => (draft ? { draft, saveState, update: commit, hrefFor, flush, discard } : null),
    [draft, saveState, commit, hrefFor, flush, discard]
  );

  if (state.status === "loading") return <>{fallback}</>;
  if (state.status === "missing") return <>{notFound}</>;
  return <FilingContext.Provider value={value}>{children}</FilingContext.Provider>;
}

export function useFiling(): FilingContextValue {
  const ctx = React.useContext(FilingContext);
  if (!ctx) throw new Error("useFiling must be used inside <FilingProvider>");
  return ctx;
}
