"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, FilePlus2Icon, ScaleIcon } from "lucide-react";

import { Identifier } from "@/components/chrome/identifier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AdvocateJoinCaseDialog,
  type AdvocateJoinResult,
} from "@/components/advocate/join-case-dialog";
import { useProfile } from "@/components/shell/profile";
import { advShellHome } from "@/lib/advocate/content";
import { JOIN_DEMO_CASE_ID } from "@/lib/cases/party-cases";
import { fill } from "@/lib/join/content";
import { pick, type Locale } from "@/lib/onboarding/content";

/**
 * The home of an advocate who has just registered (owner, 2026-10-14): nothing listed,
 * no hearings. It is the litigant shell's shape (`HomeScreen`) — a welcome, Your cases,
 * and the two ways in — because a day view with nothing in it is a page of empty
 * furniture, and the one thing a new account can do is join or file a case.
 *
 * A case joined here appears under Your cases at once, and opens.
 */
export function AdvocateShellHome({ locale }: { locale: Locale }) {
  const router = useRouter();
  const { displayName, switchProfile } = useProfile();
  const name = displayName.replace(/^Adv\.\s*/, "");
  const [joinOpen, setJoinOpen] = React.useState(false);
  const [joined, setJoined] = React.useState<AdvocateJoinResult[]>([]);

  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
        <h1 className="text-title text-balance font-semibold sm:text-title-l">
          {fill(advShellHome.welcome, locale, { name })}
        </h1>

        <section className="flex flex-col gap-5" aria-label={pick(advShellHome.casesHeading, locale)}>
          <h2 className="text-title-s font-semibold">{pick(advShellHome.casesHeading, locale)}</h2>
          {joined.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {joined.map((entry) => (
                <Card key={entry.joinCase.cnr} size="sm" className="h-full max-w-sm">
                  <CardContent className="flex h-full flex-col gap-5">
                    <div className="flex flex-col items-start gap-3">
                      <Badge variant={entry.joined ? "success" : "warning"}>
                        {pick(entry.joined ? advShellHome.statusJoined : advShellHome.statusUnpaid, locale)}
                      </Badge>
                      <p className="text-body font-semibold text-pretty">{entry.joinCase.title}</p>
                    </div>
                    <div className="flex flex-col gap-2 text-caption text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">
                          {pick(advShellHome.caseNumberLabel, locale)}
                        </span>
                        <br />
                        <Identifier value={entry.joinCase.caseNumber} label="case number" />
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          {pick(advShellHome.hearingLabel, locale)}
                        </span>
                        <br />
                        {entry.joinCase.hearingDate}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="mt-auto w-full"
                      onClick={() => router.push(`/cases/${JOIN_DEMO_CASE_ID}`)}
                    >
                      {pick(advShellHome.viewCase, locale)}
                      <ArrowRightIcon data-icon="inline-end" aria-hidden />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-body-compact text-muted-foreground">
              {pick(advShellHome.casesEmpty, locale)}
            </p>
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
                  <p className="text-body-compact font-semibold">{pick(advShellHome.joinTitle, locale)}</p>
                  <p className="text-caption text-muted-foreground">{pick(advShellHome.joinBody, locale)}</p>
                </div>
                <Button className="shrink-0" onClick={() => setJoinOpen(true)}>
                  {pick(advShellHome.joinAction, locale)}
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
                  <p className="text-body-compact font-semibold">{pick(advShellHome.fileTitle, locale)}</p>
                  <p className="text-caption text-muted-foreground">{pick(advShellHome.fileBody, locale)}</p>
                </div>
                <Button variant="outline" className="shrink-0" onClick={() => router.push("/filings")}>
                  {pick(advShellHome.fileAction, locale)}
                  <ArrowRightIcon data-icon="inline-end" aria-hidden />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <AdvocateJoinCaseDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        mode="manual"
        locale={locale}
        onJoined={(result) =>
          setJoined((current) => [
            result,
            ...current.filter((entry) => entry.joinCase.cnr !== result.joinCase.cnr),
          ])
        }
        onJoinAsLitigant={(kind) => {
          setJoinOpen(false);
          switchProfile();
          router.push(`/home?join=handoff&as=${kind}`);
        }}
      />
    </>
  );
}
