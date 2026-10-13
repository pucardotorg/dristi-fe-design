"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AdvocateHome } from "@/components/advocate/advocate-home";
import { AdvocateJoinCaseDialog } from "@/components/advocate/join-case-dialog";
import { useLocale } from "@/components/shell/locale";
import { useProfile } from "@/components/shell/profile";
import { ADVOCATE_JOIN_CASE } from "@/lib/advocate/content";
import { homeConfigFor } from "@/lib/advocate/config";

/**
 * The advocate home — greets the signed-in account (not a fixed fixture name).
 *
 * A summons token in the query (`/advocate?token=…`, carried across sign-in from the
 * `/join/<token>` link) arms the auto join-modal: the advocate lands here and the
 * "Join a case" dialog opens on its own, on the served case — mirroring the litigant
 * `/home`. Everywhere else the modal stays one tap away from the Join-a-case rail; the
 * token only decides whether it opens unprompted. `nocase=1` is the served-but-not-in-CIS
 * path: token present, no case behind it, so nothing auto-opens. `slots=2` or `slots=3`
 * previews a day split into sittings (demo only).
 */
function AdvocatePage() {
  const { locale } = useLocale();
  const { accountName, switchProfile } = useProfile();
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const hasCase = searchParams.get("nocase") !== "1";
  const summonsCase = token && hasCase ? ADVOCATE_JOIN_CASE : undefined;

  const firstName = accountName.replace(/^Adv\.\s*/, "").split(" ")[0];

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [autoOpened, setAutoOpened] = React.useState(false);

  // Arm the modal once, a beat after landing, so the home paints first.
  React.useEffect(() => {
    if (!summonsCase || autoOpened) return;
    const timer = window.setTimeout(() => {
      setDialogOpen(true);
      setAutoOpened(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [summonsCase, autoOpened]);

  return (
    <>
      <AdvocateHome
        locale={locale}
        profileFirstName={firstName}
        config={homeConfigFor(searchParams.get("slots"))}
        // Demo only: `?filter=a` shows the scope switch beside a names menu; the
        // default is the single People menu.
        filterVariant={searchParams.get("filter") === "a" ? "switch" : "menu"}
      />
      {summonsCase ? (
        <AdvocateJoinCaseDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          mode="summons"
          summonsCase={summonsCase}
          locale={locale}
          onJoined={() => {
            /* The dialog's done-stage reports the outcome; Your Cases will surface a
               joined case once that screen is built on this shell. */
          }}
          onJoinAsLitigant={(kind) => {
            setDialogOpen(false);
            // Discovering mid-journey that you are a party (or their PoA holder) hands
            // off to the litigant flow with this case already found (JOIN-20).
            switchProfile();
            router.push(`/home?join=handoff&as=${kind}`);
          }}
        />
      ) : null}
    </>
  );
}

/** The advocate home — greets the signed-in account (not a fixed fixture name). */
export default function Page() {
  return (
    <React.Suspense>
      <AdvocatePage />
    </React.Suspense>
  );
}
