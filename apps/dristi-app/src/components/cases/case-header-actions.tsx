"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, DownloadIcon, Share2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShareDialog } from "@/components/access/share-dialog";
import type { AccessPerson } from "@/lib/access/content";
import { useCaseBail } from "@/components/cases/case-bail-flow";
import { useCaseReader } from "@/components/cases/case-reader";
import { Identifier } from "@/components/chrome/identifier";
import { SubmitDocumentsDialog } from "@/components/cases/submit-documents-form";
import { caseSectionHref } from "@/lib/cases/sections";
import { DownloadCaseFileDialog } from "@/components/cases/download-case-file-dialog";
import type { AccessCase } from "@/lib/access/content";

/**
 * Share access was hidden for v1 on Sept 17 and is back on Sept 18: the lead
 * designer's rule is that design carries the full feature list and the
 * developers cut what is out of a version's scope. The flag stays so that cut
 * is one line.
 */
const SHARE_ACCESS_ENABLED = true;

/**
 * Case-file header actions. Beyond Neer's own filings, this is the case-access hub:
 * Share access (this one case) and the entries into Mohit's bond flow (generate bond,
 * status). The bail application itself opens from Raise application, under Bail. The bail lifecycle + dialogs live in <CaseBailProvider>, which
 * wraps the page, so the in-page bond-task card and these entries share one state.
 */
/**
 * On a tablet held upright the actions row is wide, and Make filings beside two
 * 40px icons stretched into a slab (owner, Sept 21). There the two icon actions
 * take their words and the three share the row. A phone keeps the icons (no
 * room); the desk layout keeps them too (the row is packed at the far end).
 */
const WORDED_ON_TABLET =
  "sm:w-auto sm:flex-1 sm:gap-2 sm:px-4 " +
  "md:pointer-fine:w-10 md:pointer-fine:flex-none md:pointer-fine:px-0 " +
  "md:landscape:w-10 md:landscape:flex-none md:landscape:px-0";
/** The primary's place in the row — Make filings' own, so Generate order lands there too. */
const GENERATE_ORDER =
  "order-first flex-1 md:pointer-fine:order-none md:pointer-fine:flex-none md:landscape:order-none md:landscape:flex-none";
const TABLET_WORD = "hidden sm:inline md:pointer-fine:hidden md:landscape:hidden";

export function CaseHeaderActions({
  accessCase,
  disposed = false,
  shareReadOnly = false,
  shareExtraPeople,
  orderHref,
}: {
  accessCase: AccessCase;
  /** A disposed case still takes applications and documents (certified
   *  copies, restoration, return of documents), but no fresh bail filings.
   *  Working guess, open question Q-5. */
  disposed?: boolean;
  /** The viewer holds only office access here — share becomes view-only. */
  shareReadOnly?: boolean;
  /** The case's own nama advocates and staff, derived server-side. */
  shareExtraPeople?: AccessPerson[];
  /** The court's order screen for this case. Read only by the court, and absent where
   *  the court has no order screen to open for it yet. */
  orderHref?: string;
}) {
  const bail = useCaseBail();
  const [shareOpen, setShareOpen] = React.useState(false);
  const [downloadOpen, setDownloadOpen] = React.useState(false);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const router = useRouter();
  const caseId = accessCase.id;
  /* The court reads this same header with two changes (owner, 2026-10-13): no Share
     access — case access is the parties' to give — and Generate order where the
     advocate's Make filings stands. Download stays for both. */
  const court = useCaseReader() === "court";

  return (
    <TooltipProvider>
      {/* On a phone or a tablet held upright the row spans the header: the primary leads and takes the
          width, the two icon actions close the line. Left-packed at three
          different widths they read as loose parts (owner, Sept 21). */}
      <div className="flex w-full shrink-0 items-center gap-2 md:pointer-fine:w-auto md:landscape:w-auto">
        {SHARE_ACCESS_ENABLED && !court ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={WORDED_ON_TABLET}
                aria-label="Share access to this case"
                onClick={() => setShareOpen(true)}
              >
                <Share2Icon aria-hidden />
                <span className={TABLET_WORD}>Share access</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Share access to this case</TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={WORDED_ON_TABLET}
              aria-label="Download case file"
              onClick={() => setDownloadOpen(true)}
            >
              <DownloadIcon aria-hidden />
              <span className={TABLET_WORD}>Download</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Download case file</TooltipContent>
        </Tooltip>

        {court ? (
          orderHref ? (
            <Button asChild className={GENERATE_ORDER}>
              <Link href={orderHref}>Generate order</Link>
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  aria-disabled
                  className={`${GENERATE_ORDER} aria-disabled:opacity-50 aria-disabled:hover:bg-primary aria-disabled:active:translate-y-0`}
                >
                  Generate order
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                The order screen is not connected for this case yet
              </TooltipContent>
            </Tooltip>
          )
        ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" className="order-first flex-1 md:pointer-fine:order-none md:pointer-fine:flex-none md:landscape:order-none md:landscape:flex-none">
              Make filings
              <ChevronDownIcon data-icon="inline-end" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-max min-w-(--radix-dropdown-menu-trigger-width) whitespace-nowrap">
            <DropdownMenuItem asChild>
              <Link href={`/cases/${caseId}/filings/application`}>
                Raise application
              </Link>
            </DropdownMenuItem>
            {/* A dialog over the case, as every filing is; not a page. */}
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                setSubmitOpen(true);
              }}
            >
              Submit documents
            </DropdownMenuItem>
            {/* Bail is raised from Raise application, under its own type. */}
            {disposed ? null : (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  bail.openBondDirect();
                }}
              >
                Generate bail bond
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                bail.openStatus();
              }}
            >
              Bond status
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>

      <SubmitDocumentsDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        caseLine={
          <>
            <Identifier value={accessCase.caseNumber} label="case number" copyable={false} />
            <span aria-hidden> · </span>
            {accessCase.title}
          </>
        }
        // Lands on the register the submission is designed to appear in.
        onSubmitted={() => router.push(caseSectionHref(caseId, "documents"))}
      />

      <DownloadCaseFileDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        caseNumber={accessCase.caseNumber}
        title={accessCase.title}
        court={accessCase.court}
      />

      {SHARE_ACCESS_ENABLED && !court ? (
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        cases={[accessCase]}
        locale="en"
        readOnly={shareReadOnly}
        extraPeople={shareExtraPeople}
      />
      ) : null}
    </TooltipProvider>
  );
}
