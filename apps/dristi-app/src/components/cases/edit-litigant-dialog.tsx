"use client";

/**
 * Edit a litigant's details — scenario 10 of the party-actions spec. A change
 * to what the record says about a party is an application to the magistrate,
 * so the pencil on the detail pane opens a pre-filled form and ends in the
 * shared application chain: the generated paper, a signature, and the
 * hourglass done stage. The record itself changes only when the order is
 * passed.
 *
 * Own side only: the server renders the pencil on the viewer's own litigants.
 */

import { useMemo, useState } from "react";
import { PencilIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ChromeAlertDialogContent,
} from "@/components/chrome/app-chrome";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import {
  PartyApplicationDocument,
  PartySignatureDialog,
  type CaseRef,
} from "@/components/cases/party-application";
import {
  UPLOAD_HELP,
  UploadedDocField,
} from "@/components/cases/uploaded-doc-field";
import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import {
  DocumentPreviewDialog,
  DocumentThumbnailButton,
} from "@/components/document-preview";
import {
  formatStructuredAddress,
  structuredAddressComplete,
  StructuredAddressFields,
  type StructuredAddress,
} from "@/components/cases/structured-address";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { idUpload } from "@/lib/join/content";
import { useCourtLocalized, useCourtText } from "@/components/court/court-provider";

/** The record's address — the app's one structured grammar. */
export type EditableAddress = StructuredAddress;

/** The ID already on the record, when the party has submitted one. */
export type RecordIdProof = { typeLabel: string; fileName: string };

/** What the record holds about the litigant — the form's pre-fill. */
export type EditableLitigant = {
  name: string;
  /** The person who speaks for an entity, when the litigant is one. */
  entityRepresentative?: string;
  /** The number this party signs in with — shown locked, never editable. */
  mobile?: string;
  /** The address on the record — the form's pre-fill, editable. */
  address?: EditableAddress;
  /** `null` = the party never submitted an ID; `undefined` = unknown, the
      dialog falls back to its demo derivation. */
  idProof?: RecordIdProof | null;
};

/**
 * The same ID list the litigant settings offer (`lib/join/content`), as this
 * dialog's proof-of-correction options. English side only: the case screens
 * render in English.
 */
const ID_TYPES = Object.entries(idUpload.idTypes).map(([value, copy]) => ({
  value,
  label: copy.en,
}));

/**
 * Demo pre-fill for record fields the parties pack does not carry yet. A
 * stable synthetic per name, like `lib/access/derived.ts` — the real seam is
 * the party record, and these two go when it lands.
 */
function demoMobile(name: string): string {
  let hash = 11;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 100000000;
  const digits = String(hash).padStart(8, "0");
  return `98${digits.slice(0, 3)} ${digits.slice(3)}`;
}

function demoAddress(name: string): EditableAddress {
  let hash = 5;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  const surname = name.trim().split(/\s+/).at(-1) ?? "Sample";
  return {
    door: String((hash % 48) + 1),
    building: `${surname} House`,
    locality: "Chinnakada",
    city: "Sample District",
    district: "Sample District",
    state: "Kerala",
    pin: "691001",
  };
}

/** Some parties have an ID on record, some never submitted one — the form
    accounts for both, so the derivation gives both. */
function demoIdProof(name: string): RecordIdProof | null {
  let hash = 3;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  if (hash % 3 === 0) return null;
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return hash % 2
    ? { typeLabel: "Aadhaar", fileName: `aadhaar-${slug}.pdf` }
    : { typeLabel: "Voter ID", fileName: `voter-id-${slug}.pdf` };
}

/**
 * The served stand-in for an ID already on the record — a drawn SPECIMEN
 * card, because the demo may never ship anyone's real ID. The registry's
 * document service is the seam; swapping this URL for its file URL is the
 * whole change.
 */
const RECORD_ID_URL = "/demo/id-specimen.svg";
const RECORD_ID_DOC = { type: "image/svg+xml" };

export function EditLitigantAction({
  litigant,
  caseRef,
}: {
  litigant: EditableLitigant;
  caseRef: CaseRef;
}) {
  const [open, setOpen] = useState(false);
  /* A sent correction shows where its result will land — the tag rides the
     pane header until the order passes. Session-local, like every pending
     mark here; the applications service is the real record. */
  const [requested, setRequested] = useState(false);
  return (
    <>
      {requested ? (
        <Badge variant="warning">Correction requested</Badge>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground"
        aria-label={`Edit details for ${litigant.name}`}
        onClick={() => setOpen(true)}
      >
        <PencilIcon aria-hidden />
      </Button>
      <EditLitigantDialog
        open={open}
        onOpenChange={setOpen}
        litigant={litigant}
        caseRef={caseRef}
        onRequested={() => setRequested(true)}
      />
    </>
  );
}

type Errors = { name?: string; changes?: string; address?: string };

function EditLitigantDialog({
  open,
  onOpenChange,
  litigant,
  caseRef,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  litigant: EditableLitigant;
  caseRef: CaseRef;
  /** Fired when the application goes out — the pane header's pending tag. */
  onRequested?: () => void;
}) {
  /* The record's pre-fill. Mobile is display only — the number is how this
     party signs in, so it never rides a correction application. */
  const recordMobile = litigant.mobile ?? demoMobile(litigant.name);
  // The record's address is prefilled in the selected court's places (`CourtSwitch`).
  const recordAddress = useCourtLocalized(litigant.address ?? demoAddress(litigant.name));
  const recordId =
    litigant.idProof === undefined ? demoIdProof(litigant.name) : litigant.idProof;

  const [step, setStep] = useState<1 | 2>(1);
  const courtText = useCourtText();
  const [name, setName] = useState(() => courtText(litigant.name));
  const [representative, setRepresentative] = useState(
    litigant.entityRepresentative ?? ""
  );
  const [address, setAddress] = useState<EditableAddress>(recordAddress);
  /* An ID already on record shows as itself; Replace opens the pick-and-
     upload the empty state uses. */
  const [replacingId, setReplacingId] = useState(false);
  const [idPreviewOpen, setIdPreviewOpen] = useState(false);
  const [idType, setIdType] = useState<string | undefined>(undefined);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);

  const isEntity = litigant.entityRepresentative !== undefined;

  /** What the application actually asks to change — the review and the paper
      both print exactly this, so an untouched field never claims a correction. */
  const changes = useMemo(() => {
    const list: { term: string; value: string; was?: string }[] = [];
    if (name.trim() && name.trim() !== litigant.name) {
      list.push({ term: "Name", value: name.trim(), was: litigant.name });
    }
    if (
      isEntity &&
      representative.trim() &&
      representative.trim() !== litigant.entityRepresentative
    ) {
      list.push({
        term: "Represented by",
        value: representative.trim(),
        was: litigant.entityRepresentative,
      });
    }
    const formatted = formatStructuredAddress(address);
    const wasFormatted = formatStructuredAddress(recordAddress);
    if (formatted && formatted !== wasFormatted) {
      list.push({ term: "Address", value: formatted, was: wasFormatted });
    }
    return list;
  }, [name, representative, address, recordAddress, litigant, isEntity]);

  const isDirty = useMemo(
    () => changes.length > 0 || Boolean(idType || docFile || replacingId),
    [changes, idType, docFile, replacingId]
  );

  function resetForm() {
    setStep(1);
    setName(litigant.name);
    setRepresentative(litigant.entityRepresentative ?? "");
    setAddress(recordAddress);
    setReplacingId(false);
    setIdType(undefined);
    setDocFile(null);
    setSignOpen(false);
    setErrors({});
    setExitConfirmationOpen(false);
  }

  function closeClean() {
    resetForm();
    onOpenChange(false);
  }

  function requestExit() {
    if (isDirty) {
      setExitConfirmationOpen(true);
      return;
    }
    closeClean();
  }

  /** The generated application — the review sheet and the paper that is signed. */
  const applicationDoc = {
    matter: "Application for the correction of a litigant's details",
    facts: [
      { term: "Party", value: litigant.name },
      ...changes.map((change) => ({
        term: change.term,
        value: change.was
          ? `${change.value} (recorded as ${change.was})`
          : change.value,
      })),
      ...(docFile
        ? [
            {
              term: "Annexure",
              value: idType
                ? `${ID_TYPES.find((t) => t.value === idType)?.label ?? "ID proof"} · ${docFile.name}`
                : docFile.name,
            },
          ]
        : []),
    ],
    prayer: [
      `The applicant, counsel on record in the above matter, prays that the record of ${litigant.name} be corrected as set out above.`,
      "It is prayed that this Hon'ble Court may allow this application and pass such orders as are deemed fit.",
    ],
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = "The party needs a name on the record.";
    const addressComplete = structuredAddressComplete(address);
    if (!addressComplete) {
      next.address = "Complete the address. Only the building name is optional.";
    }
    if (!changes.length && name.trim() && addressComplete) {
      next.changes = "Nothing has been changed yet.";
    }
    setErrors(next);
    if (next.name || next.changes || next.address) return;
    setStep(2);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestExit();
        }}
      >
        <FlowDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <>
              {/* No stepper: two steps do not earn one. Heading stays put so
                  the review does not read as a different task (owner, Sept 2). */}
              <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
                <DialogTitle className="text-title-s font-semibold text-balance">
                  Edit details for {litigant.name}
                </DialogTitle>
                <DialogDescription>
                  {step === 1
                    ? "Correct what the record holds about this party. The application goes to the magistrate."
                    : "Review the application, then continue to sign it."}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <form
                  id="edit-litigant-form"
                  noValidate
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-6"
                >
                  {step === 1 ? (
                    <>
                      <Field data-invalid={Boolean(errors.name)}>
                        <FieldLabel
                          className="block w-full text-body font-semibold leading-snug"
                          htmlFor="edit-litigant-name"
                        >
                          Name
                        </FieldLabel>
                        <Input
                          id="edit-litigant-name"
                          value={name}
                          onChange={(event) => {
                            setName(event.target.value);
                            setErrors((c) => ({
                              ...c,
                              name: undefined,
                              changes: undefined,
                            }));
                          }}
                        />
                        <FieldError>{errors.name}</FieldError>
                      </Field>

                      {isEntity ? (
                        <Field>
                          <FieldLabel
                            className="block w-full text-body font-semibold leading-snug"
                            htmlFor="edit-litigant-rep"
                          >
                            Represented by
                          </FieldLabel>
                          <FieldDescription>
                            The person who speaks for the entity in this case.
                          </FieldDescription>
                          <Input
                            id="edit-litigant-rep"
                            value={representative}
                            onChange={(event) => {
                              setRepresentative(event.target.value);
                              setErrors((c) => ({ ...c, changes: undefined }));
                            }}
                          />
                        </Field>
                      ) : null}

                      <Field>
                        <FieldLabel
                          className="block w-full text-body font-semibold leading-snug"
                          htmlFor="edit-litigant-mobile"
                        >
                          Mobile number
                        </FieldLabel>
                        <FieldDescription>
                          The number this party signs in with. It cannot be
                          changed by an application.
                        </FieldDescription>
                        <Input
                          id="edit-litigant-mobile"
                          value={recordMobile}
                          disabled
                          readOnly
                          className="tabular-nums"
                        />
                      </Field>

                      {/* The app's one structured address grammar,
                          pre-filled from the record. */}
                      <div className="flex flex-col gap-3">
                        <p className="text-body font-semibold leading-snug">
                          Address
                        </p>
                        <StructuredAddressFields
                          idPrefix="edit-litigant-addr"
                          value={address}
                          onChange={(next) => {
                            setAddress(next);
                            setErrors((c) => ({
                              ...c,
                              changes: undefined,
                              address: undefined,
                            }));
                          }}
                        />
                        {errors.address ? (
                          <p className="text-body-compact text-destructive-ink">
                            {errors.address}
                          </p>
                        ) : null}
                      </div>

                      {errors.changes ? (
                        <p className="text-body-compact text-destructive-ink">
                          {errors.changes}
                        </p>
                      ) : null}

                      <Field>
                        <FieldLabel
                          className="block w-full text-body font-semibold leading-snug"
                          htmlFor="edit-litigant-id-type"
                        >
                          {recordId && !replacingId
                            ? "ID proof"
                            : "ID proof (optional)"}
                        </FieldLabel>
                        {recordId && !replacingId ? (
                          <>
                            {/* The ID the party already submitted — empty
                                only when the record holds none. The same
                                Attachment grammar every upload wears:
                                thumbnail opening the full viewer, so the
                                person can SEE which ID is on record.
                                Replaceable, never removable: a record doc
                                is not this dialog's to delete. */}
                            <FieldDescription>
                              The ID on record for this party.
                            </FieldDescription>
                            <Attachment className="w-full">
                              <AttachmentMedia className="w-14">
                                <DocumentThumbnailButton
                                  file={RECORD_ID_DOC}
                                  url={RECORD_ID_URL}
                                  locale="en"
                                  onOpen={() => setIdPreviewOpen(true)}
                                  className="size-full rounded-md"
                                />
                              </AttachmentMedia>
                              <AttachmentContent>
                                <AttachmentTitle>
                                  {recordId.typeLabel}
                                </AttachmentTitle>
                                <AttachmentDescription>
                                  {recordId.fileName}
                                </AttachmentDescription>
                              </AttachmentContent>
                              <AttachmentActions className="gap-4 pr-2">
                                <Button
                                  type="button"
                                  variant="link"
                                  className="h-auto p-0"
                                  onClick={() => setReplacingId(true)}
                                >
                                  Replace
                                </Button>
                              </AttachmentActions>
                            </Attachment>
                            <DocumentPreviewDialog
                              open={idPreviewOpen}
                              onOpenChange={setIdPreviewOpen}
                              file={RECORD_ID_DOC}
                              url={RECORD_ID_URL}
                              locale="en"
                              copy={{
                                title: `${recordId.typeLabel} on record`,
                                description:
                                  "The ID this party submitted to the court.",
                                alt: recordId.typeLabel,
                              }}
                            />
                          </>
                        ) : (
                          <>
                            <FieldDescription>
                              An official ID that shows the corrected detail.
                            </FieldDescription>
                            <Select value={idType} onValueChange={setIdType}>
                              <SelectTrigger
                                id="edit-litigant-id-type"
                                className="w-full"
                              >
                                <SelectValue placeholder="Type of ID" />
                              </SelectTrigger>
                              <SelectContent>
                                {ID_TYPES.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <UploadedDocField
                              label="ID proof"
                              file={docFile}
                              onFileChange={setDocFile}
                            />
                            <FieldDescription>{UPLOAD_HELP}</FieldDescription>
                            {recordId ? (
                              <div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setReplacingId(false);
                                    setIdType(undefined);
                                    setDocFile(null);
                                  }}
                                >
                                  Keep the ID on record
                                </Button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </Field>
                    </>
                  ) : (
                    <PartyApplicationDocument
                      caseRef={caseRef}
                      doc={applicationDoc}
                    />
                  )}
                </form>
              </div>

              <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                {step > 1 ? (
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                ) : (
                  <span aria-hidden className="hidden sm:block" />
                )}
                {step === 1 ? (
                  <Button type="submit" form="edit-litigant-form">
                    Continue
                  </Button>
                ) : (
                  <Button type="button" onClick={() => setSignOpen(true)}>
                    Continue to sign
                  </Button>
                )}
              </footer>
            </>
        </FlowDialogContent>
      </Dialog>

      <PartySignatureDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onComplete={() => {
          onRequested?.();
          closeClean();
        }}
        confirmation={{
          title: "Application sent to the magistrate",
          description: `The record for ${litigant.name} stays as it is until the order is passed.`,
        }}
      />

      <AlertDialog
        open={exitConfirmationOpen}
        onOpenChange={setExitConfirmationOpen}
      >
        <ChromeAlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this application?</AlertDialogTitle>
            <AlertDialogDescription>
              The details entered here will be lost if you discard this draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive-solid" onClick={closeClean}>
              Discard draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </ChromeAlertDialogContent>
      </AlertDialog>
    </>
  );
}

