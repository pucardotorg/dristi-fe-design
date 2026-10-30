"use client";

/**
 * **A complainant's oath, recorded during signing** (e-filing handover §18.2, `OTH`).
 *
 * The oath is not a section of the filing form. It is taken by whoever signs for a
 * complainant — the complainant, their PoA holder, or an Institution's authorised
 * representative (`OTH-3`) — straight after their e-signature, or with their phone
 * confirmation when the complaint was signed on paper. Advocates and clerks never take it.
 * This is the one body every place that asks for it uses, so the instructions, the wording
 * and the limit cannot differ between them.
 *
 * What it asks for, in order: how to be on camera (the court has to see who is swearing,
 * and that it is them), the words to say, and then a recording made here with the camera.
 * There is no file upload: the oath is recorded, never uploaded (`OTH-1`). Recording stops
 * at 2 minutes.
 */

import * as React from "react";
import {
  IdCardIcon,
  RefreshCwIcon,
  ScanFaceIcon,
  UserIcon,
  VideoIcon,
} from "lucide-react";

import { getRepository, storeUpload } from "@/lib/filing/data";
import { forgetFile, formatDuration, getFileUrl } from "@/lib/filing/files";
import type { OathVideo, StoredFileRef } from "@/lib/filing/types";
import { LANGUAGE_NAME } from "@/lib/locale-config";
import type { Locale } from "@/lib/onboarding/content";
import { useCourt } from "@/components/court/court-provider";
import { useLocale } from "@/components/shell/locale";
import { Button } from "@/components/ui/button";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionNotice } from "@/components/filing/notices";
import { OathRecorderPanel } from "@/components/filing/oath-recorder";
import { ChoiceCard } from "@/components/filing/sign-stages";

/**
 * The words read on camera. The handover's placeholder affirmation (§18.2): the exact
 * court-prescribed wording, and whether an oath/affirmation choice is needed, are still
 * to be confirmed (`[GAP]`).
 */
export const OATH_TEXT =
  "I solemnly affirm that the contents of this complaint, and everything I have stated " +
  "in support of it, are true to the best of my knowledge and belief, and that I have " +
  "not concealed anything material to this case.";

/**
 * The oath's words in each language a state offers (`oathLanguages` on its court profile).
 * Only the court can supply a translation of an oath, so a language without its words
 * here is offered but awaited: the switch shows it, and recording waits for its text.
 * Gujarati is awaited from the Gujarat High Court (feedback #40).
 */
export const OATH_WORDS: Partial<Record<Locale, string>> = { en: OATH_TEXT };

/** Languages as English sentences name them; the switch names each in its own script. */
const IN_ENGLISH: Record<Locale, string> = {
  en: "English",
  gu: "Gujarati",
  hi: "Hindi",
  pa: "Punjabi",
  ml: "Malayalam",
};

/** The recorder stops itself here (`OTH-1`). */
export const OATH_MAX_SECONDS = 120;

/** How to be on camera — what the court needs to see in the recording. */
const ON_CAMERA = [
  { icon: ScanFaceIcon, text: "Keep your face clearly visible, in good light." },
  { icon: UserIcon, text: "Be the only person in the frame." },
  { icon: IdCardIcon, text: "Hold up your ID card to the camera as you begin." },
] as const;

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
  forWhom,
  value,
  onChange,
}: {
  /** Who is recording — said back to them so they know whose oath this is. */
  name: string;
  /** The complainant the oath is for, when that is someone else (a PoA holder's principal). */
  forWhom?: string;
  /** The oath already recorded for this complainant, if any. */
  value: OathVideo | null;
  /** A new clip has been stored. The previous one is released here, not by the caller. */
  onChange: (next: OathVideo) => void;
}) {
  const [recording, setRecording] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The words can be read in another language than the page; the switch starts on the
  // language already sworn in, else the site's, else English.
  const { profile } = useCourt();
  const { locale } = useLocale();
  const languages = profile.oathLanguages;
  const [language, setLanguage] = React.useState<Locale>(() =>
    [value?.language, locale].find((l): l is Locale => !!l && languages.includes(l)) ??
    languages[0]
  );
  const words = OATH_WORDS[language];

  const commit = async (file: File, durationSeconds: number) => {
    setBusy(true);
    let ref: StoredFileRef;
    try {
      ref = await storeUpload(file);
    } catch {
      setError("We couldn't save the recording in this browser. Please record it again.");
      setBusy(false);
      return;
    }
    const previous = value;
    onChange({ file: ref, durationSeconds, language });
    if (previous) {
      forgetFile(previous.file.id);
      void getRepository().deleteFile(previous.file.id);
    }
    setBusy(false);
  };

  const record = () => {
    setError(null);
    setRecording(true);
  };

  const recorder = (
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
  );

  return (
    <div className="flex flex-col gap-6">
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="oath-words" className="text-body font-semibold">
            Say these words
          </h3>
          {languages.length > 1 ? (
            // Locked while recording, so the words cannot change mid-oath.
            <SegmentedControl
              type="single"
              value={language}
              onValueChange={(next) => next && setLanguage(next as Locale)}
              disabled={recording || busy}
              aria-label="Language of the oath"
            >
              {languages.map((l) => (
                <SegmentedControlItem key={l} value={l} lang={l}>
                  {LANGUAGE_NAME[l]}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          ) : null}
        </div>
        {name.trim() ? (
          <p className="text-body-compact text-muted-foreground">
            Recording as <span className="font-medium text-foreground">{name.trim()}</span>
            {forWhom ? `, for ${forWhom}` : ""}
            {/* "Nasreen K." already ends the sentence. */}
            {(forWhom ?? name.trim()).endsWith(".") ? "" : "."}
          </p>
        ) : null}
        {words ? (
          <blockquote
            lang={language}
            className="rounded-lg border border-hairline bg-surface-sunken p-4 text-body text-foreground"
          >
            {words}
          </blockquote>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-body-compact text-muted-foreground">
            The court has not provided the {IN_ENGLISH[language]} wording yet. Choose{" "}
            {IN_ENGLISH[languages[0]]} to record now.
          </p>
        )}
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
          {value.durationSeconds !== null || languages.length > 1 ? (
            <p className="text-caption text-muted-foreground tabular-nums">
              {[
                value.durationSeconds !== null ? formatDuration(value.durationSeconds) : null,
                languages.length > 1
                  ? `Sworn in ${IN_ENGLISH[value.language ?? "en"]}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {recording ? (
            recorder
          ) : !words ? null : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={record} disabled={busy}>
                <RefreshCwIcon data-icon="inline-start" aria-hidden />
                Record again
              </Button>
            </div>
          )}
        </section>
      ) : recording ? (
        recorder
      ) : !words ? null : (
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
          {busy ? (
            <p role="status" className="text-body-compact text-muted-foreground">
              Saving your recording&hellip;
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
