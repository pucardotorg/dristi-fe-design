"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  HourglassIcon,
  PlusIcon,
  SignatureIcon,
  SmartphoneIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  DepositionShortcutsPanel,
  useDepositionSuggestion,
} from "@/components/employee/deposition-shortcuts-panel";
import {
  RichTextField,
  RichTextValueView,
  type RichTextValue,
} from "@/components/cases/rich-text-field";
import { UPLOAD_HELP, UploadedDocField } from "@/components/cases/uploaded-doc-field";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { PaperFallbackLink } from "@/components/filing/paper-fallback";
import { FormRow } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { TextField } from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import { AddressBlockList, ContactList } from "@/components/filing/repeat-lists";
import { ChoiceCard, OtpEntry } from "@/components/filing/sign-stages";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Textarea } from "@/components/ui/textarea";
import { isValidEmail } from "@/lib/cases/witnesses";
import type { CasePerson } from "@/lib/employee/case-people";
import {
  accusedOf,
  addWitness,
  blanksIn,
  deponentsFor,
  discardEvidence,
  evidenceAtHearing,
  evidenceLabel,
  evidenceStatusLabel,
  firstKindFor,
  newEvidenceRecord,
  nextWitnessNumber,
  readAddedWitnesses,
  readEvidence,
  saveEvidence,
  serverAddedWitnesses,
  serverEvidence,
  subscribeToAddedWitnesses,
  subscribeToEvidence,
  updateEvidence,
  witnessNumberOf,
  type Deponent,
  type EvidenceKind,
  type EvidenceRecord,
  type WitnessSide,
} from "@/lib/employee/hearing-evidence";
import { formatOrderDate, type CourtHearingPurposeId } from "@/lib/employee/hearings";
import { blankAddressBlock, blankContact } from "@/lib/filing/blank";
import type { AddressBlock, Contact } from "@/lib/filing/types";
import { cn } from "@/lib/utils";

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

const KIND_ACTION: Record<EvidenceKind, string> = {
  deposition: "Take witness deposition",
  examination: "Examine accused",
};

/** The Parties tab's pair for a witness number: its side's status tint, with an edge. */
const SIDE_BADGE: Record<
  WitnessSide,
  { variant: "success" | "destructive" | "info"; stroke: string }
> = {
  complainant: { variant: "success", stroke: "border-success" },
  accused: { variant: "destructive", stroke: "border-destructive" },
  court: { variant: "info", stroke: "border-info" },
};

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
 * The order screen's Examinations view: everything recorded at this hearing, in one place
 * (owner, 2026-10-27, after a header button, a side-panel tab and a case-page menu read
 * as "fragmented"). One tab per witness or accused, as DRISTI 1.0 had; the text with the
 * order screen's `/` shortcuts put to questions; then the sheet, signed by the person who
 * gave it before they leave the court. The case file stays beside it in the side panel.
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
  const first = firstKindFor(context.purpose);
  const kinds: EvidenceKind[] =
    first === "examination" ? ["examination", "deposition"] : ["deposition", "examination"];

  function start(kind: EvidenceKind) {
    const record = newEvidenceRecord(kind, context);
    /* With one accused, it is that person. A deposition always has a choice: the
       complainant, the listed witnesses, or someone to add. */
    const accused = accusedOf(context.people);
    saveEvidence(
      kind === "examination" && accused.length === 1
        ? { ...record, personId: accused[0].id }
        : record,
    );
    setActiveId(record.id);
  }

  if (records.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col rounded-xl border border-hairline bg-card shadow-raised">
        <Empty className="px-6 py-16">
          <EmptyHeader>
            <EmptyTitle className="text-body font-semibold">
              Nothing recorded at this hearing yet
            </EmptyTitle>
            <EmptyDescription className="text-body-compact text-pretty">
              A witness&apos;s deposition, or the examination of the accused. Questions go
              in with <kbd className="font-mono">/</kbd> shortcuts, as in the order.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row flex-wrap justify-center gap-3">
            {kinds.map((kind) => (
              <Button key={kind} type="button" variant="outline" onClick={() => start(kind)}>
                {KIND_ACTION[kind]}
              </Button>
            ))}
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" className="shrink-0 text-primary">
              <PlusIcon aria-hidden />
              Record another
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {kinds.map((kind) => (
              <DropdownMenuItem key={kind} onSelect={() => start(kind)}>
                {KIND_ACTION[kind]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {active ? (
        <EvidenceRecordEditor
          key={active.id}
          record={active}
          context={context}
          deponents={deponents}
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
            <AlertDialogTitle>
              Discard this {discarding?.kind === "examination" ? "examination" : "deposition"}?
            </AlertDialogTitle>
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
                toast("Discarded.");
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

function EvidenceRecordEditor({
  record,
  context,
  deponents,
}: {
  record: EvidenceRecord;
  context: EvidenceContext;
  deponents: readonly Deponent[];
}) {
  const suggestion = useDepositionSuggestion(record.kind);
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
  const deponent = deposition
    ? deponents.find((entry) => entry.id === record.personId)
    : undefined;
  const examined = deposition
    ? undefined
    : accused.find((entry) => entry.id === record.personId);
  const numbered = deponent ? witnessNumberOf(record, deponent, deponents) : undefined;
  /* Who the sheet and its signing name: the witness with their number, or the accused. */
  const subject: EvidenceSubject | undefined = deponent
    ? {
        name: deponent.name,
        number: numbered?.number,
        side: deponent.side,
        mobile: deponent.mobile,
      }
    : examined
      ? {
          name: examined.name,
          mobile: examined.mobiles[0]?.value.replace(/^\+91\s*/, "").replace(/\s/g, ""),
        }
      : undefined;

  function review() {
    const blanks = blanksIn(record.text);
    const next = {
      person: record.personId
        ? undefined
        : deposition
          ? "Choose the witness."
          : "Choose the accused being examined.",
      text: !record.text.trim()
        ? deposition
          ? "Type the deposition before signing it."
          : "Put at least one question to the accused."
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
      <div className="grid gap-6 md:grid-cols-2">
        <Field data-invalid={Boolean(errors.person)}>
          <FieldLabel htmlFor={personFieldId}>{deposition ? "Witness" : "Accused"}</FieldLabel>
          <Select
            value={record.personId}
            disabled={!editable}
            onValueChange={(personId) => {
              if (personId === ADD_WITNESS) {
                /* After the list has closed and handed focus back to its trigger, so
                   the form keeps focus and returns it there. */
                window.setTimeout(() => setAdding(true), 0);
                return;
              }
              updateEvidence(record.id, { personId });
              setErrors((current) => ({ ...current, person: undefined }));
            }}
          >
            <SelectTrigger id={personFieldId} className="w-full" aria-invalid={Boolean(errors.person)}>
              <SelectValue placeholder={deposition ? "Choose the witness" : "Choose the accused"} />
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
              {deposition ? (
                DEPONENT_GROUPS.map((group) => {
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
                })
              ) : (
                <SelectGroup>
                  {accused.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {deposition ? (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectItem value={ADD_WITNESS} className="text-primary">
                      <PlusIcon aria-hidden className="text-primary" />
                      Add a witness
                    </SelectItem>
                  </SelectGroup>
                </>
              ) : null}
            </SelectContent>
          </Select>
          {/* Below the list, as the field beside it has, so the two labels and boxes line up. */}
          <FieldDescription>
            {deposition
              ? "The parties and the witnesses on this case. Someone else? Add a witness, at the end of the list."
              : accused.length === 0
                ? "No accused is recorded on this case."
                : "Examined in person, and not on oath."}
          </FieldDescription>
          <FieldError>{errors.person}</FieldError>
        </Field>

        {/* Not chosen: the mark follows from the witness, so it reads as a field that
            cannot be typed in. The side is said in words below it. */}
        {deponent && numbered ? (
          <Field>
            <FieldLabel htmlFor={`${personFieldId}-mark`}>Witness mark as</FieldLabel>
            <Input
              id={`${personFieldId}-mark`}
              readOnly
              value={numbered.number}
              className="tabular-nums"
            />
            <FieldDescription>
              {SIDE_NAME[deponent.side].name} witness
              {SIDE_NAME[deponent.side].party
                ? `, called by the ${SIDE_NAME[deponent.side].party}`
                : ""}
              {numbered.fixed
                ? deponent.examined
                  ? ". Examined before."
                  : "."
                : ". Confirmed when they sign."}
            </FieldDescription>
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
              {deposition ? "Deposition" : "Examination"}
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
              ? `${evidenceStatusLabel(record)}${record.signedWith === "paper" ? " on paper" : " with Aadhaar OTP"}. It goes to the magistrate to sign.`
              : `Sent to +91 ${record.sentTo ?? ""} to sign. It goes to the magistrate once signed.`}
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
              In the {deposition ? "deposition" : "examination"}, type{" "}
              <kbd className="font-mono">/</kbd> and the start of a name, then press Tab to
              put its text in.
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

      {deposition ? (
        <AddWitnessDialog
          open={adding}
          onOpenChange={setAdding}
          caseNumber={context.caseNumber}
          deponents={deponents}
          returnFocusTo={personFieldId}
          onAdded={(witness) => {
            updateEvidence(record.id, { personId: witness.id });
            setErrors((current) => ({ ...current, person: undefined }));
            toast(`${witness.name} added as a witness.`);
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

type SignStage = "review" | "method" | "otp" | "upload" | "link" | "done";

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
 * The sheet, then its first signature: the witness signs in court with Aadhaar e-sign, or
 * a paper copy is uploaded; the accused is sent a link to sign on their own phone, as in
 * DRISTI 1.0. The e-sign dialog's own stages, in the person's name rather than "you".
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
  const deposition = record.kind === "deposition";
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const mobileId = React.useId();
  const [stage, setStage] = React.useState<SignStage>("review");
  const [otp, setOtp] = React.useState("");
  const [otpResent, setOtpResent] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string>();
  const [mobile, setMobile] = React.useState(subject.mobile ?? "");
  const [mobileError, setMobileError] = React.useState<string>();

  /* Fresh each time it opens, at render on the closed→open edge. */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStage("review");
      setOtp("");
      setOtpResent(false);
      setFile(null);
      setFileError(undefined);
      setMobileError(undefined);
    }
  }

  /* A new stage replaces the content; its title takes focus. Not the OTP's: its first
     box does, and the code is what is typed next. */
  React.useEffect(() => {
    if (open && stage !== "otp") titleRef.current?.focus();
  }, [open, stage]);

  const sheetTitle = deposition
    ? `Deposition of ${subject.number ?? ""} · ${person.name}`
    : `Examination of the accused · ${person.name}`;
  const header: Record<Exclude<SignStage, "done">, { title: string; description: string }> = {
    review: {
      title: sheetTitle,
      description: `Check the sheet. ${person.name} signs it next, then the magistrate.`,
    },
    method: {
      title: deposition ? "How is this deposition signed?" : `How does ${person.name} sign?`,
      description: `An unsigned ${record.kind} cannot go to the magistrate.`,
    },
    otp: {
      title: "Enter the OTP",
      description: `Sent to ${person.name}'s Aadhaar-linked mobile.`,
    },
    upload: {
      title: "Upload a signed copy",
      description: `The ${record.kind}, signed on paper by ${person.name}.`,
    },
    link: {
      title: "Send the signing link",
      description: "By SMS. Only this number can open it.",
    },
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
                <DialogDescription>
                  {record.status === "signed"
                    ? "It goes to the magistrate to sign."
                    : `The link went by SMS to +91 ${record.sentTo ?? ""}. It goes to the magistrate once ${person.name} signs.`}
                </DialogDescription>
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
              {header[stage].title}
            </DialogTitle>
            <DialogDescription>{header[stage].description}</DialogDescription>
          </DialogHeader>
        )}

        {stage !== "done" ? (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-6",
              stage === "method" && "bg-muted dark:bg-background",
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
                      {deposition ? "Deposition of witnesses" : "Examination of the accused"}
                    </p>
                    <p className="text-body-compact text-paper-muted-foreground">
                      {deposition
                        ? "(Chapter XXII, Criminal Procedure Code)"
                        : "(Section 351, Bharatiya Nagarik Suraksha Sanhita, 2023)"}
                    </p>
                    <p className="text-body-compact">
                      {context.caseNumber} · {context.matter}
                    </p>
                  </header>
                  {deposition ? (
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
                  ) : (
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold">Examination of {person.name}</p>
                      <p className="text-paper-muted-foreground">
                        The accused is not on oath. The evidence against the accused was put as
                        follows.
                      </p>
                    </div>
                  )}
                  <RichTextValueView
                    value={{ html: record.html, text: record.text }}
                    className="flex flex-col gap-2"
                  />
                  <p>
                    Read over to the {deposition ? "witness" : "accused"}, who admitted it to be
                    correct. Recorded in open court on{" "}
                    {formatOrderDate(record.takenOn ?? record.createdOn.slice(0, 10))}.
                  </p>
                  <footer className="mt-6 flex flex-wrap justify-between gap-8 text-body-compact text-paper-muted-foreground">
                    <span className="min-w-44 border-t border-paper-border pt-2">
                      Signature of the {deposition ? "witness" : "accused"}
                    </span>
                    <span className="min-w-44 border-t border-paper-border pt-2">
                      Judicial Magistrate of the First Class
                    </span>
                  </footer>
                </article>
              </div>
            ) : null}

            {stage === "method" ? (
              <>
                {deposition ? (
                  <ChoiceCard
                    title="Sign digitally"
                    tone="bg-brand-muted text-brand-muted-foreground"
                    icon={<SignatureIcon className="size-5" />}
                    onClick={() => setStage("otp")}
                  >
                    {person.name} signs with Aadhaar e-sign. A six-digit code goes to the mobile
                    number registered with their Aadhaar.
                  </ChoiceCard>
                ) : (
                  <ChoiceCard
                    title="Send a signing link"
                    tone="bg-brand-muted text-brand-muted-foreground"
                    icon={<SmartphoneIcon className="size-5" />}
                    onClick={() => setStage("link")}
                  >
                    {person.name} opens it on their phone, confirms their number and signs with
                    Aadhaar e-sign.
                  </ChoiceCard>
                )}
                <PaperFallbackLink
                  onClick={() => {
                    setFileError(undefined);
                    setStage("upload");
                  }}
                />
              </>
            ) : null}

            {stage === "otp" ? (
              <OtpEntry
                id="evidence-otp"
                value={otp}
                onChange={setOtp}
                resent={otpResent}
                onResend={() => setOtpResent(true)}
              />
            ) : null}

            {stage === "upload" ? (
              <>
                <Field data-invalid={Boolean(fileError) && !file}>
                  <FieldLabel className="block w-full font-semibold leading-snug">
                    Signed {record.kind}
                  </FieldLabel>
                  <UploadedDocField
                    label={`Signed ${record.kind}`}
                    required
                    file={file}
                    onFileChange={(next) => {
                      setFile(next);
                      setFileError(undefined);
                    }}
                  />
                  <FieldDescription>{UPLOAD_HELP}</FieldDescription>
                </Field>
                <FieldError>{fileError}</FieldError>
              </>
            ) : null}

            {stage === "link" ? (
              <Field data-invalid={Boolean(mobileError)}>
                <FieldLabel htmlFor={mobileId}>{person.name}&apos;s mobile number</FieldLabel>
                <Input
                  id={mobileId}
                  inputMode="tel"
                  autoComplete="off"
                  value={mobile}
                  aria-invalid={Boolean(mobileError)}
                  onChange={(event) => {
                    setMobile(event.target.value);
                    setMobileError(undefined);
                  }}
                />
                <FieldDescription>Ten digits, without +91.</FieldDescription>
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
            <Button type="button" onClick={() => setStage("method")}>
              Continue to signing
            </Button>
          </footer>
        ) : null}

        {stage === "method" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={() => setStage("review")}>
              Back
            </Button>
          </footer>
        ) : null}

        {stage === "otp" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={() => setStage("method")}>
              Back
            </Button>
            <Button
              type="button"
              disabled={otp.length < 6}
              onClick={() =>
                finish({ status: "signed", signedWith: "aadhaar", witnessNumber: subject.number })
              }
            >
              Verify and sign
            </Button>
          </footer>
        ) : null}

        {stage === "upload" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={() => setStage("method")}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!file) {
                  setFileError(`Upload the signed ${record.kind} to continue.`);
                  return;
                }
                finish({ status: "signed", signedWith: "paper", witnessNumber: subject.number });
              }}
            >
              Submit signed copy
            </Button>
          </footer>
        ) : null}

        {stage === "link" ? (
          <footer className={FOOTER}>
            <Button type="button" variant="outline" onClick={() => setStage("method")}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => {
                const digits = mobile.replace(/\D/g, "");
                if (digits.length !== 10) {
                  setMobileError("Enter a 10-digit mobile number.");
                  window.document.getElementById(mobileId)?.focus();
                  return;
                }
                finish({
                  status: "awaiting-signature",
                  sentTo: `${digits.slice(0, 5)} ${digits.slice(5)}`,
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
 * Court (owner, 2026-10-27). In a cheque case the complainant prosecutes, so the party
 * stays in brackets for a reader who knows the case by its parties.
 */
const SIDE_NAME: Record<WitnessSide, { name: string; party?: string }> = {
  complainant: { name: "Prosecution", party: "complainant" },
  accused: { name: "Defence", party: "accused" },
  court: { name: "Court" },
};

/** An address with nothing typed in it yet: left out, not held against the form. */
function addressBlank({ addr, police }: AddressBlock): boolean {
  return ![addr.line1, addr.pin, addr.city, addr.district, addr.state, police].some((v) =>
    v.trim(),
  );
}

/** The advocate form's rule for an address it keeps: every field, police station included. */
function addressComplete({ addr, police }: AddressBlock): boolean {
  return [addr.line1, addr.pin, addr.city, addr.district, addr.state, police].every((v) =>
    v.trim(),
  );
}

/** The first thing the form cannot take, in the order it is read; null when it can. */
function witnessFormError(form: {
  fullName: string;
  designation: string;
  contacts: Contact[];
  addresses: AddressBlock[];
}): string | null {
  if (!form.fullName.trim() && !form.designation.trim()) {
    return "Enter the witness's full name or their designation.";
  }
  const shortMobile = form.contacts.findIndex(
    (c) => c.mobile.length > 0 && c.mobile.length !== 10,
  );
  if (shortMobile >= 0) {
    return `Mobile number ${shortMobile + 1} needs all ten digits, or leave it empty.`;
  }
  const badEmail = form.contacts.findIndex((c) => c.email.trim() && !isValidEmail(c.email));
  if (badEmail >= 0) {
    return `Email ID ${badEmail + 1} is not a complete email address.`;
  }
  const partAddress = form.addresses.findIndex(
    (block) => !addressBlank(block) && !addressComplete(block),
  );
  if (partAddress >= 0) {
    return `Address ${partAddress + 1} needs every field, police station included, or remove it.`;
  }
  return null;
}

/**
 * Add the person in the witness box to the case's witnesses, when they are not on its
 * list. DRISTI 1.0's Add Witness Details (owner, 2026-10-27), asked the way the advocate's
 * Add witnesses form asks it, from the same filing kit: a full name or a designation,
 * age, contact rows, addresses, and what they will prove. Only the name or designation is
 * required; the witness is in court, so the rest is for reaching them later. Documents
 * are not uploaded here: what a witness produces is marked as an exhibit.
 *
 * Who called them stays this form's own: it gives the letters of their number. The
 * number is not chosen: it is the next free one on that side, theirs when they sign.
 */
function AddWitnessDialog({
  open,
  onOpenChange,
  caseNumber,
  deponents,
  returnFocusTo,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseNumber: string;
  deponents: readonly Deponent[];
  /** The witness field's id: where focus goes back to. */
  returnFocusTo: string;
  onAdded: (witness: { id: string; name: string }) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [fullName, setFullName] = React.useState("");
  const [designation, setDesignation] = React.useState("");
  const [age, setAge] = React.useState("");
  const [side, setSide] = React.useState<WitnessSide>("complainant");
  const [prove, setProve] = React.useState("");
  const [contacts, setContacts] = React.useState<Contact[]>(() => [blankContact()]);
  const [addresses, setAddresses] = React.useState<AddressBlock[]>(() => [blankAddressBlock()]);
  const [error, setError] = React.useState<string>();
  const [discarding, setDiscarding] = React.useState(false);

  /* Fresh each time it opens, at render on the closed→open edge. */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFullName("");
      setDesignation("");
      setAge("");
      setSide("complainant");
      setProve("");
      setContacts([blankContact()]);
      setAddresses([blankAddressBlock()]);
      setError(undefined);
      setDiscarding(false);
    }
  }

  const dirty =
    Boolean(fullName.trim() || designation.trim() || age.trim() || prove.trim()) ||
    contacts.some((c) => c.mobile || c.email.trim()) ||
    addresses.some((block) => !addressBlank(block));

  /* A half-filled form is not lost to a stray Escape or a click outside. */
  function requestClose() {
    if (dirty) setDiscarding(true);
    else onOpenChange(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = witnessFormError({ fullName, designation, contacts, addresses });
    setError(problem ?? undefined);
    if (problem) {
      /* The notice heads the form; bring it into view. It is read out as it appears. */
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const tidy = (value: string) => value.trim().replace(/\s+/g, " ");
    const mobiles = contacts.map((c) => c.mobile).filter(Boolean);
    const emails = contacts.map((c) => c.email.trim()).filter(Boolean);
    const kept = addresses.filter((block) => !addressBlank(block));
    const witness = addWitness({
      caseNumber,
      name: tidy(fullName) || tidy(designation),
      designation: tidy(designation) || undefined,
      side,
      age: age || undefined,
      mobile: mobiles[0],
      mobiles: mobiles.length ? mobiles : undefined,
      emails: emails.length ? emails : undefined,
      addresses: kept.length ? kept : undefined,
      prove: prove.trim() || undefined,
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
          className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            window.document.getElementById(returnFocusTo)?.focus();
          }}
        >
          <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-4 pr-12 text-left">
              <DialogTitle className="text-body font-semibold">Add a witness</DialogTitle>
              <DialogDescription>
                Someone giving evidence who is not on this case&apos;s list.
              </DialogDescription>
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

              {/* Who they are first, then how to reach them, then why they are here
                  (owner, 2026-10-27): name and age share a row, the designation runs
                  the full width under it. A plain form: field labels and dividers, no
                  section headings or copy (owner). The "or" says a name or designation
                  is enough; the notice says so when neither is given. */}
              <FormRow>
                <FormField label="Full name">
                  <TextField
                    value={fullName}
                    onChange={(next) => {
                      setFullName(next);
                      setError(undefined);
                    }}
                    placeholder="As the witness gives it"
                    autoComplete="off"
                  />
                </FormField>
                <FieldSeparator className="md:col-span-2">or</FieldSeparator>
                <FormField label="Designation" className="md:col-span-2">
                  <TextField
                    value={designation}
                    onChange={(next) => {
                      setDesignation(next);
                      setError(undefined);
                    }}
                    placeholder="e.g. Branch Manager, Federal Bank"
                    autoComplete="off"
                  />
                </FormField>
                {/* Last in the source, so on a phone the "or" sits between the two
                    it joins; beside the name from md up. */}
                <FormField label="Age" optional className="md:col-start-2 md:row-start-1">
                  <TextField
                    value={age}
                    onChange={(next) => setAge(next.replace(/\D/g, "").slice(0, 3))}
                    placeholder="In years"
                    inputMode="numeric"
                    maxLength={3}
                  />
                </FormField>
              </FormRow>

              <Separator />

              <ContactList
                contacts={contacts}
                onChange={(next) => {
                  setContacts(next);
                  setError(undefined);
                }}
                emailLabel="Email ID"
                mobilePlaceholder="10-digit number"
                emailPlaceholder="name@example.com"
                optional
                allowAdd={false}
              />

              <Separator />

              <AddressBlockList
                blocks={addresses}
                onChange={(next) => {
                  setAddresses(next);
                  setError(undefined);
                }}
                addLabel="Add address"
                optional
              />

              <Separator />

              <FieldSet>
                <FieldLegend variant="label">Witness for</FieldLegend>
                <RadioGroup
                  value={side}
                  onValueChange={(next) => setSide(next as WitnessSide)}
                  className="gap-1"
                >
                  {WITNESS_SIDES.map((entry) => (
                    <label
                      key={entry}
                      className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
                    >
                      <RadioGroupItem value={entry} />
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3 text-body-compact">
                        <span>
                          {SIDE_NAME[entry].name}
                          {SIDE_NAME[entry].party ? (
                            <span className="text-muted-foreground">
                              {" "}
                              ({SIDE_NAME[entry].party})
                            </span>
                          ) : null}
                        </span>
                        <Badge
                          variant={SIDE_BADGE[entry].variant}
                          className={cn("font-mono", SIDE_BADGE[entry].stroke)}
                        >
                          {nextWitnessNumber(entry, deponents)}
                        </Badge>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </FieldSet>

              <FormField label="What will this witness prove?" optional>
                <Textarea
                  value={prove}
                  onChange={(event) => setProve(event.target.value)}
                  placeholder="e.g. Confirms the cheque was handed over on 4 March"
                />
              </FormField>
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
