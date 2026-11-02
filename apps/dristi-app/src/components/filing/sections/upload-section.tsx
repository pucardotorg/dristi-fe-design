"use client";

/**
 * Case documents upload — the intake step that runs before the filing form.
 *
 * One card per cheque, per demand notice and per party, supporting documents at the end,
 * each holding DS
 * `DocumentSlot` rows. A file arrives by drop or by the picker; it is stored (IndexedDB)
 * and, for the document types we can read, run through document reading in the browser —
 * progress is the real read, and whatever it finds lands on the draft as machine-read
 * values the later steps show for review. Everything is written to `draft.intake`, so
 * add, remove and delete all persist.
 *
 * The screen keeps one progress statement (the block under the title). The footer only
 * says whether the step is ready, never the same count in a second voice.
 *
 * This route renders outside the sidebar shell, so it carries its own full-height column.
 */

import * as React from "react";
import {
  CreditCardIcon,
  FileTextIcon,
  MailIcon,
  PlusIcon,
  UserIcon,
} from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import {
  intakeChequeGroup,
  intakeNoticeGroup,
  intakeOtherPartyDoc,
  intakePartyGroup,
  removeCaseRecord,
  uniqueSlotKeys,
} from "@/lib/filing/blank";
import { getRepository, storeUpload } from "@/lib/filing/data";
import { forgetFile, getFileBlob, useFilePreview } from "@/lib/filing/files";
import {
  applyExtraction,
  clearExtraction,
  extractDocument,
  extractable,
} from "@/lib/filing/ocr";
import { findIntakeSlot } from "@/lib/filing/selectors";
import { FILINGS_HOME } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { cn } from "@/lib/utils";
import type { Intake, IntakeSlot } from "@/lib/filing/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { SectionNotice } from "@/components/filing/notices";
import { useInCorrection } from "@/components/filing/posture";
import { DocumentCard } from "@/components/filing/upload/document-card";
import { readOutcomeFor } from "@/components/filing/upload/read-status";
import { IntakeSlotRow } from "@/components/filing/upload/slot-row";
import {
  dragCarriesFiles,
  dropProblemMessage,
  useDropTarget,
  type DroppedFiles,
} from "@/components/filing/upload/use-drop-target";
import { pickErrorMessage, useFilePicker } from "@/components/filing/use-file-picker";

/* ───────────────────────────── Draft helpers ───────────────────────────── */

/** Every slot on the intake, in display order. */
function allSlots(intake: Intake): IntakeSlot[] {
  return [
    ...intake.cheques.flatMap((g) => g.slots),
    ...intake.notices.flatMap((g) => g.slots),
    ...intake.parties.flatMap((g) => g.slots),
    ...intake.supporting,
  ];
}

function takenKeys(intake: Intake): Set<string> {
  return new Set(allSlots(intake).map((s) => s.key));
}

/* ───────────────────────────── Preview dialog body ─────────────────────── */

function PreviewBody({ slot }: { slot: IntakeSlot }) {
  const preview = useFilePreview(slot.file);
  if (preview.status === "loading") return <Skeleton className="h-64 w-full rounded-lg" />;
  if (preview.status === "ready" && preview.imageUrl) {
    return (
      <div className="overflow-hidden rounded-lg bg-surface-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.imageUrl}
          alt={`Scan of ${slot.file?.name ?? slot.label}`}
          className="max-h-[60vh] w-full object-contain"
        />
      </div>
    );
  }
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg bg-surface-sunken text-muted-foreground">
      <FileTextIcon className="size-8" aria-hidden />
      <p className="text-body-compact">{slot.file?.name}</p>
      <p className="text-caption">
        {preview.status === "missing"
          ? "File not found in this browser"
          : "No preview for this file type"}
      </p>
    </div>
  );
}

/* ───────────────────────── What a removal will cost ────────────────────── */

type Pending =
  | { kind: "cheque"; index: number }
  | { kind: "notice"; index: number }
  | { kind: "party"; index: number }
  | { kind: "slot"; key: string };

/* ───────────────────────────────── Screen ──────────────────────────────── */

export function UploadSection() {
  const { draft, update, hrefFor } = useFiling();
  const intake = draft.intake;
  /* In a correction round the bundle itself is fixed: a flagged document is *replaced*,
     never removed, and nothing is added. Only the officer's flags open anything (D3). */
  const inCorrection = useInCorrection();
  const { pick, input } = useFilePicker();

  const [previewKey, setPreviewKey] = React.useState<string | null>(null);
  const [pickError, setPickError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Pending | null>(null);
  /** Read outcomes and additions, for screen readers. */
  const [announcement, setAnnouncement] = React.useState("");

  const announce = React.useCallback((message: string) => setAnnouncement(message), []);

  /** Reads in flight, by slot key — a delete or re-upload cancels the older one. */
  const runs = React.useRef<Record<string, number>>({});

  const patchSlot = React.useCallback(
    (key: string, patch: (slot: IntakeSlot) => void) =>
      update((d) => {
        const slot = findIntakeSlot(d.intake, key);
        if (slot) patch(slot);
      }),
    [update]
  );

  /** Store the chosen file on a slot, then read it (when the type is readable). */
  const receiveFile = React.useCallback(
    async (key: string, file: File) => {
      const slot = findIntakeSlot(intake, key);
      if (!slot) return;
      const previous = slot.file;
      const runId = (runs.current[key] ?? 0) + 1;
      runs.current[key] = runId;

      let ref;
      try {
        ref = await storeUpload(file);
      } catch {
        setPickError("We couldn't store that file in this browser. Please try again.");
        return;
      }
      if (runs.current[key] !== runId) return;

      const readable = extractable(slot.docType);
      update((d) => {
        const s = findIntakeSlot(d.intake, key);
        if (!s) return;
        clearExtraction(d, key);
        s.file = ref;
        s.extract = undefined;
        s.error = undefined;
        s.poor = false;
        s.processing = readable;
        s.progress = 0;
      });
      if (previous) {
        forgetFile(previous.id);
        void getRepository().deleteFile(previous.id);
      }
      if (!readable) return;

      try {
        const blob = (await getFileBlob(ref.id)) ?? file;
        const result = await extractDocument(blob, ref, slot.docType, (p) => {
          if (runs.current[key] !== runId) return;
          patchSlot(key, (s) => {
            s.progress = p.progress;
          });
        });
        if (runs.current[key] !== runId) return;
        update((d) => {
          const s = findIntakeSlot(d.intake, key);
          if (!s || s.file?.id !== ref.id) return;
          s.processing = false;
          s.progress = 100;
          s.extract = result.extract;
          s.poor = result.poor;
          applyExtraction(d, key);
        });
        /* Announced from the same mapping the row shows, so a read that filled seven
           fields is never announced as a failure just because confidence was low. */
        announce(
          `${slot.label}: ${
            readOutcomeFor({
              fields: Object.keys(result.extract.fields).length,
              poor: result.poor,
              readable: true,
            }).speech
          }`
        );
      } catch {
        if (runs.current[key] !== runId) return;
        const failure = "Couldn't read this file. You can still continue and type the details.";
        patchSlot(key, (s) => {
          s.processing = false;
          s.progress = 100;
          s.error = failure;
        });
        announce(
          `${slot.label}: ${readOutcomeFor({ error: failure, fields: 0, readable: true }).speech}`
        );
      }
    },
    [intake, update, patchSlot, announce]
  );

  /** Choose (or re-upload) a file for a slot. */
  const chooseFile = React.useCallback(
    (key: string) => {
      setPickError(null);
      pick((file, error) => {
        if (error) {
          setPickError(pickErrorMessage(error));
          return;
        }
        if (!file) return;
        const label = findIntakeSlot(intake, key)?.label ?? "this document";
        announce(`${file.name} added for ${label}.`);
        void receiveFile(key, file);
      });
    },
    [pick, intake, receiveFile, announce]
  );

  /** Dropped files fill `keys` in order — empty required slots first. */
  const dropIntoKeys = React.useCallback(
    (keys: string[], dropped: DroppedFiles) => {
      setPickError(null);
      const used = Math.min(dropped.files.length, keys.length);
      for (let i = 0; i < used; i += 1) void receiveFile(keys[i], dropped.files[i]);

      const problem = dropProblemMessage(dropped.rejected, dropped.files.length - used);
      if (problem) setPickError(problem);
      if (used > 0) {
        announce(
          used === 1
            ? `${dropped.files[0].name} added.`
            : `${used} files added to the next empty slots.`
        );
      } else if (problem) {
        announce("Nothing was added from that drop.");
      }
    },
    [receiveFile, announce]
  );

  /** Forget the blobs behind slots we just cleared. */
  function dropFiles(files: Array<IntakeSlot["file"]>) {
    for (const f of files) {
      if (!f) continue;
      forgetFile(f.id);
      void getRepository().deleteFile(f.id);
    }
  }

  const deleteFile = (key: string) => {
    runs.current[key] = (runs.current[key] ?? 0) + 1;
    if (previewKey === key) setPreviewKey(null);
    const slot = findIntakeSlot(intake, key);
    const ref = slot?.file ?? null;
    update((d) => {
      const s = findIntakeSlot(d.intake, key);
      if (!s) return;
      clearExtraction(d, key);
      s.file = null;
      s.extract = undefined;
      s.error = undefined;
      s.processing = false;
      s.progress = 0;
      s.poor = false;
    });
    dropFiles([ref]);
    announce(`Removed the file for ${slot?.label ?? "that document"}.`);
  };

  const addCheque = () =>
    update((d) => {
      const group = intakeChequeGroup(d.intake.cheques.length + 1);
      group.slots = uniqueSlotKeys(group.slots, takenKeys(d.intake));
      d.intake.cheques.push(group);
    });

  const removeCheque = (index: number) => {
    const group = intake.cheques[index];
    if (!group) return;
    for (const slot of group.slots) runs.current[slot.key] = (runs.current[slot.key] ?? 0) + 1;
    update((d) => {
      for (const slot of d.intake.cheques[index]?.slots ?? []) clearExtraction(d, slot.key);
      // The form's cheque goes with its card, so the two stay the same in number.
      removeCaseRecord(d, "cheque", index);
    });
    dropFiles(group.slots.map((s) => s.file));
    announce(`Cheque ${group.n} removed.`);
  };

  const addNotice = () =>
    update((d) => {
      const group = intakeNoticeGroup(d.intake.notices.length + 1);
      group.slots = uniqueSlotKeys(group.slots, takenKeys(d.intake));
      d.intake.notices.push(group);
    });

  const removeNotice = (index: number) => {
    const group = intake.notices[index];
    if (!group) return;
    for (const slot of group.slots) runs.current[slot.key] = (runs.current[slot.key] ?? 0) + 1;
    update((d) => {
      for (const slot of d.intake.notices[index]?.slots ?? []) clearExtraction(d, slot.key);
      // The form's notice goes with its card, so the two stay the same in number.
      removeCaseRecord(d, "notice", index);
    });
    dropFiles(group.slots.map((s) => s.file));
    announce(`Demand notice ${group.n} removed.`);
  };

  const addParty = () =>
    update((d) => {
      const group = intakePartyGroup(d.intake.parties.length + 1);
      group.slots = uniqueSlotKeys(group.slots, takenKeys(d.intake));
      d.intake.parties.push(group);
    });

  const removeParty = (index: number) => {
    const group = intake.parties[index];
    if (!group) return;
    for (const slot of group.slots) runs.current[slot.key] = (runs.current[slot.key] ?? 0) + 1;
    update((d) => {
      for (const slot of d.intake.parties[index]?.slots ?? []) clearExtraction(d, slot.key);
      d.intake.parties.splice(index, 1);
      d.intake.parties.forEach((p, i) => {
        p.n = i + 1;
      });
    });
    dropFiles(group.slots.map((s) => s.file));
    announce(`Party ${group.n} removed.`);
  };

  const addPartyDoc = (index: number) =>
    update((d) => {
      const party = d.intake.parties[index];
      if (!party) return;
      const [doc] = uniqueSlotKeys(
        [intakeOtherPartyDoc(party.n, party.slots.length + 1)],
        takenKeys(d.intake)
      );
      party.slots.push(doc);
    });

  /* Supporting documents are a panel of their own, so they get their own drop target. */
  const supportingKeys = intake.supporting
    .filter((s) => !s.file && !s.processing)
    .map((s) => s.key);
  const supporting = useDropTarget({
    onFiles: (dropped) => dropIntoKeys(supportingKeys, dropped),
  });

  const previewSlot = previewKey ? findIntakeSlot(intake, previewKey) : undefined;
  const previewFile = previewSlot?.file ?? null;

  /*
   * What the confirm dialog says. Only the copy is derived during render — the action
   * itself is resolved from `pending` when the person confirms, so no handler (and no
   * ref those handlers read) is captured in a render-time closure.
   */
  const confirmCopy = React.useMemo(() => {
    if (!pending) return null;
    if (pending.kind === "slot") {
      const slot = findIntakeSlot(intake, pending.key);
      return {
        title: `Remove ${slot?.label ?? "this document"}?`,
        description:
          "The file is deleted from this browser, and anything it filled in your form is cleared. You can add it again later.",
      };
    }
    const group =
      pending.kind === "cheque"
        ? intake.cheques[pending.index]
        : pending.kind === "notice"
          ? intake.notices[pending.index]
          : intake.parties[pending.index];
    const name =
      pending.kind === "cheque"
        ? `cheque ${group?.n}`
        : pending.kind === "notice"
          ? `demand notice ${group?.n}`
          : `party ${group?.n}`;
    const files = group?.slots.filter((s) => s.file).length ?? 0;
    return {
      title: `Remove ${name}?`,
      description:
        files > 0
          ? `This deletes the ${files} document${files === 1 ? "" : "s"} added for it, and clears anything they filled in your form.`
          : "This removes it, and its document slots, from this filing.",
    };
  }, [pending, intake]);

  const runPending = () => {
    if (!pending) return;
    if (pending.kind === "slot") deleteFile(pending.key);
    else if (pending.kind === "cheque") removeCheque(pending.index);
    else if (pending.kind === "notice") removeNotice(pending.index);
    else removeParty(pending.index);
    setPending(null);
  };

  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-1 flex-col"
      /* A file dropped between the cards would otherwise be opened by the browser,
         throwing away the draft. Swallow those drops. */
      onDragOver={(e) => {
        if (dragCarriesFiles(e.dataTransfer)) e.preventDefault();
      }}
      onDrop={(e) => {
        if (dragCarriesFiles(e.dataTransfer)) e.preventDefault();
      }}
    >
      {input}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <FilingMain width="narrow">
        {/* In a correction round this section is a record of the filed documents, not an
            intake — so the invitation and the drag hint stand down (v3.2 sanity pass). */}
        {/* Header and hint are one block: the hint is a footnote to the invitation
            above it, not a section of its own. */}
        <div className="flex flex-col gap-2">
        <FilingPageHeader
          eyebrow="Documents"
          title={inCorrection ? "Case documents" : "Add your case documents"}
          description={
            inCorrection
              ? "The documents filed with the complaint, as scrutiny received them."
              : "Add the papers you already have: the cheque, the bank's memo, the demand notice. We read them and fill in the form for you, so it is worth doing now. You can also continue without them and add them later."
          }
        />

        {/*
         * Nothing on this screen counts documents any more.
         *
         * A progress bar reading "0 of 7 required documents added · 7 to go" said the
         * step was a checklist that had to be cleared, and the footer repeated it as a
         * warning. Neither was true: every one of these can be added later, and the
         * screen's own Continue never blocked on them. What is left is the affordance
         * people actually miss — that a file can be dropped straight onto a card.
         */}
        {inCorrection ? null : (
          <p className="text-body-compact text-muted-foreground pointer-coarse:hidden">
            Drag files onto a card or a row, or choose them one at a time.
          </p>
        )}
        </div>

        {pickError ? (
          <SectionNotice
            variant="destructive"
            announce="assertive"
            title="That file wasn’t added"
            onDismiss={() => setPickError(null)}
          >
            {pickError}
          </SectionNotice>
        ) : null}

        <div className="flex flex-col gap-8">
          {/* ── The cheques ── */}
          {intake.cheques.length > 0 ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-caption font-semibold text-muted-foreground">The cheques</h2>

              {intake.cheques.map((cheque, index) => (
                <DocumentCard
                  key={cheque.slots[0]?.key ?? `cheque-${index}`}
                  icon={CreditCardIcon}
                  title={`Cheque ${cheque.n}`}
                  slots={cheque.slots}
                  onRemove={
                    intake.cheques.length > 1 && !inCorrection
                      ? () => setPending({ kind: "cheque", index })
                      : undefined
                  }
                  removeLabel={`Remove cheque ${cheque.n}`}
                  onChoose={chooseFile}
                  onPreview={setPreviewKey}
                  onDelete={(key) => setPending({ kind: "slot", key })}
                  onDropFiles={dropIntoKeys}
                />
              ))}

              {inCorrection ? null : (
                <Button type="button" variant="outline" className="w-fit" onClick={addCheque}>
                  <PlusIcon data-icon="inline-start" aria-hidden />
                  Add another cheque
                </Button>
              )}
            </section>
          ) : null}

          {/* ── The demand notices — counted apart from the cheques: one notice often
              covers several cheques (`DCM-3`…`DCM-6`). ── */}
          {intake.notices.length > 0 ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-caption font-semibold text-muted-foreground">
                The demand notices
              </h2>

              {intake.notices.map((notice, index) => (
                <DocumentCard
                  key={notice.slots[0]?.key ?? `notice-${index}`}
                  icon={MailIcon}
                  title={`Demand notice ${notice.n}`}
                  slots={notice.slots}
                  onRemove={
                    intake.notices.length > 1 && !inCorrection
                      ? () => setPending({ kind: "notice", index })
                      : undefined
                  }
                  removeLabel={`Remove demand notice ${notice.n}`}
                  onChoose={chooseFile}
                  onPreview={setPreviewKey}
                  onDelete={(key) => setPending({ kind: "slot", key })}
                  onDropFiles={dropIntoKeys}
                />
              ))}

              {inCorrection ? null : (
                <Button type="button" variant="outline" className="w-fit" onClick={addNotice}>
                  <PlusIcon data-icon="inline-start" aria-hidden />
                  Add another demand notice
                </Button>
              )}
            </section>
          ) : null}

          {/* ── The parties ── */}
          {intake.parties.length > 0 ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-caption font-semibold text-muted-foreground">The parties</h2>

              {intake.parties.map((party, index) => (
                <DocumentCard
                  key={party.slots[0]?.key ?? `party-${index}`}
                  icon={UserIcon}
                  title={`Party ${party.n} details`}
                  slots={party.slots}
                  onRemove={
                    intake.parties.length > 1 && !inCorrection
                      ? () => setPending({ kind: "party", index })
                      : undefined
                  }
                  removeLabel={`Remove party ${party.n}`}
                  onChoose={chooseFile}
                  onPreview={setPreviewKey}
                  onDelete={(key) => setPending({ kind: "slot", key })}
                  onDropFiles={dropIntoKeys}
                  optionalFooter={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-fit"
                      onClick={() => addPartyDoc(index)}
                    >
                      <PlusIcon data-icon="inline-start" aria-hidden />
                      Add other documents
                    </Button>
                  }
                />
              ))}

              {inCorrection ? null : (
                <Button type="button" variant="outline" className="w-fit" onClick={addParty}>
                  <PlusIcon data-icon="inline-start" aria-hidden />
                  Add another party
                </Button>
              )}
            </section>
          ) : null}

          {/* ── Supporting ── */}
          {intake.supporting.length > 0 ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-caption font-semibold text-muted-foreground">
                Supporting documents
              </h2>

              <Card
                variant="raised"
                {...supporting.dropProps}
                className={cn(
                  "transition-shadow",
                  supporting.isOver && "ring-3 ring-focus-ring"
                )}
              >
                <CardContent className="flex flex-col gap-4">
                  {intake.supporting.map((slot) => (
                    <IntakeSlotRow
                      key={slot.key}
                      slot={slot}
                      onChoose={() => chooseFile(slot.key)}
                      onPreview={() => setPreviewKey(slot.key)}
                      onDelete={() => setPending({ kind: "slot", key: slot.key })}
                      onFiles={(dropped) =>
                        dropIntoKeys(
                          [slot.key, ...supportingKeys.filter((k) => k !== slot.key)],
                          dropped
                        )
                      }
                    />
                  ))}
                </CardContent>
              </Card>
            </section>
          ) : null}
        </div>
      </FilingMain>

      {/* Back names where it goes: this is the one step whose Back leaves the filing. */}
      <FilingFooter
        backHref={FILINGS_HOME}
        backLabel="Back to dashboard"
        continueHref={hrefFor("complainant")}
        continueLabel="Continue to filing"
      />

      {/* Document preview */}
      <Dialog
        open={!!previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewKey(null);
        }}
      >
        <ChromeDialogContent mobileSheet className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
              <Badge variant="secondary">{previewFile?.ext}</Badge>
              <span className="min-w-0 break-all">{previewFile?.name}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Preview of the file added for {previewSlot?.label}.
            </DialogDescription>
          </DialogHeader>

          {previewSlot ? <PreviewBody slot={previewSlot} /> : null}

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (previewKey) chooseFile(previewKey);
              }}
            >
              Replace file
            </Button>
            <Button type="button" onClick={() => setPreviewKey(null)}>
              Done
            </Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      {/* Removals delete stored files and their machine-read values — always ask first. */}
      <ConfirmDialog
        open={!!confirmCopy}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={confirmCopy?.title ?? ""}
        description={confirmCopy?.description}
        onConfirm={runPending}
      />
    </div>
  );
}
