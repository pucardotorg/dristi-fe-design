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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusLine } from "@/components/feedback";

import { bulkApi } from "./api";
import { BatchFooter } from "./batch-footer";
import type { BatchCtx } from "./batch-screen";

/** How to be on camera, as individual filing asks (`oath-capture.tsx`). */
const ON_CAMERA = [
  { icon: ScanFaceIcon, text: "Face clearly visible, in good light" },
  { icon: UserIcon, text: "The only person in the frame" },
  { icon: IdCardIcon, text: "ID card held up to the camera at the start" },
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
      bulkApi.get(batch.id).then(setBatch, () => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [waiting, batch.id, setBatch]);

  const status = oath.takenAt ? (
    <Badge variant="success" className="text-body-compact">
      <CheckIcon data-icon="inline-start" aria-hidden />
      Oath taken
    </Badge>
  ) : oath.sentAt ? (
    <Badge variant="info" className="text-body-compact">Link sent</Badge>
  ) : (
    <Badge variant="secondary" className="text-body-compact">Not sent</Badge>
  );

  return (
    <div className="flex flex-col gap-6">
      {oath.takenAt ? (
        <StatusLine tone="success" still title={`${oath.by || rep?.name || "The representative"} took the oath`}>
          {time(oath.takenAt)}
          {oath.video ? ", on camera." : " (sandbox)."} The batch can be paid for.
        </StatusLine>
      ) : !signed ? (
        <StatusLine tone="neutral" still title="The oath follows the signatures">
          Sign the batch first; the link can go out now so it&apos;s ready.
        </StatusLine>
      ) : null}
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <Card variant="raised">
        <CardHeader>
          <CardTitle className="text-body font-semibold">Who takes the oath</CardTitle>
          <CardDescription>Once, for every case in {batch.number}. The court fee waits for it.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-muted text-body-compact font-semibold text-brand-muted-foreground" aria-hidden>
              {(rep?.name ?? "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-compact font-medium">{rep?.name ?? "The complainant's representative"}</span>
              <span className="text-body-compact text-muted-foreground">
                {[rep?.designation, batch.client].filter(Boolean).join(", ")}
                {rep?.mobile ? ` · link to •••••• ${rep.mobile.slice(-4)}` : ""}
              </span>
            </span>
            {status}
            {!oath.takenAt ? (
              <Button variant={oath.sentAt ? "outline" : "default"} disabled={busy} onClick={() => void act("oath-send")}>
                <SendIcon data-icon="inline-start" aria-hidden />
                {oath.sentAt ? "Send again" : "Send oath link"}
              </Button>
            ) : null}
            {/* Sandbox, the product's flask: be the representative, or skip the recording. */}
            <DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Sandbox: the oath" className="text-muted-foreground">
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
          {oath.sentAt && !oath.takenAt ? (
            <p className="mt-3 text-body-compact text-muted-foreground">Sent {time(oath.sentAt)}. This page updates when it&apos;s done.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card variant="raised">
        <CardHeader>
          <CardTitle className="text-body font-semibold">What they&apos;ll say</CardTitle>
          <CardDescription>A general statement for the whole batch, not about any one case.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <blockquote className="rounded-lg bg-surface-sunken px-4 py-3 text-body leading-7">
            {batchOathText(batch.client, batch.number, cases)}
          </blockquote>
          <div className="flex flex-col gap-2">
            <span className="text-body-compact font-medium">Recorded on their phone, through the link</span>
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
          continueHint={!oath.takenAt ? "Paying waits for the oath" : undefined}
          onContinue={() => go("pay")}
        />
      </BatchFooter>
    </div>
  );
}
