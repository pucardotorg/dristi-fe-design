"use client";

import { useState } from "react";
import { notify } from "@/components/feedback";

import { ChoicePillGroup } from "@/components/cases/filing-form-shared";
import { useCaseReader } from "@/components/cases/case-reader";
import { useCourt } from "@/components/court/court-provider";
import { useCourtRole } from "@/components/employee/use-court-role";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EVIDENCE_SIDES,
  markEvidence,
  nextEvidenceNumber,
  type EvidenceSide,
} from "@/lib/cases/evidence-marks";
import { seatHolds } from "@/lib/employee/seat-roles";

/**
 * Whether the reader may mark evidence: a member of the court, on the
 * court's own case page, whose seat holds the Evidence marker role (DSB-12;
 * court-roles.md).
 */
export function useCanMarkEvidence(): boolean {
  const onCourtPage = useCaseReader() === "court";
  const seat = useCourtRole();
  const { court } = useCourt();
  return onCourtPage && seatHolds(seat, court, "evidence-marker");
}

/**
 * Mark one document as evidence: choose the side, see the number it takes,
 * mark it (DSB-13, DSB-14). In the filing dialogs' grammar: the act and the
 * document in the header, one choice, a sunken footer with the two ways out.
 */
export function MarkEvidenceDialog({
  caseId,
  document,
  taken,
  onOpenChange,
}: {
  caseId: string;
  /** The document being marked; null closes the dialog. */
  document: { id: string; title: string; provisionalId?: string | null } | null;
  /** Every evidence number already given in the case. */
  taken: (string | null | undefined)[];
  onOpenChange: (open: boolean) => void;
}) {
  const [side, setSide] = useState<EvidenceSide | "">("");
  const [error, setError] = useState<string | undefined>(undefined);
  /* What was open stays drawn while the dialog animates out. */
  const [shown, setShown] = useState(document);
  if (document && document !== shown) {
    setShown(document);
    setSide("");
    setError(undefined);
  }

  const options = EVIDENCE_SIDES.map((item) => ({ id: item.id, label: item.label }));

  function mark() {
    if (!shown) return;
    if (!side) {
      setError("Choose the side this document is marked for.");
      return;
    }
    const number = nextEvidenceNumber(taken, side);
    markEvidence(caseId, shown.id, number);
    notify.success(`Marked as ${number}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={document !== null} onOpenChange={onOpenChange}>
      <FlowDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-hairline px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-title-s font-semibold text-balance">
            Mark as evidence
          </DialogTitle>
          <DialogDescription className="text-body-compact text-pretty">
            {shown?.title}
            {shown?.provisionalId ? ` · ${shown.provisionalId}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
          <ChoicePillGroup
            legend="Marked for"
            options={options}
            value={side}
            error={error}
            orientation="column"
            onChange={(value) => {
              setSide(value);
              setError(undefined);
            }}
          />
          {/* The number the choice gives, once there is a choice (DSB-14). */}
          {side ? (
            <p className="text-body-compact text-foreground">
              It becomes{" "}
              <span className="font-mono font-medium">
                {nextEvidenceNumber(taken, side)}
              </span>
              .
            </p>
          ) : null}
        </div>
        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={mark}>
            Mark as evidence
          </Button>
        </footer>
      </FlowDialogContent>
    </Dialog>
  );
}
