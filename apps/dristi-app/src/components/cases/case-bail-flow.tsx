"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  DueStatusLine,
  PendingTaskRow,
  TaskNote,
} from "@/components/cases/case-overview-card";
import { BailApplicationDialog } from "@/components/filing/bail-application-dialog";
import {
  BailBondDialog,
  type BondMode,
} from "@/components/filing/bail-bond-dialog";
import {
  BailBondStatusDialog,
  buildBondSigners,
} from "@/components/filing/bail-bond-status-dialog";
import { useLocale } from "@/components/shell/locale";
import { useProfile } from "@/components/shell/profile";
import type { AccessCase } from "@/lib/access/content";
import {
  BOND_ID,
  BOND_LITIGANT,
  BOND_SURETIES,
  BOND_TASK_DUE_ON,
  BOND_THIRD_SURETY,
  bondCopy,
} from "@/lib/filing/content";
import { dueStatusView } from "@/lib/cases/peek";
import { pick } from "@/lib/onboarding/content";
import { Identifier } from "@/components/chrome/identifier";

/**
 * The whole bail lifecycle on a case, held in one place so the header's "Make filings"
 * entries and the in-page lifecycle card share the same state (Mohit's original flow):
 *
 *   raise bail application → magistrate approves with terms → a "task" to raise the bond
 *   with those terms FROZEN → generate the bond → out for signatures → status.
 *
 * "Generate bail bond" from Make filings is the direct entry (nothing frozen). Sureties
 * sign the bond itself from the /bond link.
 */
type BondPhase = "none" | "task" | "signing" | "review";

type CaseBailValue = {
  bondPhase: BondPhase;
  openApplication: () => void;
  openBondDirect: () => void;
  openBondTask: () => void;
  openStatus: () => void;
};

const CaseBailContext = React.createContext<CaseBailValue | null>(null);

export function useCaseBail(): CaseBailValue {
  const value = React.useContext(CaseBailContext);
  if (!value) throw new Error("useCaseBail must be used inside <CaseBailProvider>");
  return value;
}

/** The bail lifecycle where a surface may sit outside the provider (the court's case page). */
export function useOptionalCaseBail(): CaseBailValue | null {
  return React.useContext(CaseBailContext);
}

export function CaseBailProvider({
  accessCase,
  initialBondPhase = "task",
  children,
}: {
  accessCase: AccessCase;
  /** Seeded to "task" for the demo: the magistrate has already approved a bail
   *  application on this case and asked for a bond. */
  initialBondPhase?: BondPhase;
  children: React.ReactNode;
}) {
  const { locale } = useLocale();
  const { accountName } = useProfile();
  const [bailOpen, setBailOpen] = React.useState(false);
  const [bondOpen, setBondOpen] = React.useState(false);
  const [bondMode, setBondMode] = React.useState<BondMode>("direct");
  const [bondStatusOpen, setBondStatusOpen] = React.useState(false);
  const [bondMethod, setBondMethod] = React.useState<"esign" | "upload">("esign");
  const [bondPhase, setBondPhase] = React.useState<BondPhase>(initialBondPhase);

  const suretyNames = [...BOND_SURETIES, BOND_THIRD_SURETY].map((s) => s.name);

  const value = React.useMemo<CaseBailValue>(
    () => ({
      bondPhase,
      // Submitting a bail application sends it to the magistrate; the approval comes
      // back as a bond task with the terms set.
      openApplication: () => setBailOpen(true),
      openBondDirect: () => {
        setBondMode("direct");
        setBondOpen(true);
      },
      openBondTask: () => {
        setBondMode("task");
        setBondOpen(true);
      },
      openStatus: () => setBondStatusOpen(true),
    }),
    [bondPhase],
  );

  return (
    <CaseBailContext.Provider value={value}>
      {children}

      <BailApplicationDialog
        open={bailOpen}
        onOpenChange={setBailOpen}
        accessCase={accessCase}
        locale={locale}
        onSubmitted={() => setBondPhase("task")}
      />

      {/* Remount per mode so each entry (task = frozen terms, direct = editable,
          edit = correct a submitted bond) starts from its own clean state. */}
      <BailBondDialog
        key={bondMode}
        open={bondOpen}
        onOpenChange={setBondOpen}
        accessCase={accessCase}
        mode={bondMode}
        onSubmitted={(result) => {
          setBondMethod(result.method);
          setBondPhase(result.method === "esign" ? "signing" : "review");
        }}
      />

      <BailBondStatusDialog
        open={bondStatusOpen}
        onOpenChange={setBondStatusOpen}
        accessCase={accessCase}
        locale={locale}
        signers={buildBondSigners({
          advocateName: accountName,
          litigantName: BOND_LITIGANT.name,
          suretyNames,
          locale,
          advocateSigned: true,
          allSigned: bondMethod === "upload",
        })}
        suretyNames={suretyNames}
        onEdit={() => {
          setBondStatusOpen(false);
          setBondMode("edit");
          setBondOpen(true);
        }}
      />
    </CaseBailContext.Provider>
  );
}

/**
 * Whether the bond lifecycle currently owes the case a Pending-tasks row.
 * Context-tolerant on purpose: Overview calls this to size the card's count,
 * and a surface rendered outside the provider simply has no bond work.
 */
export function useBondTaskVisible(): boolean {
  const value = React.useContext(CaseBailContext);
  return value !== null && value.bondPhase !== "none";
}

/**
 * The bond lifecycle as a row of the Overview's own Pending-tasks card —
 * merged there from a standalone card above the tabs (Aug 31 correction
 * round: one card, the bond task a listing in it). Two shapes, mirroring the
 * card it replaced: the task the magistrate's approval created, then — once
 * a bond exists — its signing/review status. Markup and metrics follow the
 * card's other task rows (`TaskRow` in case-overview) so the merged row is
 * indistinguishable from its authored siblings.
 */
export function BondTaskRow({
  nextHearingOn,
  now,
  onArchive,
}: {
  nextHearingOn: string | null | undefined;
  now: number;
  onArchive?: () => void;
}) {
  const { locale } = useLocale();
  const value = React.useContext(CaseBailContext);
  if (!value || value.bondPhase === "none") return null;
  const { bondPhase, openBondTask, openStatus } = value;

  if (bondPhase === "task") {
    return (
      <PendingTaskRow
        title={pick(bondCopy.taskRaiseBond, locale)}
        respond={{ onClick: openBondTask }}
        onArchive={onArchive}
      >
        <DueStatusLine
          {...dueStatusView(BOND_TASK_DUE_ON, nextHearingOn, now)}
        />
        <TaskNote>{pick(bondCopy.taskNote, locale)}</TaskNote>
      </PendingTaskRow>
    );
  }

  return (
    <PendingTaskRow
      title={pick(bondCopy.bondTypeSurety, locale)}
      respond={{ onClick: openStatus }}
      onArchive={onArchive}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">
          {pick(
            bondPhase === "signing"
              ? bondCopy.statusPendingSign
              : bondCopy.statusPendingReview,
            locale,
          )}
        </Badge>
        <Identifier
          value={BOND_ID}
          label="bond number"
          className="text-caption text-muted-foreground"
        />
      </div>
    </PendingTaskRow>
  );
}
