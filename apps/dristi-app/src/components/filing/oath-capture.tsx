"use client";

/**
 * **The advocate's oath, taken during signing.**
 *
 * It used to be a step of its own in the filing, one card per complainant. Advocates take
 * it now, straight after their e-signature, in whichever window they signed in — the
 * filer's own signing window, or the one a co-advocate reaches from their link. This is
 * the one body both use, so the instructions, the wording and the limits cannot differ
 * between the two.
 *
 * What it asks for, in order: how to be on camera (the court has to see who is swearing,
 * and that it is them), the words to say, and then a recording — made here with the
 * camera, or an existing file. Either way the clip goes through the same store-and-assign
 * path, so a recorded oath and an uploaded one leave identical state.
 *
 * Duration is the limit, read from the file's own metadata; a file whose duration cannot
 * be read falls back to a size cap, since the duration cannot be enforced without it.
 */

import * as React from "react";
import {
  IdCardIcon,
  RefreshCwIcon,
  ScanFaceIcon,
  UploadIcon,
  UserIcon,
  VideoIcon,
} from "lucide-react";

import { getRepository, storeUpload } from "@/lib/filing/data";
import {
  forgetFile,
  formatBytes,
  formatDuration,
  getFileUrl,
  readVideoDuration,
} from "@/lib/filing/files";
import type { OathVideoUpload, StoredFileRef } from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionNotice } from "@/components/filing/notices";
import { OathRecorderPanel } from "@/components/filing/oath-recorder";
import { ChoiceCard } from "@/components/filing/sign-stages";

/**
 * The words read on camera, in the name of whoever is taking the oath (owner,
 * 2026-10-09). Both forms are offered — an oath in the name of God, or a solemn
 * affirmation (Oaths Act, 1969) — and the person reads the one that is theirs.
 */
export function oathText(name: string): string {
  return (
    `I, ${name.trim() || "[your name]"}, do swear in the name of God / do solemnly affirm ` +
    "that the contents in the pleadings / application are true to my knowledge and " +
    "belief, and the relevant supporting documents are genuine and authentic. I am aware " +
    "that furnishing false or incorrect information is a punishable offence."
  );
}

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ACCEPT_ATTR = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

/** Enforced when duration can be read; the recorder stops itself here too. */
export const OATH_MAX_SECONDS = 120;
/** Fallback only — used when the browser cannot read the file's duration at all. */
const MAX_FALLBACK_BYTES = 200 * 1024 * 1024;

/** How to be on camera — what the court needs to see in the recording. */
const ON_CAMERA = [
  { icon: ScanFaceIcon, text: "Keep your face clearly visible, in good light." },
  { icon: UserIcon, text: "Be the only person in the frame." },
  { icon: IdCardIcon, text: "Hold up your ID card to the camera as you begin." },
] as const;

type PickOutcome =
  | { ok: true; file: File; durationSeconds: number | null }
  | { ok: false; message: string };

async function validate(file: File): Promise<PickOutcome> {
  const okType =
    ACCEPTED_VIDEO_TYPES.includes(file.type) || /\.(mp4|webm|mov)$/i.test(file.name);
  if (!okType) {
    return { ok: false, message: "Please choose an MP4, WebM or MOV video." };
  }

  const durationSeconds = await readVideoDuration(file);
  if (durationSeconds !== null) {
    if (durationSeconds > OATH_MAX_SECONDS) {
      return {
        ok: false,
        message: `That recording is longer than ${formatDuration(OATH_MAX_SECONDS)}. Please trim it and try again.`,
      };
    }
    return { ok: true, file, durationSeconds };
  }

  if (file.size > MAX_FALLBACK_BYTES) {
    return { ok: false, message: "That file is larger than 200 MB. Please choose a smaller recording." };
  }
  return { ok: true, file, durationSeconds: null };
}

function OathVideoPlayer({ file }: { file: StoredFileRef }) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getFileUrl(file.id).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [file.id]);

  if (!url) return <Skeleton className="aspect-video w-full rounded-lg" />;
  return (
    <video
      src={url}
      controls
      aria-label="Your recorded oath"
      className="aspect-video w-full rounded-lg bg-surface-sunken object-contain"
    />
  );
}

export function OathCapture({
  name,
  value,
  onChange,
}: {
  /** Who is taking the oath — their name is in the words they read. */
  name: string;
  /** The oath already on file for this advocate, if any. */
  value: OathVideoUpload | null;
  /** A new clip has been stored. The previous one is released here, not by the caller. */
  onChange: (next: OathVideoUpload) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /** The one path a picked file and a recorded clip both end in. */
  const commit = async (file: File, durationSeconds: number | null) => {
    setBusy(true);
    let ref: StoredFileRef;
    try {
      ref = await storeUpload(file);
    } catch {
      setError("We couldn't store that video in this browser. Please try again.");
      setBusy(false);
      return;
    }
    const previous = value;
    onChange({ file: ref, durationSeconds });
    if (previous) {
      forgetFile(previous.file.id);
      void getRepository().deleteFile(previous.file.id);
    }
    setBusy(false);
  };

  const pick = () => {
    setError(null);
    const el = inputRef.current;
    if (!el) return;
    el.value = "";
    el.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setBusy(true);
    const outcome = await validate(file);
    if (!outcome.ok) {
      setError(outcome.message);
      setBusy(false);
      return;
    }
    await commit(outcome.file, outcome.durationSeconds);
  };

  const record = () => {
    setError(null);
    setRecording(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onFileChosen}
      />

      <section
        aria-labelledby="oath-on-camera"
        className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-4"
      >
        <h3 id="oath-on-camera" className="text-body font-semibold">
          Before you record
        </h3>
        <ul className="flex flex-col gap-2">
          {ON_CAMERA.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-body-compact">
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {text}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="oath-words" className="flex flex-col gap-3">
        <h3 id="oath-words" className="text-body font-semibold">
          Say these words
        </h3>
        <blockquote className="rounded-lg border border-hairline bg-surface-sunken p-4 text-body text-foreground">
          {oathText(name)}
        </blockquote>
      </section>

      {error ? (
        <SectionNotice variant="warning" announce="polite">
          {error}
        </SectionNotice>
      ) : null}

      {value ? (
        <section aria-labelledby="oath-recorded" className="flex flex-col gap-3">
          <h3 id="oath-recorded" className="text-body font-semibold">
            Your oath
          </h3>
          <OathVideoPlayer file={value.file} />
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted-foreground">
            <span className="min-w-0 truncate">{value.file.name}</span>
            <span className="tabular-nums">{formatBytes(value.file.size)}</span>
            {value.durationSeconds !== null ? (
              <span className="tabular-nums">{formatDuration(value.durationSeconds)}</span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={record} disabled={busy}>
              <RefreshCwIcon data-icon="inline-start" aria-hidden />
              Record again
            </Button>
            <Button type="button" variant="ghost" onClick={pick} disabled={busy}>
              <UploadIcon data-icon="inline-start" aria-hidden />
              Upload a different video
            </Button>
          </div>
          {recording ? (
            <OathRecorderPanel
              maxDurationSeconds={OATH_MAX_SECONDS}
              onRecorded={(file, durationSeconds) => {
                setRecording(false);
                void commit(file, durationSeconds);
              }}
              onCancel={() => setRecording(false)}
              onError={(message) => {
                setRecording(false);
                setError(message);
              }}
            />
          ) : null}
        </section>
      ) : recording ? (
        <OathRecorderPanel
          maxDurationSeconds={OATH_MAX_SECONDS}
          onRecorded={(file, durationSeconds) => {
            setRecording(false);
            void commit(file, durationSeconds);
          }}
          onCancel={() => setRecording(false)}
          onError={(message) => {
            setRecording(false);
            setError(message);
          }}
        />
      ) : (
        <section aria-labelledby="oath-how" className="flex flex-col gap-3">
          <h3 id="oath-how" className="text-body font-semibold">
            Record your oath
          </h3>
          <ChoiceCard
            title="Record with your camera"
            tone="bg-brand-muted text-brand-muted-foreground"
            icon={<VideoIcon className="size-5" />}
            onClick={record}
          >
            Opens your camera here. Recording stops at {formatDuration(OATH_MAX_SECONDS)}.
          </ChoiceCard>
          <ChoiceCard
            title="Upload a video"
            tone="bg-info-muted text-info-muted-foreground"
            icon={<UploadIcon className="size-5" />}
            onClick={pick}
          >
            Up to {formatDuration(OATH_MAX_SECONDS)}, in MP4, WebM or MOV.
          </ChoiceCard>
          {busy ? (
            <p role="status" className="text-body-compact text-muted-foreground">
              Saving your video&hellip;
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
