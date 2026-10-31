"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  HourglassIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import {
  DepositionShortcutsPanel,
  useDepositionSuggestion,
} from "@/components/employee/deposition-shortcuts-panel";
import {
  RichTextField,
  RichTextValueView,
  type RichTextValue,
} from "@/components/cases/rich-text-field";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { FormRow } from "@/components/filing/form-card";
import { FormField, RequiredMark } from "@/components/filing/form-field";
import { PrefixInput, TextField } from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import { AddressFields } from "@/components/filing/address-fields";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { isValidEmail, normalizeMobileNumber } from "@/lib/cases/witnesses";
import type { CasePerson } from "@/lib/employee/case-people";
import {
  accusedOf,
  addWitness,
  blanksIn,
  complainantsOf,
  deponentsFor,
  discardEvidence,
  evidenceAtHearing,
  evidenceLabel,
  evidenceStatusLabel,
  firstStatementTypeFor,
  kindForStatementType,
  newEvidenceRecord,
  readAddedWitnesses,
  readEvidence,
  saveEvidence,
  serverAddedWitnesses,
  serverEvidence,
  sideOfMark,
  STATEMENT_TYPES,
  statementTypeLabel,
  statementTypeOf,
  subscribeToAddedWitnesses,
  subscribeToEvidence,
  updateEvidence,
  witnessNumberOf,
  type Deponent,
  type EvidenceRecord,
  type StatementType,
  type WitnessSide,
} from "@/lib/employee/hearing-evidence";
import { formatOrderDate, type CourtHearingPurposeId } from "@/lib/employee/hearings";
import { blankAddressBlock } from "@/lib/filing/blank";
import type { Address } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";

/** Where the view sits: the hearing its records belong to, and the case's people. */
export type EvidenceContext = {
  caseNumber: string;
  hearingId: string;
  /** "Sunil Varghese v. Anand Traders". */
  matter: string;
  purpose?: CourtHearingPurposeId;
  people: readonly CasePerson[];
  /** The court's day (ISO), which the sheet is dated by. */
  today: string;
};

export function useHearingEvidence(hearingId: string): EvidenceRecord[] {
  const all = React.useSyncExternalStore(
    subscribeToEvidence,
    readEvidence,
    serverEvidence,
  );
  return evidenceAtHearing(all, hearingId);
}

/** Who a deposition here can be of: the complainant, the listed witnesses, those added. */
function useDeponents(context: EvidenceContext): Deponent[] {
  const all = React.useSyncExternalStore(
    subscribeToEvidence,
    readEvidence,
    serverEvidence,
  );
  const added = React.useSyncExternalStore(
    subscribeToAddedWitnesses,
    readAddedWitnesses,
    serverAddedWitnesses,
  );
  return deponentsFor(context.caseNumber, context.people, added, all);
}

/** Not a person: the picker's last line, which opens the Add a witness form. */
const ADD_WITNESS = "add-witness";

/** The witness picker's headings, in the order a clerk looks: the complainant is
 *  almost always the first to depose. A party on the witness list is a witness. */
const DEPONENT_GROUPS: readonly { label: string; sources: readonly Deponent["source"][] }[] = [
  { label: "Complainant", sources: ["complainant"] },
  { label: "Witnesses", sources: ["listed", "added"] },
  { label: "Accused", sources: ["accused"] },
];

function statusVariant(record: EvidenceRecord): "success" | "warning" | "info" {
  if (record.status === "signed") return "success";
  return record.status === "awaiting-signature" ? "info" : "warning";
}

/**
 * Starts a draft statement at this hearing, of the type its purpose suggests, and returns
 * its id. Opening Recorded statements with nothing recorded calls it, so the clerk lands
 * on the form, not an empty state (owner, 2026-10-28).
 */
export function startEvidenceRecord(
  context: EvidenceContext,
  type: StatementType = firstStatementTypeFor(context.purpose),
): string {
  const record = newEvidenceRecord(type, context);
  /* With one matching person, fill them in. Witness depositions always leave a choice. */
  const accused = accusedOf(context.people);
  const complainants = complainantsOf(context.people);
  const withPerson =
    type === "accused-examination" && accused.length === 1
      ? { ...record, personId: accused[0].id }
      : type === "complainant-evidence" && complainants.length === 1
        ? { ...record, personId: complainants[0].id }
        : record;
  saveEvidence(withPerson);
  return record.id;
}

/**
 * The order screen's Recorded statements view: everything recorded at this hearing, in
 * one place (owner, 2026-10-28: Examinations renamed; type buttons replaced by statement
 * type and person dropdowns). One tab per person; the text with `/` shortcuts; then the
 * sheet, signed by the person who gave it before they leave. The case file stays beside
 * it in the side panel.
 *
 * It is the third choice of "What to work on" because what was taken is the third thing the
 * typist works on at a hearing, after the order and its data. It does not touch the
 * order page, which stays the signed order's rendering (`ORD-13`), and it works whether
 * the order is a draft or already sent for signing.
 */
export function EvidenceView({ context }: { context: EvidenceContext }) {
  const records = useHearingEvidence(context.hearingId);
  const deponents = useDeponents(context);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [discarding, setDiscarding] = React.useState<EvidenceRecord | null>(null);
  const active =
    records.find((record) => record.id === activeId) ??
    records.find((record) => record.status !== "signed") ??
    records[records.length - 1];
  /* Hold the one shown, so signing it does not move the view to the next unsigned one
     while its confirmation is still open. Set at render, not in an effect. */
  if (active && activeId !== active.id) setActiveId(active.id);

  /* A statement opened from inside another (a witness added there) takes focus on its
     tab: the dialog that had focus went with the editor it sat in. */
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const focusActiveTab = React.useRef(false);
  React.useEffect(() => {
    if (!focusActiveTab.current) return;
    focusActiveTab.current = false;
    tabsRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
  });

  function start() {
    setActiveId(startEvidenceRecord(context));
  }

  /* Only after the last one is discarded: opening the view with none starts one. */
  if (records.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col rounded-xl border border-hairline bg-card shadow-raised">
        <Empty className="px-6 py-16">
          <EmptyHeader>
            <EmptyTitle className="text-body font-semibold">
              Nothing recorded at this hearing yet
            </EmptyTitle>
            <EmptyDescription className="text-body-compact text-pretty">
              Evidence of the complainant, a witness deposition, or examination of the
              accused. Choose the type and the person on the next screen. Questions go in
              with <kbd className="font-mono">/</kbd> shortcuts, as in the order.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" onClick={() => start()}>
              Record a statement
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col rounded-xl border border-hairline bg-card shadow-raised">
      {/* No scrollbar. A desktop set to always show scrollbars drew a track under
          this row; it still scrolls when the names do not fit. */}
      <div
        ref={tabsRef}
        role="group"
        aria-label="Recorded at this hearing"
        className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-hairline px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {records.map((record) => {
          const current = record.id === active?.id;
          const label = evidenceLabel(record, context.people, deponents);
          /* Discard sits beside the name it removes, a sibling of the tab button: a
             button cannot hold another. Only a draft can be discarded. */
          return (
            <div
              key={record.id}
              className={cn(
                "-mb-px flex min-h-12 shrink-0 items-center gap-1 border-b-2",
                current ? "border-primary" : "border-transparent",
              )}
            >
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                onClick={() => setActiveId(record.id)}
                className={cn(
                  "flex min-h-12 items-center gap-2 px-3 text-body-compact whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  record.status === "draft" && "pr-1",
                  current
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                <Badge variant={statusVariant(record)}>{evidenceStatusLabel(record)}</Badge>
              </button>
              {record.status === "draft" ? (
                <Button
                  type="button"
                  variant="destructive-ghost"
                  size="icon-xs"
                  className="mr-1 max-md:size-10"
                  aria-label={`Discard ${label}`}
                  onClick={() => setDiscarding(record)}
                >
                  <Trash2Icon aria-hidden className="size-4" />
                </Button>
              ) : null}
            </div>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          className="shrink-0 text-primary"
          onClick={() => start()}
        >
          <PlusIcon aria-hidden />
          Record another
        </Button>
      </div>

      {active ? (
        <EvidenceRecordEditor
          key={active.id}
          record={active}
          context={context}
          deponents={deponents}
          onOpenRecord={(id) => {
            focusActiveTab.current = true;
            setActiveId(id);
          }}
        />
      ) : null}

      <AlertDialog
        open={discarding !== null}
        onOpenChange={(next) => {
          if (!next) setDiscarding(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this recorded statement?</AlertDialogTitle>
            <AlertDialogDescription>
              What has been typed in it is lost. Nothing has been signed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (discarding) discardEvidence(discarding.id);
                setDiscarding(null);
                setActiveId(null);
                notify.neutral("Discarded.", { icon: Trash2Icon });
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function personLabelFor(type: StatementType): string {
  if (type === "accused-examination") return "Accused";
  if (type === "complainant-evidence") return "Complainant";
  return "Witness";
}

function personPlaceholderFor(type: StatementType): string {
  if (type === "accused-examination") return "Choose the accused";
  if (type === "complainant-evidence") return "Choose the complainant";
  return "Choose the witness";
}

function personErrorFor(type: StatementType): string {
  if (type === "accused-examination") return "Choose the accused being examined.";
  if (type === "complainant-evidence") return "Choose the complainant.";
  return "Choose the witness.";
}

function textErrorFor(type: StatementType): string {
  if (type === "accused-examination") return "Put at least one question to the accused.";
  if (type === "complainant-evidence") {
    return "Type the complainant's evidence before signing it.";
  }
  return "Type the deposition before signing it.";
}

function EvidenceRecordEditor({
  record,
  context,
  deponents,
  onOpenRecord,
}: {
  record: EvidenceRecord;
  context: EvidenceContext;
  deponents: readonly Deponent[];
  /** Shows another statement at this hearing, in place of this one. */
  onOpenRecord: (id: string) => void;
}) {
  const type = statementTypeOf(record);
  const suggestion = useDepositionSuggestion(record.kind);
  const typeFieldId = React.useId();
  const personFieldId = React.useId();
  const textLabelId = React.useId();
  /* The field reads its value once, on mount: a shortcut put in from the dialog mounts it
     again with the new text. */
  const [version, setVersion] = React.useState(0);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [signing, setSigning] = React.useState(false);
  const [errors, setErrors] = React.useState<{ person?: string; text?: string }>({});
  const [adding, setAdding] = React.useState(false);
  const editable = record.status === "draft";
  const deposition = record.kind === "deposition";
  const accused = accusedOf(context.people);
  const complainants = complainantsOf(context.people);
  const deponent =
    type === "witness-deposition"
      ? deponents.find((entry) => entry.id === record.personId)
      : undefined;
  const examined =
    type === "accused-examination"
      ? accused.find((entry) => entry.id === record.personId)
      : undefined;
  const complainant =
    type === "complainant-evidence"
      ? complainants.find((entry) => entry.id === record.personId)
      : undefined;
  const all = React.useSyncExternalStore(subscribeToEvidence, readEvidence, serverEvidence);
  const numbered = deponent ? witnessNumberOf(record, deponent, deponents, all) : undefined;
  /* The side their mark stands for: chosen in Witness mark as until the number is fixed. */
  const markSide = deponent && numbered ? (sideOfMark(numbered.number) ?? deponent.side) : undefined;
  /* Who the sheet and its signing name: the witness with their number, or the accused. */
  const subject: EvidenceSubject | undefined = deponent
    ? {
        name: deponent.name,
        number: numbered?.number,
        side: markSide,
        mobile: deponent.mobile,
      }
    : examined
      ? {
          name: examined.name,
          mobile: examined.mobiles[0]?.value.replace(/^\+91\s*/, "").replace(/\s/g, ""),
        }
      : complainant
        ? {
            name: complainant.name,
            mobile: complainant.mobiles[0]?.value
              .replace(/^\+91\s*/, "")
              .replace(/\s/g, ""),
          }
        : undefined;

  function setStatementType(next: StatementType) {
    const kind = kindForStatementType(next);
    const personStillValid =
      next === "accused-examination"
        ? accused.some((entry) => entry.id === record.personId)
        : next === "complainant-evidence"
          ? complainants.some((entry) => entry.id === record.personId)
          : deponents.some((entry) => entry.id === record.personId);
    updateEvidence(record.id, {
      statementType: next,
      kind,
      personId: personStillValid ? record.personId : "",
      witnessNumber: next === "witness-deposition" ? record.witnessNumber : undefined,
      witnessSide: next === "witness-deposition" ? record.witnessSide : undefined,
    });
    setErrors((current) => ({ ...current, person: undefined }));
  }

  function review() {
    const blanks = blanksIn(record.text);
    const next = {
      person: record.personId ? undefined : personErrorFor(type),
      text: !record.text.trim()
        ? textErrorFor(type)
        : blanks
          ? `${blanks} ${blanks === 1 ? "blank is" : "blanks are"} still in square brackets. Fill or delete them.`
          : undefined,
    };
    setErrors(next);
    if (next.person) {
      window.document.getElementById(personFieldId)?.focus();
      return;
    }
    if (next.text) {
      const editor = window.document.querySelector<HTMLElement>(
        `[aria-labelledby="${CSS.escape(textLabelId)}"]`,
      );
      editor?.focus();
      if (editor) selectFirstBlank(editor);
      return;
    }
    setSigning(true);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Statement type alone on the first row; person + mark sit side by side below
          (owner, 2026-10-28). Default type is witness deposition. The same two-column
          grid as that row, so it is exactly as wide as the person field under it. */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={typeFieldId}>Statement type</FieldLabel>
          <Select
            value={type}
            disabled={!editable}
            onValueChange={(value) => setStatementType(value as StatementType)}
          >
            <SelectTrigger id={typeFieldId} className="w-full">
              <SelectValue placeholder="Choose the type" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              sideOffset={4}
              className="w-(--radix-select-trigger-width)"
            >
              <SelectGroup>
                {STATEMENT_TYPES.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors.person)}>
          <FieldLabel htmlFor={personFieldId}>{personLabelFor(type)}</FieldLabel>
          <Select
            value={record.personId}
            disabled={!editable}
            onValueChange={(personId) => {
              /* The last line opens the form; the person stays who they were. */
              if (personId === ADD_WITNESS) {
                setAdding(true);
                return;
              }
              /* Another witness starts on their own side, not the last one's. */
              updateEvidence(record.id, { personId, witnessSide: undefined });
              setErrors((current) => ({ ...current, person: undefined }));
            }}
          >
            <SelectTrigger id={personFieldId} className="w-full" aria-invalid={Boolean(errors.person)}>
              <SelectValue placeholder={personPlaceholderFor(type)} />
            </SelectTrigger>
            {/* Items sit in groups: the group, not the content, insets the hover fill.
                A deposition's list is labelled by who the person is on the case. It opens
                below the field, as the filing form's does, not over it. */}
            <SelectContent
              position="popper"
              align="start"
              sideOffset={4}
              className="w-(--radix-select-trigger-width)"
            >
              {type === "witness-deposition" ? (
                <>
                {DEPONENT_GROUPS.map((group) => {
                  const members = deponents.filter((entry) => group.sources.includes(entry.source));
                  return members.length === 0 ? null : (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {members.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {/* The number first: a long name is what gets cut in the trigger. */}
                          {entry.number
                            ? `${entry.number} · ${entry.name}`
                            : `${entry.name} · ${
                                entry.source === "complainant" || entry.source === "accused"
                                  ? entry.source
                                  : "no number yet"
                              }`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
                {/* Someone not on the list is found missing here, so adding them is the
                    list's last line (Anshumanth, 2026-10-29: back from beside the label). */}
                <SelectSeparator />
                <SelectGroup>
                  <SelectItem value={ADD_WITNESS} className="text-primary">
                    <PlusIcon aria-hidden className="text-primary" />
                    Add a witness
                  </SelectItem>
                </SelectGroup>
                </>
              ) : type === "complainant-evidence" ? (
                <SelectGroup>
                  {complainants.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : (
                <SelectGroup>
                  {accused.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <FieldError>{errors.person}</FieldError>
        </Field>

        {/* Beside the witness: who called them, as the side in words and the mark it gives
            them (owner, 2026-10-28). Each row shows the mark this witness would really hold
            there. Fixed once they have a number: from the case's list, or by signing.
            Always shown for a deposition so the row stays paired. */}
        {type === "witness-deposition" ? (
          <Field>
            <FieldLabel htmlFor={`${personFieldId}-mark`}>Witness mark as</FieldLabel>
            <Select
              value={markSide ?? ""}
              disabled={!editable || !deponent || numbered?.fixed}
              onValueChange={(side) =>
                updateEvidence(record.id, { witnessSide: side as WitnessSide })
              }
            >
              <SelectTrigger id={`${personFieldId}-mark`} className="w-full">
                <SelectValue placeholder="Choose the witness first" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                sideOffset={4}
                className="w-(--radix-select-trigger-width)"
              >
                <SelectGroup>
                  {deponent
                    ? WITNESS_SIDES.map((side) => (
                        <SelectItem
                          key={side}
                          value={side}
                          className="*:[span]:last:flex-1 *:[span]:last:justify-between"
                        >
                          <SideName side={side} />
                          <MarkBadge
                            mark={witnessNumberOf(record, deponent, deponents, all, side).number}
                          />
                        </SelectItem>
                      ))
                    : null}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {/* An accused's standing only where it says more than the field's own label:
            "Accused 2 · person in charge", not "Accused". */}
        {examined && examined.role !== "Accused" ? (
          <Field>
            <FieldLabel htmlFor={`${personFieldId}-standing`}>Standing</FieldLabel>
            <Input id={`${personFieldId}-standing`} readOnly value={examined.role} />
          </Field>
        ) : null}
      </div>

      {editable ? (
        /* Invalid marks the edge, the label and the message; the typed words keep their
           own colour rather than taking the field's red. */
        <Field
          data-invalid={Boolean(errors.text)}
          className="data-[invalid=true]:text-foreground"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel
              id={textLabelId}
              className="group-data-[invalid=true]/field:text-destructive"
            >
              {statementTypeLabel(type)}
            </FieldLabel>
            <div className="flex items-center gap-3">
              <span className="hidden text-body-compact text-muted-foreground sm:inline">
                Type <kbd className="font-mono">/</kbd> for a shortcut
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShortcutsOpen(true)}>
                Shortcuts
              </Button>
            </div>
          </div>
          <RichTextField
            key={version}
            labelId={textLabelId}
            value={{ html: record.html, text: record.text }}
            onChange={(value: RichTextValue) => {
              updateEvidence(record.id, { html: value.html, text: value.text });
              setErrors((current) => ({ ...current, text: undefined }));
            }}
            suggestion={suggestion}
            className="[&_[data-slot=input-group-control]]:min-h-72"
          />
          <FieldError>{errors.text}</FieldError>
        </Field>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-body-compact text-muted-foreground">
            {record.status === "signed"
              ? `${evidenceStatusLabel(record)}${record.signedWith === "paper" ? " on paper" : ""}.`
              : `Sent to +91 ${record.sentTo ?? ""} to sign.`}
          </p>
          <RichTextValueView
            value={{ html: record.html, text: record.text }}
            className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-sunken p-4 text-body"
          />
        </div>
      )}

      {editable ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <span aria-live="polite" className="text-body-compact text-muted-foreground">
            Saved
          </span>
          <Button type="button" variant="outline" onClick={review}>
            Review and sign
          </Button>
        </div>
      ) : null}

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        {/* Side by side from md, each pane scrolling on its own; stacked below, the
            window scrolls. */}
        <DialogContent className="flex max-h-[90svh] flex-col gap-6 overflow-y-auto sm:max-w-3xl md:max-w-5xl md:overflow-hidden">
          <DialogHeader>
            <DialogTitle>Shortcuts</DialogTitle>
            <DialogDescription>
              In the {statementTypeLabel(type).toLowerCase()}, type{" "}
              <kbd className="font-mono">/</kbd> to list them and the start of a name to
              narrow the list, then press Enter to put one in.
            </DialogDescription>
          </DialogHeader>
          <DepositionShortcutsPanel
            kind={record.kind}
            onInsert={(entry) => {
              updateEvidence(record.id, {
                html: `${record.html}${entry.html}`,
                text: `${record.text} ${entry.text}`.trim(),
              });
              setVersion((value) => value + 1);
              setShortcutsOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {subject ? (
        <EvidenceSignDialog
          open={signing}
          onOpenChange={setSigning}
          record={record}
          subject={subject}
          context={context}
        />
      ) : null}

      {type === "witness-deposition" ? (
        <AddWitnessDialog
          open={adding}
          onOpenChange={setAdding}
          caseNumber={context.caseNumber}
          returnFocusTo={personFieldId}
          onAdded={(witness) => {
            /* Whoever is already in this statement keeps it, and the mark they hold: the
               new witness gets a statement of their own, so a second defence witness
               reads DW-2, not DW-1 again (owner, 2026-10-28). Choosing someone else in
               the Witness list still corrects this statement in place. */
            if (record.personId) {
              const next = {
                ...newEvidenceRecord("witness-deposition", context),
                personId: witness.id,
              };
              saveEvidence(next);
              onOpenRecord(next.id);
              notify.success(`${witness.name} added as a witness, in a new statement.`);
              return;
            }
            updateEvidence(record.id, { personId: witness.id, witnessSide: undefined });
            setErrors((current) => ({ ...current, person: undefined }));
            notify.success(`${witness.name} added as a witness.`);
          }}
        />
      ) : null}
    </div>
  );
}

/** Select the first blank left, so the typist types straight over it. */
function selectFirstBlank(root: HTMLElement): void {
  const walker = window.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const slot = /\[[^\]]*\]/.exec(node.textContent ?? "");
    if (!slot) continue;
    const range = window.document.createRange();
    range.setStart(node, slot.index);
    range.setEnd(node, slot.index + slot[0].length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return;
  }
}

type SignStage = "review" | "link" | "done";

/** Who signs the sheet: a witness with their number, or the accused. */
type EvidenceSubject = {
  name: string;
  /** A witness's number: theirs, or the one they take on signing. */
  number?: string;
  side?: WitnessSide;
  /** Ten digits, when on record. */
  mobile?: string;
};

/**
 * The sheet, then its first signature. Whoever gave the statement signs it on their own
 * phone, from a link sent by SMS, with whichever digital signature they have — never at
 * the court's keyboard, and never Aadhaar alone (Anshumanth, 2026-10-29). The court only
 * sends it: the sheet, then the number, then sent.
 */
function EvidenceSignDialog({
  open,
  onOpenChange,
  record,
  subject,
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: EvidenceRecord;
  subject: EvidenceSubject;
  context: EvidenceContext;
}) {
  const person = subject;
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const mobileId = React.useId();
  const [stage, setStage] = React.useState<SignStage>("review");
  const [mobile, setMobile] = React.useState(subject.mobile ?? "");
  const [mobileError, setMobileError] = React.useState<string>();

  /* Fresh each time it opens, at render on the closed→open edge. */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStage("review");
      setMobile(subject.mobile ?? "");
      setMobileError(undefined);
    }
  }

  /* A new stage replaces the content; its title takes focus. */
  React.useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open, stage]);

  const type = statementTypeOf(record);
  const sheetTitle =
    type === "accused-examination"
      ? `Examination of the accused · ${person.name}`
      : type === "complainant-evidence"
        ? `Evidence of the complainant · ${person.name}`
        : `Deposition of ${subject.number ?? ""} · ${person.name}`;
  /* Titles only: what each stage asks is in the stage itself. */
  const title: Record<Exclude<SignStage, "done">, string> = {
    review: sheetTitle,
    link: "Send the signing link",
  };

  function finish(change: Partial<EvidenceRecord>) {
    updateEvidence(record.id, change);
    setStage("done");
  }

  const FOOTER =
    "flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-between";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FlowDialogContent
        aria-describedby={undefined}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0",
          stage === "review" ? "sm:max-w-3xl" : "sm:max-w-md",
        )}
      >
        {stage === "done" ? (
          <DialogHeader className="shrink-0 px-6 py-6 pr-12 text-left">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-full",
                  record.status === "signed"
                    ? "bg-success-muted text-success-muted-foreground"
                    : "bg-info-muted text-info-muted-foreground",
                )}
              >
                {record.status === "signed" ? (
                  <CheckCircle2Icon className="size-7" />
                ) : (
                  <HourglassIcon className="size-7" />
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-1.5">
                <DialogTitle
                  ref={titleRef}
                  tabIndex={-1}
                  className="text-body font-semibold text-balance outline-none"
                >
                  {record.status === "signed"
                    ? `Signed by ${person.name}`
                    : `Sent to ${person.name} to sign`}
                </DialogTitle>
                {record.status === "signed" ? null : (
                  <p className="text-body-compact text-muted-foreground">
                    By SMS to +91 {record.sentTo}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
        ) : (
          <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-4 pr-12 text-left">
            <DialogTitle
              ref={titleRef}
              tabIndex={-1}
              className="text-body font-semibold text-balance outline-none"
            >
              {title[stage]}
            </DialogTitle>
          </DialogHeader>
        )}

        {stage !== "done" ? (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-6",
            )}
          >
            {stage === "review" ? (
              <div className="rounded-xl bg-surface-sunken p-4">
                <article
                  aria-label={sheetTitle}
                  className="mx-auto flex max-w-2xl flex-col gap-4 rounded-sm border border-paper-border bg-paper px-8 py-12 text-body text-paper-foreground"
                >
                  <header className="flex flex-col items-center gap-1 text-center">
                    <p className="font-semibold">
                      {type === "accused-examination"
                        ? "Examination of the accused"
                        : type === "complainant-evidence"
                          ? "Evidence of the complainant"
                          : "Deposition of witnesses"}
                    </p>
                    <p className="text-body-compact text-paper-muted-foreground">
                      {type === "accused-examination"
                        ? "(Section 351, Bharatiya Nagarik Suraksha Sanhita, 2023)"
                        : "(Chapter XXII, Criminal Procedure Code)"}
                    </p>
                    <p className="text-body-compact">
                      {context.caseNumber} · {context.matter}
                    </p>
                  </header>
                  {type === "accused-examination" ? (
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold">Examination of {person.name}</p>
                      <p className="text-paper-muted-foreground">
                        The accused is not on oath. The evidence against the accused was put as
                        follows.
                      </p>
                    </div>
                  ) : type === "complainant-evidence" ? (
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold">Evidence of {person.name}</p>
                      <p>
                        Solemnly affirmed on{" "}
                        {formatOrderDate(record.takenOn ?? record.createdOn.slice(0, 10))}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold">
                        Deposition of {subject.number},{" "}
                        {subject.side === "court"
                          ? "court witness"
                          : `witness for the ${subject.side ?? "complainant"}`}
                      </p>
                      <p>Name: {person.name}</p>
                      <p>Solemnly affirmed on {formatOrderDate(record.takenOn ?? record.createdOn.slice(0, 10))}</p>
                    </div>
                  )}
                  <RichTextValueView
                    value={{ html: record.html, text: record.text }}
                    className="flex flex-col gap-2"
                  />
                  <p>
                    Read over to the {type === "accused-examination" ? "accused" : "deponent"}, who
                    admitted it to be correct. Recorded in open court on{" "}
                    {formatOrderDate(record.takenOn ?? record.createdOn.slice(0, 10))}.
                  </p>
                  <footer className="mt-6 flex flex-wrap justify-between gap-8 text-body-compact text-paper-muted-foreground">
                    <span className="min-w-44 border-t border-paper-border pt-2">
                      Signature of the{" "}
                      {type === "accused-examination"
                        ? "accused"
                        : type === "complainant-evidence"
                          ? "complainant"
                          : "witness"}
                    </span>
                    <span className="min-w-44 border-t border-paper-border pt-2">
                      Judicial Magistrate of the First Class
                    </span>
                  </footer>
                </article>
              </div>
            ) : null}

            {stage === "link" ? (
              <Field data-invalid={Boolean(mobileError)}>
                <FieldLabel htmlFor={mobileId}>{person.name}&apos;s mobile number</FieldLabel>
                <PrefixInput
                  id={mobileId}
                  prefix="+91"
                  inputMode="numeric"
                  autoComplete="off"
                  value={mobile}
                  aria-invalid={Boolean(mobileError)}
                  onChange={(next) => {
                    setMobile(normalizeMobileNumber(next));
                    setMobileError(undefined);
                  }}
                />
                <FieldError>{mobileError}</FieldError>
              </Field>
            ) : null}
          </div>
        ) : null}

        {stage === "review" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Back to editing
            </Button>
            <Button type="button" onClick={() => setStage("link")}>
              Continue to signing
            </Button>
          </footer>
        ) : null}

        {stage === "link" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={() => setStage("review")}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (mobile.length !== 10) {
                  setMobileError("Enter a 10-digit mobile number.");
                  window.document.getElementById(mobileId)?.focus();
                  return;
                }
                /* The sheet that goes out already names the witness's number: it is
                   theirs from here, not only once they sign. */
                finish({
                  status: "awaiting-signature",
                  sentTo: `${mobile.slice(0, 5)} ${mobile.slice(5)}`,
                  witnessNumber: subject.number,
                });
              }}
            >
              Send link
            </Button>
          </footer>
        ) : null}

        {stage === "done" ? (
          <footer className={cn(FOOTER, "sm:justify-end")}>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </footer>
        ) : null}
      </FlowDialogContent>
    </Dialog>
  );
}

const WITNESS_SIDES: readonly WitnessSide[] = ["complainant", "accused", "court"];

/**
 * The court's names for the sides, which the letters stand for: Prosecution, Defence,
 * Court (owner, 2026-10-27). No "(complainant)" after them (owner, 2026-10-29): in a
 * cheque case the sides are always the same parties, and the Witness field names the
 * person beside it.
 */
const SIDE_NAME: Record<WitnessSide, string> = {
  complainant: "Prosecution",
  accused: "Defence",
  court: "Court",
};

function SideName({ side }: { side: WitnessSide }) {
  return <span className="min-w-0 truncate">{SIDE_NAME[side]}</span>;
}

/**
 * The mark a side gives, as the Parties tab's detail pane shows a witness number: a
 * neutral badge in the registry's mono. The side tints are for telling many witnesses
 * apart in a list; here each row already names its side, and a red DW read as an error.
 */
function MarkBadge({ mark }: { mark: string }) {
  return (
    <Badge variant="secondary" className="shrink-0 font-mono tabular-nums">
      {mark}
    </Badge>
  );
}

/** No part of the address typed yet: left out, not held against the form. */
function addressBlank(addr: Address): boolean {
  return ![addr.line1, addr.pin, addr.state, addr.city, addr.district].some((v) => v.trim());
}

/** An address the form keeps: every field. */
function addressComplete(addr: Address): boolean {
  return [addr.line1, addr.pin, addr.state, addr.city, addr.district].every((v) => v.trim());
}

/** The first thing the form cannot take, in the order it is read; null when it can. */
function witnessFormError(form: {
  name: string;
  mobile: string;
  email: string;
  address: Address;
}): string | null {
  if (!form.name.trim()) return "Enter the witness's name or designation.";
  if (!form.mobile) return "Enter the witness's mobile number.";
  if (form.mobile.length !== 10) return "The mobile number needs all ten digits.";
  if (form.email.trim() && !isValidEmail(form.email)) {
    return "The email ID is not a complete email address.";
  }
  if (!addressBlank(form.address) && !addressComplete(form.address)) {
    return "The address needs every field, or leave it empty.";
  }
  return null;
}

/**
 * Add the person in the witness box to the case's witnesses, when they are not on its
 * list. Four things only (Anshumanth, 2026-10-29): a name or designation, a mobile
 * number — required, it is where a signing link goes — an email ID, and an address.
 * Documents are not uploaded here: what a witness produces is marked as an exhibit.
 *
 * Who called them is not asked here: the deposition's Witness mark as chooses the side
 * (owner, 2026-10-28). They start as the prosecution's until it says otherwise.
 */
function AddWitnessDialog({
  open,
  onOpenChange,
  caseNumber,
  returnFocusTo,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseNumber: string;
  /** The witness field's id: where focus goes back to. */
  returnFocusTo: string;
  onAdded: (witness: { id: string; name: string }) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [name, setName] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState<Address>(() => blankAddressBlock().addr);
  const [error, setError] = React.useState<string>();
  const [discarding, setDiscarding] = React.useState(false);

  /* Fresh each time it opens, at render on the closed→open edge. */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName("");
      setMobile("");
      setEmail("");
      setAddress(blankAddressBlock().addr);
      setError(undefined);
      setDiscarding(false);
    }
  }

  const dirty =
    [name, email].some((v) => v.trim()) || Boolean(mobile) || !addressBlank(address);

  /* A half-filled form is not lost to a stray Escape or a click outside. */
  function requestClose() {
    if (dirty) setDiscarding(true);
    else onOpenChange(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = witnessFormError({ name, mobile, email, address });
    setError(problem ?? undefined);
    if (problem) {
      /* The notice heads the form; bring it into view. It is read out as it appears. */
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const typedEmail = email.trim();
    const witness = addWitness({
      caseNumber,
      name: name.trim().replace(/\s+/g, " "),
      side: "complainant",
      mobile,
      mobiles: [mobile],
      emails: typedEmail ? [typedEmail] : undefined,
      addresses: addressBlank(address) ? undefined : [{ addr: address, police: "" }],
    });
    onAdded(witness);
    onOpenChange(false);
  }

  const FOOTER =
    "flex shrink-0 flex-col-reverse gap-2 border-t border-hairline bg-surface-sunken px-6 py-4 sm:flex-row sm:items-center sm:justify-end";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestClose();
        }}
      >
        <FlowDialogContent
          aria-describedby={undefined}
          className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            window.document.getElementById(returnFocusTo)?.focus();
          }}
        >
          <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-4 pr-12 text-left">
              <DialogTitle className="text-body font-semibold">Add a witness</DialogTitle>
            </DialogHeader>
            <div
              ref={scrollRef}
              className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6"
            >
              {error ? (
                <SectionNotice variant="destructive" announce="assertive">
                  {error}
                </SectionNotice>
              ) : null}

              <FormField label="Name or designation">
                <TextField
                  value={name}
                  onChange={(next) => {
                    setName(next);
                    setError(undefined);
                  }}
                  placeholder="e.g. Ramesh Nair, or Branch Manager, Federal Bank"
                  autoComplete="off"
                />
              </FormField>
              <FormRow>
                <FormField label="Mobile number">
                  <PrefixInput
                    prefix="+91"
                    value={mobile}
                    onChange={(next) => {
                      setMobile(normalizeMobileNumber(next));
                      setError(undefined);
                    }}
                    placeholder="10-digit number"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </FormField>
                <FormField label="Email ID" optional>
                  <TextField
                    type="email"
                    value={email}
                    onChange={(next) => {
                      setEmail(next);
                      setError(undefined);
                    }}
                    placeholder="name@domain.com"
                    autoComplete="off"
                  />
                </FormField>
              </FormRow>

              <Separator />

              <section aria-labelledby="witness-address" className="flex flex-col gap-4">
                <h3 id="witness-address" className="text-body font-semibold leading-snug">
                  Address <RequiredMark optional />
                </h3>
                <AddressFields
                  value={address}
                  onChange={(next) => {
                    setAddress(next);
                    setError(undefined);
                  }}
                  required={false}
                  stateFirst
                />
              </section>
            </div>
            <footer className={FOOTER}>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit">Add witness</Button>
            </footer>
          </form>
        </FlowDialogContent>
      </Dialog>

      <AlertDialog open={discarding} onOpenChange={setDiscarding}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this witness?</AlertDialogTitle>
            <AlertDialogDescription>
              What has been typed here is lost. They are not added to the case.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDiscarding(false);
                onOpenChange(false);
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
