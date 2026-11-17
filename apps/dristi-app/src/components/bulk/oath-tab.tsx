"use client";

/**
 * Review and sign › Oath (owner, 2026-11-17): after the batch is signed, the complainant's
 * representative swears once for every case in it, as individual filing asks for each
 * complainant's oath (`OTH`). The filer sends them a link and sees whether it is done; the
 * court fee waits for it.
 */

import * as React from "react";
import {
  CheckIcon,
  ExternalLinkIcon,
  FlaskConicalIcon,
  IdCardIcon,
  ScanFaceIcon,
  SendIcon,
  UserIcon,
} from "lucide-react";

import { batchOathText, oathLinkPath } from "@/lib/bulk/oath";
import { FilingFooter } from "@/components/filing/filing-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusLine } from "@/components/feedback";
import { notify } from "@/components/ui/notify";

import { bulkApi } from "./api";
import { BatchFooter } from "./batch-footer";
import type { BatchCtx } from "./batch-screen";

/** How to be on camera, as individual filing asks (`oath-capture.tsx`). */
const ON_CAMERA = [
  { icon: ScanFaceIcon, text: "Face visible, good light" },
  { icon: UserIcon, text: "Only them in the frame" },
  { icon: IdCardIcon, text: "ID card shown first" },
] as const;

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function OathTab({ batch, setBatch, go }: BatchCtx) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const rep = batch.representative;
  const oath = batch.oath;
  const signed = batch.counts.signed + batch.counts.filed;
  const cases = batch.cases.filter((c) => c.stage !== "filed").length || batch.total;
  const act = async (action: "oath-send" | "oath-taken") => {
    setBusy(true);
    setError(null);
    try {
      setBatch(await bulkApi.act(batch.id, { action }));
      // The act is confirmed where the filer is looking, as the panel's row changes.
      const to = rep?.mobile ? ` to •••• ${rep.mobile.slice(-4)}` : "";
      if (action === "oath-taken") notify.success("Oath marked as taken");
      else notify.success(oath.sentAt ? `Oath link sent again${to}` : `Oath link sent${to}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // While the link is out, look again every few seconds, so the page shows it the moment
  // it's recorded on their phone.
  const waiting = !!oath.sentAt && !oath.takenAt;
  React.useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      bulkApi.get(batch.id).then((next) => {
        // Taken on their phone while this page waited: said once, as it lands.
        if (next.oath.takenAt) notify.success(`Oath taken by ${next.oath.by || next.representative?.name || "the representative"}`);
        setBatch(next);
      }, () => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [waiting, batch.id, setBatch]);

  const who = oath.by || rep?.name || "The representative";
  const initials = (rep?.name ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("");

  return (
    <div className="flex flex-col gap-6">
      {!signed && !oath.takenAt ? (
        <StatusLine tone="neutral" still>
          Sign the batch first.
        </StatusLine>
      ) : null}
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      {/* One panel: who swears, where it stands, and the one thing to do about it. */}
      <Card variant="raised" className="gap-0 py-0">
        <div className="flex items-center gap-4 px-6 py-5">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-muted text-body-compact font-semibold text-brand-muted-foreground"
          >
            {initials}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body font-semibold">{rep?.name ?? "The complainant's representative"}</span>
            <span className="truncate text-body-compact text-muted-foreground">
              {[rep?.designation, batch.client].filter(Boolean).join(", ")}
            </span>
          </span>
          {/* Sandbox, the product's flask: be the representative, or skip the recording. */}
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Sandbox: the oath" className="self-start text-muted-foreground">
                      <FlaskConicalIcon aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Sandbox: the oath</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Sandbox</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <a href={oathLinkPath(batch.id)} target="_blank" rel="noopener">
                  <ExternalLinkIcon aria-hidden />
                  Open the link as {rep?.name?.split(" ")[0] ?? "them"}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={busy || !!oath.takenAt} onSelect={() => void act("oath-taken")}>
                <CheckIcon aria-hidden />
                Mark the oath as taken
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-4 border-t border-hairline px-6 py-5 sm:flex-row sm:items-center">
          {oath.takenAt ? (
            <p className="flex min-w-0 flex-1 items-start gap-3 text-body-compact">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                <CheckIcon className="size-3.5" aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">Oath taken</span>
                <span className="text-muted-foreground tabular-nums">
                  {who}, {time(oath.takenAt)}
                  {oath.video ? "" : " (sandbox)"}
                </span>
              </span>
            </p>
          ) : oath.sentAt ? (
            <p className="flex min-w-0 flex-1 items-start gap-3 text-body-compact">
              <span aria-hidden className="relative mt-1.5 flex size-2.5 shrink-0">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2.5 rounded-full bg-info" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">Waiting for the oath</span>
                <span className="text-muted-foreground tabular-nums">
                  Sent {time(oath.sentAt)}
                  {rep?.mobile ? ` to •••••• ${rep.mobile.slice(-4)}` : ""}
                </span>
              </span>
            </p>
          ) : (
            <p className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-compact">
              <span className="font-medium text-foreground">Oath not sent</span>
              <span className="text-muted-foreground tabular-nums">
                Once for all {cases} cases{rep?.mobile ? ` · SMS to •••••• ${rep.mobile.slice(-4)}` : ""}
              </span>
            </p>
          )}
          {!oath.takenAt ? (
            <Button
              variant={oath.sentAt ? "outline" : "default"}
              disabled={busy}
              onClick={() => void act("oath-send")}
              className="shrink-0 self-start sm:self-center"
            >
              <SendIcon data-icon="inline-start" aria-hidden />
              {oath.sentAt ? "Send again" : "Send oath link"}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card variant="raised">
        <CardHeader>
          <CardTitle className="text-body font-semibold">What they&apos;ll say</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <blockquote className="border-l-2 border-brand-accent pl-4 text-body leading-7 text-foreground">
            {batchOathText(batch.client, batch.number, cases)}
          </blockquote>
          <div className="flex flex-col gap-2 border-t border-hairline pt-4">
            <span className="text-body-compact font-medium">On camera</span>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {ON_CAMERA.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-body-compact text-muted-foreground">
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <BatchFooter>
        <FilingFooter
          showSaveState={false}
          onBack={() => go("sign")}
          continueLabel="Continue to Pay"
          continueDisabled={!oath.takenAt || !batch.counts.signed}
          continueHint={!oath.takenAt ? "Pay opens after the oath" : undefined}
          onContinue={() => go("pay")}
        />
      </BatchFooter>
    </div>
  );
}
