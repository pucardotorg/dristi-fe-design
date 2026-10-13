"use client";

import * as React from "react";
import { DownloadIcon, Maximize2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pick, type Locale } from "@/lib/onboarding/content";
import type { AccessCase } from "@/lib/access/content";
import {
  BOND_AMOUNT,
  BOND_LITIGANT,
  bailDialog,
  bondCopy,
  fillCopy,
} from "@/lib/filing/content";
import { cn } from "@/lib/utils";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The generated Form No. 37 bond, shared by the advocate dialogs and the
 * party signing page so the document can never drift between the two. Like
 * the application draft it is structured content, not an uploaded file — a
 * white page on a sunken well, with download and full-screen actions where
 * a viewer expects them (top right, under the dialog's close).
 */
export function BondDocument({
  accessCase,
  suretyNames,
  locale,
  expanded = false,
  onExpand,
  onDownload,
}: {
  accessCase: AccessCase;
  suretyNames: string[];
  locale: Locale;
  expanded?: boolean;
  onExpand?: () => void;
  onDownload?: () => void;
}) {
  const courtText = useCourtText();
  return (
    <div
      className={cn(
        "relative rounded-lg bg-surface-sunken",
        expanded ? "min-h-0 flex-1 overflow-y-auto p-6" : "p-3",
      )}
    >
      {onDownload || onExpand ? (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
          {onDownload ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="bg-surface"
              aria-label={pick(bondCopy.downloadBond, locale)}
              onClick={onDownload}
            >
              <DownloadIcon aria-hidden />
            </Button>
          ) : null}
          {onExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="bg-surface"
              aria-label={pick(bondCopy.expandBond, locale)}
              onClick={onExpand}
            >
              <Maximize2Icon aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
      <article
        className={cn(
          "mx-auto flex flex-col gap-4 rounded-md bg-surface px-5 py-6",
          expanded && "min-h-full max-w-3xl px-8 py-10",
          (onDownload || onExpand) && "pr-14",
        )}
      >
        <p className="text-caption text-muted-foreground">
          {pick(bailDialog.draftPageLabel, locale)}
        </p>
        <div className="flex flex-col gap-1 text-center">
          <p className="text-body-compact text-muted-foreground">
            {pick(bondCopy.formLine, locale)}
          </p>
          <p className="text-body font-semibold">{pick(bondCopy.bondDocTitle, locale)}</p>
          <p className="text-body-compact italic">{pick(bondCopy.sectionLine, locale)}</p>
        </div>
        <p className="text-center text-body-compact font-semibold text-balance">
          {courtText(pick(bailDialog.draftCourtLine, locale))}
        </p>
        <p className="text-center text-body-compact font-medium tabular-nums">
          {fillCopy(bailDialog.draftCaseLine, locale, { caseNumber: accessCase.caseNumber })}
        </p>
        <p className="text-center text-body-compact text-pretty">
          {fillCopy(bailDialog.draftMatterLine, locale, { title: accessCase.title })}
        </p>
        <p className="text-body-compact text-pretty text-muted-foreground">
          {fillCopy(bondCopy.bondBody1, locale, {
            name: BOND_LITIGANT.name,
            father: BOND_LITIGANT.father,
          })}{" "}
          {fillCopy(bondCopy.bondBody2, locale, { amount: BOND_AMOUNT })}
        </p>
        {suretyNames.length ? (
          <p className="text-body-compact text-pretty text-muted-foreground">
            {fillCopy(bondCopy.bondSuretyClause, locale, {
              name: BOND_LITIGANT.name,
              amount: BOND_AMOUNT,
              sureties: suretyNames.join(", "),
            })}
          </p>
        ) : null}
      </article>
    </div>
  );
}

export type BondSigner = {
  name: string;
  /** Display role — litigant, surety N, advocate. */
  role: string;
  signed: boolean;
  /** Highlights the row on the party signing page. */
  you?: boolean;
};

/** Who has signed and who is pending — one presentation on every surface. */
export function BondSignerList({ signers, locale }: { signers: BondSigner[]; locale: Locale }) {
  return (
    <ul className="flex flex-col divide-y divide-hairline">
      {signers.map((signer) => (
        <li key={`${signer.role}-${signer.name}`} className="flex items-center gap-3 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-body-compact font-medium">
              {signer.name}
              {signer.you ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  {pick(bondCopy.partyYou, locale)}
                </span>
              ) : null}
            </p>
            <p className="text-caption text-muted-foreground">{signer.role}</p>
          </div>
          <Badge variant={signer.signed ? "success" : "warning"}>
            {pick(signer.signed ? bondCopy.signedStatus : bondCopy.pendingStatus, locale)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
