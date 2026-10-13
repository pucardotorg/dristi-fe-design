"use client";

import * as React from "react";

import { deleteDraftWithFiles, getRepository } from "./data";
import { ensureSampleDrafts } from "./sample-drafts";
import { markScrutinyReturns } from "./scrutiny-demo";
import type { FilingDraft } from "./types";

/** All drafts and filed cases in this browser, newest first; `ready` once read. */
export function useDrafts() {
  const [drafts, setDrafts] = React.useState<FilingDraft[]>([]);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Wall-clock at the last read — for "filed in the last 12 months" without Date.now() in render. */
  const [readAt, setReadAt] = React.useState<number>(0);
  const [reloadTick, setReloadTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Sandbox: a fresh browser gets a few drafts to look at (once).
        await ensureSampleDrafts();
        await markScrutinyReturns();
        const all = await getRepository().listDrafts();
        if (cancelled) return;
        setDrafts(all);
        setError(null);
      } catch {
        if (cancelled) return;
        setError("We couldn't read your drafts from this browser's storage.");
      }
      if (cancelled) return;
      setReadAt(Date.now());
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const reload = React.useCallback(() => setReloadTick((t) => t + 1), []);

  const discard = React.useCallback(async (id: string) => {
    await deleteDraftWithFiles(id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return {
    ready,
    error,
    readAt,
    drafts: drafts.filter((d) => d.status === "draft"),
    filed: drafts
      .filter((d) => d.status === "filed")
      .sort((a, b) => (b.filedAt ?? "").localeCompare(a.filedAt ?? "")),
    reload,
    discard,
  };
}
