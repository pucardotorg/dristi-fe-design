"use client";

/**
 * File — the documents the court asked for, one slot each with a real file picker (PDF
 * or images, stored in the browser), as an act-modal body. A signatory files with the
 * court (confirmed first) and the task waits on scrutiny; anyone else on the case fills
 * the slots and marks it ready. On an awaiting-court task the action region carries the
 * registry sandbox: accept, or return with defects — which creates the `returned` task.
 * Draft complaints and applications (`draft` kind) use this body too: finishing one is
 * filing it.
 */

import * as React from "react";
import { SaveIcon, SendIcon } from "lucide-react";

import { ChromeAlertDialogContent } from "@/components/chrome/app-chrome";

import { dueCueOf } from "@/lib/tasks/format";
import { TERMINAL } from "@/lib/tasks/permissions";
import { file, saveDraft } from "@/lib/tasks/transitions";
import type { StoredFileRef } from "@/lib/tasks/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import {
  type ActContext,
  closedTitle,
  CourtSandbox,
  FileChip,
  FileSlot,
  PrepareCard,
  PreparedNote,
  RailCard,
  RecordCard,
  signatoryLine,
} from "@/components/tasks/act/shared";
import { ConfirmMark, IrreversibleNote, StatusLine } from "@/components/feedback";

/** The slots, editable while the task is open to this person. */
function Documents({
  ctx,
  files,
  editable,
  onChange,
}: {
  ctx: ActContext;
  files: StoredFileRef[];
  editable: boolean;
  onChange: (files: StoredFileRef[]) => void;
}) {
  const { task, online } = ctx;
  const slots = task.documentsNeeded?.length ? task.documentsNeeded : ["Document"];
  const loose = files.filter((f) => !f.slot || !slots.includes(f.slot));
  const filled = slots.filter((s) => files.some((f) => f.slot === s)).length;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <h3 className="text-body font-semibold">Documents needed</h3>
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {filled} of {slots.length} attached
          {task.deadlineNote
            ? ` · ${task.deadlineNote}`
            : task.dueAt
              ? ` · ${dueCueOf(task).primary.toLowerCase()}`
              : ""}
        </p>
      </div>
      <ul className="divide-y divide-hairline">
        {slots.map((slot) => {
          const f = files.find((x) => x.slot === slot);
          return editable ? (
            <FileSlot
              key={slot}
              name={slot}
              file={f}
              disabled={!online}
              onFile={(ref) => onChange([...files.filter((x) => x.slot !== slot), ref])}
              onRemove={() => onChange(files.filter((x) => x !== f))}
            />
          ) : (
            <li key={slot} className="flex flex-col gap-2 py-3">
              <p className="text-body-compact font-medium">{slot}</p>
              {f ? <FileChip file={f} /> : <p className="text-caption text-muted-foreground">Not attached</p>}
            </li>
          );
        })}
        {loose.map((f) => (
          <li key={f.id} className="py-3">
            <FileChip file={f} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A signatory's rail: file with the court, or save what is attached for later. */
function FileCard({ ctx, files, complete }: { ctx: ActContext; files: StoredFileRef[]; complete: boolean }) {
  const { task, online, finish } = ctx;
  const { act, busy, error } = useTaskActions({ inDialog: true });
  const [confirm, setConfirm] = React.useState(false);
  const n = files.length;
  return (
    <RailCard title="File with the court" description={signatoryLine(ctx, "Filing")}>
      {error ? <StatusLine tone="error">{error}</StatusLine> : null}
      <PreparedNote ctx={ctx} />
      <div className="flex flex-col gap-2">
        <Button size="lg" disabled={!online || !!busy || !complete} onClick={() => setConfirm(true)}>
          <SendIcon data-icon="inline-start" aria-hidden />
          File with the court
        </Button>
        {!complete ? (
          <p className="text-caption text-muted-foreground">Attach every document before filing.</p>
        ) : null}
        <Button
          variant="ghost"
          disabled={!online || !!busy}
          onClick={() => void act(task.id, (t, c) => saveDraft(t, c, undefined, files), { title: "Saved as a draft", icon: SaveIcon })}
        >
          Save for later
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <ChromeAlertDialogContent>
          <AlertDialogHeader>
            <ConfirmMark icon={SendIcon} />
            <AlertDialogTitle>File with the court?</AlertDialogTitle>
            <AlertDialogDescription className="flex flex-col">
              <span>
                {n === 1 ? "1 document goes" : `${n} documents go`} to the registry for scrutiny. Defects come
                back as a new task.
              </span>
              <IrreversibleNote>This cannot be recalled.</IrreversibleNote>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirm(false);
                const t = await act(task.id, (x, c) => file(x, c, files));
                if (t) finish("Filed — awaiting scrutiny");
              }}
            >
              File
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>
    </RailCard>
  );
}

/** The file flow inside the act modal: the document slots, then the action. */
export function FileBody({ ctx }: { ctx: ActContext }) {
  const { task, signatory } = ctx;
  const [files, setFiles] = React.useState<StoredFileRef[]>(task.files ?? []);
  const slots = task.documentsNeeded?.length ? task.documentsNeeded : ["Document"];
  const complete = slots.every((s) => files.some((f) => f.slot === s));
  const closed = TERMINAL.has(task.status);
  const editable = ["open", "draft", "ready"].includes(task.status);

  let rail: React.ReactNode;
  if (closed) rail = <RecordCard ctx={ctx} title={closedTitle(task, "Accepted by the registry")} />;
  else if (task.status === "awaiting-court") rail = <CourtSandbox ctx={ctx} />;
  else if (signatory) rail = <FileCard ctx={ctx} files={files} complete={complete} />;
  else rail = <PrepareCard ctx={ctx} what="file" files={files} complete={complete} />;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Documents ctx={ctx} files={files} editable={editable} onChange={setFiles} />
      {rail}
    </div>
  );
}
