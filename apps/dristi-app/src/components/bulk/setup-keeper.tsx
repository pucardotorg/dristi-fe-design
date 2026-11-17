"use client";

/**
 * An upload left before Create stays in the filer's batch list as an unfinished batch,
 * which they can come back to or delete (BLK-10m).
 *
 * The setup's screens keep it as they go: Common details from the setup draft, and once a
 * file is read, the file and every choice made on it (`UploadSnapshot`). Nothing is kept
 * until the filer moves past the first section, so opening an upload and leaving at once
 * leaves nothing behind. Continue in the list reopens the setup where it was left, in any
 * tab: the draft is put back where the sections read it, and the file screen takes its
 * state from the snapshot.
 */

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { complainantName } from "@/lib/bulk/parties";
import { readSetupRaw, writeSetupDraft } from "@/lib/bulk/setup-repository";
import { useFiling } from "@/lib/filing/store";
import type { UploadSnapshot } from "@/lib/bulk/types";

import { bulkApi, type KeptSetup } from "./api";

type Keeper = {
  /** What was kept for this setup when it opened, for the file screen to start from. */
  kept: KeptSetup | null;
  /** The file screen's latest state; `null` before a file is read. */
  report: (snapshot: UploadSnapshot | null) => void;
  /** Stop keeping: the batch is being created. */
  stop: () => void;
};

const KeeperContext = React.createContext<Keeper>({ kept: null, report: () => undefined, stop: () => undefined });

/** For the upload's file screen. */
export const useSetupKeeper = () => React.useContext(KeeperContext);

/** Where the filer is, in the list's words: "stopped at Match values". */
const WHERE: Record<string, string> = {
  complainant: "Set up",
  advocate: "Set up · Advocate",
  documents: "Set up · Documents",
  format: "Choose a format",
  file: "Excel file",
  map: "Match columns",
  values: "Match values",
  facts: "Facts of the case",
  review: "Check",
};

/**
 * Before the setup's sections open: whatever was kept for it, with the draft put back
 * where the sections read it when this tab has none. `undefined` while it is looked up.
 */
export function useKeptSetup(setupId: string, enabled: boolean): KeptSetup | null | undefined {
  const [kept, setKept] = React.useState<KeptSetup | null | undefined>(enabled ? undefined : null);
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    bulkApi
      .getSetup(setupId)
      .catch(() => null)
      .then((k) => {
        if (!alive) return;
        if (k && !readSetupRaw(setupId)) writeSetupDraft(k.draft);
        setKept(k);
      });
    return () => {
      alive = false;
    };
  }, [setupId, enabled]);
  return kept;
}

/** Keeps the setup as the filer goes. Inside the setup's `FilingProvider`. */
export function SetupKeeper({ setupId, kept, children }: { setupId: string; kept: KeptSetup | null; children: React.ReactNode }) {
  const { draft } = useFiling();
  const pathname = usePathname();
  const params = useSearchParams();
  const section = pathname.split("/").pop() ?? "complainant";
  const step = section === "file" ? (params.get("step") ?? "file") : section;
  const path = section === "file" && step !== "file" ? `file?step=${step}` : section;

  const [snapshot, setSnapshot] = React.useState<UploadSnapshot | null>(kept?.upload ?? null);
  const stopped = React.useRef(false);
  // Kept once the filer has moved past the first section, or when it was kept before.
  const [started, setStarted] = React.useState(!!kept);
  if (!started && section !== "complainant") setStarted(true);

  React.useEffect(() => {
    if (!started || stopped.current) return;
    const timer = setTimeout(() => {
      if (stopped.current) return;
      void bulkApi
        .saveSetup(setupId, {
          path,
          where: `stopped at ${WHERE[step] ?? "Set up"}`,
          draft,
          client: draft.complainants[0] ? complainantName(draft.complainants[0]) : "",
          ...(snapshot ? { upload: snapshot } : {}),
        })
        .catch(() => undefined);
    }, 600);
    return () => clearTimeout(timer);
  }, [started, setupId, path, step, draft, snapshot]);

  const value = React.useMemo<Keeper>(
    () => ({
      kept,
      report: setSnapshot,
      stop: () => {
        stopped.current = true;
      },
    }),
    [kept],
  );
  return <KeeperContext.Provider value={value}>{children}</KeeperContext.Provider>;
}
