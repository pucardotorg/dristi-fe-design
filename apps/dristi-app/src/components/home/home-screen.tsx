"use client";

import * as React from "react";
import { ArrowRightIcon, FilePlus2Icon, ScaleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  JoinCaseDialog,
  type JoinMode,
  type JoinResult,
} from "@/components/join/join-case-dialog";
import { useLocale } from "@/components/shell/locale";
import { useProfile } from "@/components/shell/profile";
import { pick, type Locale } from "@/lib/onboarding/content";
import { DEMO_JOIN_CASE, fill, home, shell, type JoinCase } from "@/lib/join/content";
import { Identifier } from "@/components/chrome/identifier";
import {
  LinkedComplaintCard,
  useLinkedComplaints,
} from "@/components/home/linked-complaint-cards";

type HomeCase = { joinCase: JoinCase; status: "joined" };
type VisibleHomeCase = HomeCase | { joinCase: JoinCase; status: "summons" };

/**
 * The signed-in litigant home — **placeholder body only**. It now renders inside the
 * shared app shell (see `app/home/layout.tsx`); the shell owns nav, notifications,
 * profile switch, and settings. A future designer swaps this inner body without
 * touching the shell. The summons auto-join modal stays here because it is the
 * body's behaviour, not the shell's.
 *
 * `idSkipped` / `profileIncomplete` are still accepted from the route (they arm the
 * profile-completion nudge) but the nudge now belongs to the shell's settings surface,
 * built separately — so they are inert here for now.
 */
export function HomeScreen({
  summoned,
  hasCase,
  openManualJoin = false,
  joinHandoff,
  pendingLink = false,
}: {
  summoned: boolean;
  hasCase: boolean;
  idSkipped?: boolean;
  profileIncomplete?: boolean;
  openManualJoin?: boolean;
  /** An advocate account chose Litigant or PoA holder in the advocate join dialog;
   *  carry on with that case here (JOIN-20) rather than searching for it again. */
  joinHandoff?: "self" | "poa";
  /** Someone joining a case entered this account's mobile number for a party; ask
   *  whether that is this person before linking the case (JOIN-64). */
  pendingLink?: boolean;
  initialLocale?: Locale;
}) {
  const { locale } = useLocale();
  const { accountName } = useProfile();
  const [dialogOpen, setDialogOpen] = React.useState(openManualJoin || Boolean(joinHandoff));
  const [dialogMode, setDialogMode] = React.useState<JoinMode>(
    joinHandoff ? "handoff" : "manual",
  );
  const [autoOpened, setAutoOpened] = React.useState(openManualJoin || Boolean(joinHandoff));
  const [cases, setCases] = React.useState<HomeCase[]>([]);
  const linkedComplaints = useLinkedComplaints();
  const [notice, setNotice] = React.useState<"file" | "case" | "nav" | null>(null);
  const [linkOpen, setLinkOpen] = React.useState(pendingLink);
  const [linkDeclined, setLinkDeclined] = React.useState(false);
  // The demo party a PoA holder or advocate entered this number for (not yet joined).
  const linkParty = DEMO_JOIN_CASE.accused.find((entry) => !entry.hasJoined);

  const summonsCase = summoned && hasCase ? DEMO_JOIN_CASE : undefined;
  const hasJoinedSummons = cases.some((entry) => entry.joinCase.cnr === summonsCase?.cnr);
  const visibleCases: VisibleHomeCase[] = summonsCase && !hasJoinedSummons
    ? [{ joinCase: summonsCase, status: "summons" }, ...cases]
    : cases;

  React.useEffect(() => {
    if (!summonsCase || autoOpened || cases.length) return;
    const timer = window.setTimeout(() => {
      setDialogMode("summons");
      setDialogOpen(true);
      setAutoOpened(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [summonsCase, autoOpened, cases.length]);

  function handleJoined(result: JoinResult) {
    // V1: every join is immediate — PoA holders and parties in person included.
    setCases((current) => [
      ...current.filter((entry) => entry.joinCase.cnr !== result.joinCase.cnr),
      { joinCase: result.joinCase, status: "joined" },
    ]);
  }

  function openJoin(mode: "summons" | "manual") {
    setDialogMode(mode);
    setDialogOpen(true);
    setNotice(null);
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
        <h1 className="text-title text-balance font-semibold sm:text-title-l">
          {fill(home.welcome, locale, { name: accountName })}
        </h1>

        <section className="flex flex-col gap-5" aria-label={pick(home.casesHeading, locale)}>
          <h2 className="text-title-s font-semibold">{pick(home.casesHeading, locale)}</h2>
          {visibleCases.length || linkedComplaints.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Complaints this person was asked to sign come first: one may need them. */}
              {linkedComplaints.map((item) => (
                <LinkedComplaintCard
                  key={`${item.link.draftId}:${item.link.signatoryId}`}
                  item={item}
                />
              ))}
              {visibleCases.map((entry) => (
                <Card key={entry.joinCase.cnr} size="sm" className="h-full max-w-sm">
                  <CardContent className="flex h-full flex-col gap-5">
                    <div className="flex flex-col items-start gap-3">
                      <Badge variant={entry.status === "joined" ? "success" : "warning"}>
                        {pick(
                          entry.status === "summons"
                            ? home.statusSummons
                            : home.statusJoined,
                          locale,
                        )}
                      </Badge>
                      <p className="text-body font-semibold text-pretty">{entry.joinCase.title}</p>
                    </div>
                    <div className="flex flex-col gap-2 text-caption text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">{pick(home.caseNumberLabel, locale)}</span>
                        <br />
                        <Identifier value={entry.joinCase.caseNumber} label="case number" />
                      </p>
                      <p>
                        <span className="font-medium text-foreground">{pick(home.hearingLabel, locale)}</span>
                        <br />
                        {entry.joinCase.hearingDate}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="mt-auto w-full"
                      onClick={() => (entry.status === "summons" ? openJoin("summons") : setNotice("case"))}
                    >
                      {pick(entry.status === "summons" ? home.reviewSummons : home.viewCase, locale)}
                      <ArrowRightIcon data-icon="inline-end" aria-hidden />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-body-compact text-muted-foreground">Cases you join or file will appear here.</p>
          )}
        </section>

        <div className="flex flex-col gap-8">
          <Separator />
          <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2">
            <Card size="sm">
              <CardContent className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand-muted-foreground">
                  <ScaleIcon className="size-5" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="text-body-compact font-semibold">{pick(home.joinTitle, locale)}</p>
                  <p className="text-caption text-muted-foreground">{pick(home.joinBody, locale)}</p>
                </div>
                <Button className="shrink-0" onClick={() => openJoin("manual")}>
                  {pick(home.joinAction, locale)}
                  <ArrowRightIcon data-icon="inline-end" aria-hidden />
                </Button>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FilePlus2Icon className="size-5" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="text-body-compact font-semibold">{pick(home.fileTitle, locale)}</p>
                  <p className="text-caption text-muted-foreground">{pick(home.fileBody, locale)}</p>
                </div>
                <Button variant="outline" className="shrink-0" onClick={() => setNotice("file")}>
                  {pick(home.fileAction, locale)}
                  <ArrowRightIcon data-icon="inline-end" aria-hidden />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {linkDeclined ? (
          <Alert variant="info">
            <AlertTitle>{pick(home.linkDeclinedTitle, locale)}</AlertTitle>
            <AlertDescription>{pick(home.linkDeclinedBody, locale)}</AlertDescription>
          </Alert>
        ) : null}

        {notice ? (
          <Alert variant="info">
            <AlertTitle>{pick(home.prototypeTitle, locale)}</AlertTitle>
            <AlertDescription>
              {pick(
                notice === "file" ? home.prototypeFile : notice === "nav" ? shell.prototypeNav : home.prototypeCase,
                locale,
              )}
            </AlertDescription>
          </Alert>
        ) : null}
      </main>

      {/* JOIN-64: the number's owner confirms the link. Yes links the case; No leaves it
          unlinked and nothing else happens here (that party's side is notified). */}
      <AlertDialog open={linkOpen} onOpenChange={setLinkOpen}>
        <ChromeAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pick(home.linkTitle, locale)}</AlertDialogTitle>
            <AlertDialogDescription>
              {fill(home.linkBody, locale, {
                caseNumber: DEMO_JOIN_CASE.caseNumber,
                name: linkParty?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLinkDeclined(true)}>
              {pick(home.linkNo, locale)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                setCases((current) => [
                  ...current.filter((entry) => entry.joinCase.cnr !== DEMO_JOIN_CASE.cnr),
                  { joinCase: DEMO_JOIN_CASE, status: "joined" },
                ])
              }
            >
              {pick(home.linkYes, locale)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>

      <JoinCaseDialog
        key={dialogMode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        summonsCase={
          dialogMode === "summons"
            ? summonsCase
            : dialogMode === "handoff"
              ? DEMO_JOIN_CASE
              : undefined
        }
        initialKind={dialogMode === "handoff" ? joinHandoff : undefined}
        locale={locale}
        onJoined={handleJoined}
      />
    </>
  );
}
