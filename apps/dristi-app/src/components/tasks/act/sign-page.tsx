"use client";

/**
 * Sign — the document preview above the signing well, as an act-modal body. A signatory
 * e-signs with an Aadhaar OTP (sandbox: any 6 digits) and the task closes by event with
 * the stamp on the preview; if someone else prepared it, their note and upload sit above
 * the button. Anyone else on the case prepares (a note, an optional upload of the
 * draft) and marks it ready.
 */

import * as React from "react";
import { SignatureIcon } from "lucide-react";

import { TERMINAL } from "@/lib/tasks/permissions";
import { sign } from "@/lib/tasks/transitions";
import type { StoredFileRef } from "@/lib/tasks/types";
import { Button } from "@/components/ui/button";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { CourtDocument } from "@/components/tasks/act/court-document";
import {
  type ActContext,
  closedTitle,
  FileSlot,
  OtpDialog,
  PrepareCard,
  PreparedNote,
  RailCard,
  RecordCard,
  signatoryLine,
} from "@/components/tasks/act/shared";
import { StatusLine } from "@/components/feedback";

/** The signatory's own signing well. */
function SignCard({ ctx }: { ctx: ActContext }) {
  const { task, user, online, finish } = ctx;
  const { act, busy, error } = useTaskActions({ inDialog: true });
  const [otpOpen, setOtpOpen] = React.useState(false);
  return (
    <RailCard title="Add your signature" description={signatoryLine(ctx, "Signing")}>
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      <PreparedNote ctx={ctx} />
      <Button size="lg" disabled={!online || !!busy} onClick={() => setOtpOpen(true)}>
        <SignatureIcon data-icon="inline-start" aria-hidden />
        E-Sign with Aadhaar OTP
      </Button>
      <p className="text-caption text-muted-foreground">
        The signed document is attached to the task and the case file.
      </p>
      <OtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        signer={user}
        onSign={async () => {
          setOtpOpen(false);
          const t = await act(task.id, sign);
          if (t) finish(`Signed — ${t.completion?.receipt ?? ""}`);
        }}
      />
    </RailCard>
  );
}

/** Preparation by someone who cannot sign: a note, and an optional upload of the draft. */
function PrepareSign({ ctx }: { ctx: ActContext }) {
  const { task, online } = ctx;
  const [files, setFiles] = React.useState<StoredFileRef[]>(task.files ?? []);
  const draft = files.find((f) => f.slot === "Draft for signature");
  return (
    <PrepareCard ctx={ctx} what="sign" files={files}>
      <ul className="divide-y divide-hairline">
        <FileSlot
          name="Draft for signature"
          file={draft}
          disabled={!online}
          optional
          onFile={(ref) => setFiles((prev) => [...prev.filter((f) => f.slot !== ref.slot), ref])}
          onRemove={() => setFiles((prev) => prev.filter((f) => f !== draft))}
        />
      </ul>
    </PrepareCard>
  );
}

/** The sign flow inside the act modal: the document to be signed, then the action. */
export function SignBody({ ctx }: { ctx: ActContext }) {
  const { task, kase, people, signatory } = ctx;
  let rail: React.ReactNode;
  if (TERMINAL.has(task.status)) rail = <RecordCard ctx={ctx} title={closedTitle(task, "Signed")} />;
  else if (signatory) rail = <SignCard ctx={ctx} />;
  else rail = <PrepareSign ctx={ctx} />;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Inside the modal the document is framed, not lifted — no shadow in a shadow. */}
      <CourtDocument task={task} kase={kase} people={people} className="border-border shadow-none" />
      {rail}
    </div>
  );
}
