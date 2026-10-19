"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { useCourtText } from "@/components/court/court-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocalStorageValue } from "@/hooks/use-local-storage-value";
import { getRepository } from "@/lib/filing/data";
import { ensureSampleDrafts } from "@/lib/filing/sample-drafts";
import {
  complaintsNaming,
  linkedComplaintHref,
  LINKED_COMPLAINTS_KEY,
  parseLinkedComplaints,
  type LinkedComplaint,
  NEW_ACCOUNT_SHELL_KEY,
  SIGNED_IN_MOBILE_KEY,
} from "@/lib/filing/linked-complaints";
import { COURT } from "@/lib/filing/options";
import {
  draftTitle,
  confirmerSlot,
  phoneConfirmed,
  phoneConfirmers,
  sameMobile,
  signatories,
} from "@/lib/filing/selectors";
import type { FilingDraft } from "@/lib/filing/types";

type Loaded = { link: LinkedComplaint; draft: FilingDraft };

/** Where this person stands on one complaint — what the card's badge and button say. */
function standing({ link, draft }: Loaded) {
  if (draft.status === "filed") {
    return { badge: "Filed", variant: "success" as const, action: "View complaint" };
  }
  const { complainants, advocates } = signatories(draft, null);
  const me = [...complainants, ...advocates].find((s) => s.id === link.signatoryId);
  const onPaper = draft.sign.mode === "upload";
  // On paper this person confirms by OTP on their own device instead of e-signing (`SIG-05`).
  const confirmer = phoneConfirmers(draft).find((p) => confirmerSlot(p.id) === link.signatoryId);
  const unconfirmed = onPaper && !!confirmer && me?.status !== "signed" && !phoneConfirmed(draft, confirmer);
  // Only a complainant's slot carries an oath (`OTH-3`); `false` means it is still owed.
  const owed =
    !!me && ((!onPaper && me.status !== "signed") || unconfirmed || me.oathTaken === false);
  return owed
    ? {
        badge: onPaper ? "Your confirmation needed" : "Your e-signature needed",
        variant: "warning" as const,
        action: onPaper ? "Review and confirm" : "Review and sign",
      }
    : { badge: "Signed · being filed", variant: "secondary" as const, action: "View complaint" };
}

/**
 * The complaints this litigant was asked to sign, as cards beside their other cases
 * (`lib/filing/linked-complaints.ts`). Read from the same drafts the filer works on, so
 * a card moves from "needed" to "signed" to "filed" as the filing does.
 */
export function useLinkedComplaints(): Loaded[] {
  const raw = useLocalStorageValue(LINKED_COMPLAINTS_KEY);
  const mobile = useLocalStorageValue(SIGNED_IN_MOBILE_KEY) ?? "";
  /* A new account, by the join door, has none from earlier links (owner, 2026-10-14). */
  const freshShell = useLocalStorageValue(NEW_ACCOUNT_SHELL_KEY) === "1";
  const links = React.useMemo(
    () => (freshShell ? [] : parseLinkedComplaints(raw)),
    [raw, freshShell],
  );
  const [loaded, setLoaded] = React.useState<Loaded[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    const repo = getRepository();
    (async () => {
      // Sandbox: a litigant's home can be the first page this browser opens.
      await ensureSampleDrafts();
      const drafts = await repo.listDrafts().catch(() => [] as FilingDraft[]);
      const byId = new Map(drafts.map((d) => [d.id, d]));
      // Complaints naming this number come first; links opened earlier follow.
      const all = [...complaintsNaming(drafts, mobile, sameMobile), ...links];
      const seen = new Set<string>();
      const rows: Loaded[] = [];
      for (const link of all) {
        const key = `${link.draftId}|${link.signatoryId}`;
        const draft = byId.get(link.draftId);
        if (!draft || seen.has(key)) continue;
        seen.add(key);
        rows.push({ link, draft });
      }
      if (!cancelled) setLoaded(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [links, mobile]);
  return loaded;
}

export function LinkedComplaintCard({ item }: { item: Loaded }) {
  const courtText = useCourtText();
  const { badge, variant, action } = standing(item);
  const filer = item.draft.advocates[0]?.name.trim();
  return (
    <Card size="sm" className="h-full max-w-sm">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex flex-col items-start gap-3">
          <Badge variant={variant}>{badge}</Badge>
          <p className="text-body font-semibold text-pretty">{draftTitle(item.draft)}</p>
        </div>
        <div className="flex flex-col gap-2 text-caption text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Court</span>
            <br />
            {courtText(COURT.name)}
          </p>
          {filer ? (
            <p>
              <span className="font-medium text-foreground">Filed by</span>
              <br />
              {filer}
            </p>
          ) : null}
        </div>
        <Button asChild variant="outline" className="mt-auto w-full">
          <Link href={linkedComplaintHref(item.link)}>
            {action}
            <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
