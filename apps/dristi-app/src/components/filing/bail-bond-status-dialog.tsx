"use client";

import * as React from "react";
import { PencilIcon } from "lucide-react";

import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BondDocument, BondSignerList, type BondSigner } from "@/components/filing/bond-document";
import { pick, type Locale } from "@/lib/onboarding/content";
import type { AccessCase } from "@/lib/access/content";
import { bondCopy, fillCopy, BOND_ID } from "@/lib/filing/content";
import { Identifier } from "@/components/chrome/identifier";

/**
 * The advocate's view of a bond that is out for signatures: who has signed,
 * who is pending, and the bond itself. The one action is Edit details — and
 * because editing invalidates every signature already made (the litigant's
 * and the sureties' included), it is guarded by an explicit confirmation.
 */
export function BailBondStatusDialog({
  open,
  onOpenChange,
  accessCase,
  locale,
  signers,
  suretyNames,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessCase: AccessCase;
  locale: Locale;
  signers: BondSigner[];
  suretyNames: string[];
  onEdit: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FlowDialogContent
        lang={locale}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 border-b border-hairline px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-title-s font-semibold text-balance">
            {pick(bondCopy.bondDocTitle, locale)}{" "}
            {/* The title is the dialog's accessible name — the face, not a control. */}
            <Identifier
              value={BOND_ID}
              label="bond number"
              className="text-body-compact font-normal text-muted-foreground"
              copyable={false}
            />
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {/* No copy control inside the dialog's accessible description. */}
            <Identifier value={accessCase.caseNumber} label="case number" copyable={false} />
            <span aria-hidden> · </span>
            {accessCase.title}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <p className="text-caption font-semibold text-muted-foreground">
                {pick(bondCopy.esignStatusHeading, locale)}
              </p>
              <BondSignerList signers={signers} locale={locale} />
            </div>
            <BondDocument accessCase={accessCase} suretyNames={suretyNames} locale={locale} />
          </div>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {pick(bondCopy.cancel, locale)}
          </Button>
          <Button type="button" data-icon="inline-start" onClick={() => setConfirmOpen(true)}>
            <PencilIcon aria-hidden />
            {pick(bondCopy.editDetails, locale)}
          </Button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <ChromeAlertDialogContent lang={locale}>
              <AlertDialogHeader>
                <AlertDialogTitle>{pick(bondCopy.invalidateTitle, locale)}</AlertDialogTitle>
                <AlertDialogDescription className="text-pretty">
                  {pick(bondCopy.invalidateBody, locale)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{pick(bondCopy.cancel, locale)}</AlertDialogCancel>
                <AlertDialogAction onClick={onEdit}>
                  {pick(bondCopy.invalidateConfirm, locale)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </ChromeAlertDialogContent>
          </AlertDialog>
        </footer>
      </FlowDialogContent>
    </Dialog>
  );
}

/** Builds the signer rows for a bond: advocate, litigant, then each surety. */
export function buildBondSigners({
  advocateName,
  litigantName,
  suretyNames,
  locale,
  advocateSigned,
  allSigned,
  youPhone,
  phones,
}: {
  advocateName: string;
  litigantName: string;
  suretyNames: string[];
  locale: Locale;
  advocateSigned: boolean;
  /** The physically-signed upload path carries everyone's signature. */
  allSigned: boolean;
  /** Party page: which row is "you", matched by phone. */
  youPhone?: string;
  phones?: string[];
}): BondSigner[] {
  return [
    {
      name: advocateName,
      role: pick(bondCopy.roleAdvocate, locale),
      signed: advocateSigned || allSigned,
    },
    {
      name: litigantName,
      role: pick(bondCopy.roleLitigant, locale),
      signed: allSigned,
      you: youPhone !== undefined && phones?.[0] === youPhone,
    },
    ...suretyNames.map((name, index) => ({
      name,
      role: fillCopy(bondCopy.roleSurety, locale, { n: String(index + 1) }),
      signed: allSigned,
      you: youPhone !== undefined && phones?.[index + 1] === youPhone,
    })),
  ];
}
