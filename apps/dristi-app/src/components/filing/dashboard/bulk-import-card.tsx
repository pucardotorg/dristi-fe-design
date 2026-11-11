"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDownIcon, CopyIcon } from "lucide-react";

import { FILINGS_HOME } from "@/lib/filing/steps";
import type { CaseState } from "@/lib/bulk/case-state";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  counts: Record<CaseState, number>;
};

const UPLOAD = `${FILINGS_HOME}/bulk/upload`;
const BATCHES = `${FILINGS_HOME}/bulk`;

/**
 * Bulk filing's entry: two acts, named for what they do (owner, 2026-11-11). "View all
 * batches" is every batch, however it came in; "Create a new batch" starts one, by Excel
 * upload in one press, with the way in chosen from its menu (Excel, or a client's system
 * through the API). The batch list holds the detail, so this panel says only what needs
 * attention.
 */
export function BulkImportCard({ batch, needAction = 0 }: { batch: BulkBatch | null; needAction?: number }) {
  const [api, setApi] = React.useState(false);
  return (
    <Card variant="raised" className="gap-0">
      <CardHeader>
        <CardTitle className="text-body font-semibold">Bulk filing</CardTitle>
        <CardDescription className="text-body-compact">
          Many cases for one complainant, filed together as a batch.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-3">
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {needAction ? (
            <>
              <span className="font-medium text-warning-ink">
                {needAction} {needAction === 1 ? "batch needs" : "batches need"} action.
              </span>{" "}
              Open the list to pick up where each one stopped.
            </>
          ) : batch ? (
            "Every batch is up to date."
          ) : (
            "No batches yet. Upload an Excel file, or have a client's system send its cases."
          )}
        </p>

        <div className="flex flex-wrap gap-2">
          <ButtonGroup aria-label="Create a new batch">
            <Button asChild>
              <Link href={UPLOAD}>Create a new batch</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" aria-label="Choose how the cases come in">
                  <ChevronDownIcon aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-64">
                <DropdownMenuItem asChild>
                  <Link href={UPLOAD} className="flex flex-col items-start gap-0.5">
                    <span>Upload an Excel file</span>
                    <span className="text-body-compact text-muted-foreground">One row per case</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setApi(true)} className="flex flex-col items-start gap-0.5">
                  <span>From a client&apos;s system</span>
                  <span className="text-body-compact text-muted-foreground">Sent through the Bulk Filing API</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
          <Button asChild variant="outline">
            <Link href={BATCHES}>View all batches</Link>
          </Button>
        </div>
      </CardContent>

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
