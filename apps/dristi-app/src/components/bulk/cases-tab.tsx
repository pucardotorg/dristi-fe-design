"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { UploadIcon } from "lucide-react";

import { FilingFooter } from "@/components/filing/filing-footer";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Button } from "@/components/ui/button";

import { BatchFooter } from "./batch-footer";
import { caseState } from "./batch-marks";
import type { BatchCtx } from "./batch-screen";
import { CheckCard } from "./check-step";

/**
 * The Cases step revisited: its Check as it was before Create, the counts of what Case
 * details asks for (owner, 2026-11-11: a step reopens as itself; 2026-11-12: not a second
 * case list). The cases themselves are worked on in Case details, where Continue goes.
 */
export function CasesTab({ batch, go }: BatchCtx) {
  const router = useRouter();
  const pending = batch.cases.filter((c) => c.stage !== "filed");
  const filed = batch.cases.length - pending.length;
  const states = pending.map(caseState);
  // A batch from an Excel file can take its file again (BLK-40): the drafts are replaced,
  // filed cases stay. The same act recovers a Create that stopped partway (BLK-10l).
  const again = batch.source.kind === "excel" && !batch.clubbedInto && pending.length > 0;
  const [asking, setAsking] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      {filed ? (
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {filed} filed, listed under{" "}
          <button type="button" className="underline" onClick={() => go("filed")}>
            Filed
          </button>
          .
        </p>
      ) : null}
      {pending.length ? (
        // Continue is the way to Case details; a second link to it would repeat the footer.
        <CheckCard
          created
          total={pending.length}
          fix={states.filter((x) => x === "fix").length}
          check={states.filter((x) => x === "check").length}
          footer={
            again ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="min-w-0 flex-1 text-body-compact text-muted-foreground">
                  A corrected file replaces the draft cases{filed ? "; filed cases stay" : ""}.
                </p>
                <Button variant="outline" onClick={() => setAsking(true)}>
                  <UploadIcon data-icon="inline-start" aria-hidden />
                  Upload the file again
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <p className="text-body-compact text-muted-foreground">Every case in this batch is filed.</p>
      )}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        destructive
        title="Replace this batch's draft cases?"
        description={
          <>
            Every draft case, its documents and the changes made on Case details are discarded, and a case is made for
            each row of the new file. Signed cases not yet filed are replaced too.
            {filed ? ` The ${filed} filed ${filed === 1 ? "case stays" : "cases stay"} as ${filed === 1 ? "it is" : "they are"}.` : ""}
          </>
        }
        confirmLabel="Choose a file"
        cancelLabel="Back"
        onConfirm={() => router.push(`/filings/bulk/upload?again=${encodeURIComponent(batch.id)}`)}
      />
      <BatchFooter>
        <FilingFooter showSaveState={false} onBack={() => go("common")} onContinue={() => go("scrutiny")} />
      </BatchFooter>
    </div>
  );
}
