"use client";

/**
 * The page the complainant's representative opens from the oath link: which batch, the
 * words to say, how to be on camera, then the recording, made here (never uploaded, as in
 * individual filing, `OTH-1`). Sent, the filer's Oath step shows it taken.
 */

import * as React from "react";
import { CheckIcon, IdCardIcon, ScanFaceIcon, UserIcon, VideoIcon } from "lucide-react";

import { batchOathText } from "@/lib/bulk/oath";
import { BrandLockup } from "@/components/brand-lockup";
import { OathRecorderPanel } from "@/components/filing/oath-recorder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatusLine } from "@/components/feedback";

import { bulkFetch } from "./api";

type Oath = {
  batchNumber: string;
  client: string;
  cases: number;
  representative: { name: string; designation: string } | null;
  takenAt: string | null;
};

const ON_CAMERA = [
  { icon: ScanFaceIcon, text: "Keep your face clearly visible, in good light." },
  { icon: UserIcon, text: "Be the only person in the frame." },
  { icon: IdCardIcon, text: "Hold up your ID card to the camera as you begin." },
] as const;

export function OathLink({ batchId }: { batchId: string }) {
  const [oath, setOath] = React.useState<Oath | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    bulkFetch(`/api/bulk/batches/${encodeURIComponent(batchId)}/oath`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setOath(await r.json()) : setError("This link isn't valid any more.")))
      .catch(() => setError("This link couldn't be opened."));
  }, [batchId]);

  const send = async (file: File) => {
    setRecording(false);
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("by", oath?.representative?.name ?? "");
      const r = await bulkFetch(`/api/bulk/batches/${encodeURIComponent(batchId)}/oath`, { method: "POST", body: form });
      if (!r.ok) throw new Error("The recording couldn't be sent. Try again.");
      const { takenAt } = (await r.json()) as { takenAt: string };
      setOath((o) => (o ? { ...o, takenAt } : o));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center border-b border-hairline px-4 md:px-6">
        <BrandLockup className="h-9" />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 md:py-12">
        {!oath && !error ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-40" />
          </div>
        ) : null}
        {error ? <StatusLine tone="error" still>{error}</StatusLine> : null}
        {oath ? (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-title text-balance font-semibold">
                {oath.takenAt ? "Your oath is recorded" : "You have been asked to take an oath"}
              </h1>
              <p className="text-body text-pretty text-muted-foreground tabular-nums">
                {oath.representative ? `${oath.representative.name}, for ${oath.client}. ` : ""}
                Once, for all {oath.cases} complaints in batch {oath.batchNumber}.
              </p>
            </div>
            {oath.takenAt ? (
              <StatusLine tone="success" still title="Nothing more is needed from you">
                The advocate filing the batch can see it&apos;s done.
              </StatusLine>
            ) : (
              <Card variant="raised">
                <CardContent className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-body font-semibold">Say these words</h2>
                    <blockquote className="rounded-lg bg-surface-sunken px-4 py-3 text-body leading-7">
                      {batchOathText(oath.client, oath.batchNumber, oath.cases)}
                    </blockquote>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {ON_CAMERA.map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-center gap-2 text-body-compact">
                        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        {text}
                      </li>
                    ))}
                  </ul>
                  {recording ? (
                    <OathRecorderPanel
                      maxDurationSeconds={120}
                      onRecorded={(file) => void send(file)}
                      onCancel={() => setRecording(false)}
                      onError={(m) => {
                        setRecording(false);
                        setError(m);
                      }}
                    />
                  ) : (
                    <Button size="lg" className="self-start" disabled={sending} onClick={() => setRecording(true)}>
                      {sending ? <Spinner data-icon="inline-start" /> : <VideoIcon data-icon="inline-start" aria-hidden />}
                      {sending ? "Sending…" : "Record my oath"}
                    </Button>
                  )}
                  <p className="flex items-center gap-2 text-body-compact text-muted-foreground">
                    <CheckIcon className="size-4" aria-hidden />
                    Up to 2 minutes, recorded here. Nothing is uploaded from your phone&apos;s gallery.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
