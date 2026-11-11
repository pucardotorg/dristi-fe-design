"use client";

import * as React from "react";
import Link from "next/link";
import { CopyIcon, FileSpreadsheetIcon, LayersIcon, PlugIcon } from "lucide-react";

import { FILINGS_HOME } from "@/lib/filing/steps";
import type { CaseState } from "@/lib/bulk/case-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { EntryHead, EntryOption, OPTION_TRAY } from "./start-filing-card";

/**
 * The latest batch — pushed in from a client's litigation system or uploaded from Excel —
 * and where its cases have reached (docs/design/features/bulk-filing.md).
 */
export type BulkBatch = {
  id: string;
  client: string;
  /** "50 × cheque bounce (S-138, NI Act)". */
  what: string;
  receivedOn: string;
  via: string;
  /** How many cases the batch holds. */
  cases: number;
  counts: Record<CaseState, number>;
};

const UPLOAD = `${FILINGS_HOME}/bulk/upload`;
const BATCHES = `${FILINGS_HOME}/bulk`;

/**
 * Bulk filing's entry, the same shape as New filing (owner, 2026-11-11): its options are the
 * ways a batch comes in, so a new way is one more card, and nothing has to be read to be
 * understood. Every batch, however it came, is one act away in the header, carrying how
 * many need action.
 */
export function BulkImportCard({ needAction = 0 }: { batch?: BulkBatch | null; needAction?: number }) {
  const [api, setApi] = React.useState(false);
  const titleId = React.useId();
  return (
    <Card variant="raised" aria-labelledby={titleId} className="gap-6 p-6">
      <EntryHead
        icon={LayersIcon}
        title="Bulk filing"
        titleId={titleId}
        description="File many cases for one complainant together, as a batch."
        action={
          <Button asChild variant="ghost" className="-mr-2">
            <Link href={BATCHES}>
              View all batches
              {needAction ? (
                <Badge variant="warning" className="tabular-nums">
                  {needAction} need action
                </Badge>
              ) : null}
            </Link>
          </Button>
        }
      />

      <ul aria-labelledby={titleId} className={OPTION_TRAY}>
        <li>
          <EntryOption
            href={UPLOAD}
            icon={FileSpreadsheetIcon}
            title="Upload an Excel file"
            caption="One row per case, in the template or your own layout"
          />
        </li>
        <li>
          <EntryOption
            onClick={() => setApi(true)}
            icon={PlugIcon}
            title="From a client's system"
            caption="Their system sends the cases through the Bulk Filing API"
          />
        </li>
      </ul>

      <ApiDialog open={api} onOpenChange={setApi} />
    </Card>
  );
}

/**
 * A batch from a client's system is not made here: their system sends it, and it arrives
 * as its own batch. What the filer can do is hand their client's IT team the address.
 */
function ApiDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [copied, setCopied] = React.useState(false);
  const endpoint = typeof window === "undefined" ? "/api/bulk/v1/batches" : `${window.location.origin}/api/bulk/v1/batches`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setCopied(false);
      }}
    >
      <ChromeDialogContent mobileSheet className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Batches from a client&apos;s system</DialogTitle>
          <DialogDescription>
            Their system sends the cases through the Bulk Filing API. Each send arrives as its own batch in All
            batches, ready for you to check and file.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <span className="text-body-compact font-medium">Address for their IT team</span>
          <div className="flex items-center gap-2 rounded-lg bg-surface-sunken py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 truncate font-mono text-body-compact">{endpoint}</code>
            <Button variant="ghost" onClick={() => void copy()}>
              <CopyIcon data-icon="inline-start" aria-hidden />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" asChild>
            <Link href={BATCHES}>View all batches</Link>
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </ChromeDialogContent>
    </Dialog>
  );
}
