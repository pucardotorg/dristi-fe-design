"use client";

/**
 * Add witnesses — scenario 9 of the party-actions spec, rebuilt Sept 2 on
 * the e-filing Witnesses section (PM's reference; the earlier dialog was a
 * stale copy of a legacy form). Same questions, same controls, reused
 * directly from the filing kit:
 *
 * - identity is name OR designation either side of an OR rule, with age
 *   and "what will this witness prove" beside it;
 * - contact rows are mobile + email with Add more, both optional, the marker
 *   on each field rather than the section head;
 * - ADDRESSES ARE MANDATORY (at least one complete, police station
 *   included) — "the court tries every address listed here";
 * - documents are a standard optional upload, not description boxes;
 * - multiple witnesses ride adjacent tabs, the filing section's own
 *   SectionTabs (a single scrolling row, so a long list never overruns).
 *
 * Two steps in one modal that never changes width or heading (owner, Sept 2):
 * details, then review — the generated application on the review step. Signing
 * is a small dialog OVER this one, so a failed signature leaves the review
 * untouched underneath.
 */

import { useMemo, useRef, useState } from "react";

import { DiscardQuestion, useDiscardGuard } from "@/components/chrome/discard-guard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldSeparator } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { TextField } from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import { AddressBlockList, ContactList } from "@/components/filing/repeat-lists";
import { SectionTabs } from "@/components/filing/section-tabs";
import { FileField } from "@/components/cases/filing-form-shared";
import {
  PartyApplicationDocument,
  PartySignatureDialog,
  type CaseRef,
} from "@/components/cases/party-application";
import { usePartiesLive } from "@/components/cases/parties-live";
import { FlowDialogContent } from "@/components/chrome/flow-dialog";
import { blankWitness } from "@/lib/filing/blank";
import { witnessComplete } from "@/lib/filing/selectors";
import type { AddressBlock, Witness } from "@/lib/filing/types";

/** The filing witness, plus this flow's optional document uploads. */
type DialogWitness = Witness & { docs: File[] };

function newWitness(): DialogWitness {
  return { ...blankWitness(), docs: [] };
}

/** The PM's rule: at least one address, complete to the police station. */
function addressComplete(block: AddressBlock): boolean {
  const { line1, city, pin, district, state } = block.addr;
  return Boolean(
    line1.trim() &&
      city.trim() &&
      pin.trim() &&
      district.trim() &&
      state.trim() &&
      block.police.trim()
  );
}

/** Anything typed into a block: the blank witness starts with one empty address and one
    empty contact, which are not an entry. */
function hasText(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some(hasText);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, part]) => key !== "id" && hasText(part));
  }
  return false;
}

function witnessReady(w: DialogWitness): boolean {
  return witnessComplete(w) && w.addresses.some(addressComplete);
}

/** "Ramesh Nair" or the designation, for tabs, review rows and the paper. */
function witnessIdentity(w: DialogWitness): string {
  return w.fullName.trim() || w.designation.trim();
}

export function AddWitnessDialog({
  open,
  onOpenChange,
  caseRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseRef: CaseRef;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [witnesses, setWitnesses] = useState<DialogWitness[]>(() => [
    newWitness(),
  ]);
  const [activeId, setActiveId] = useState(() => witnesses[0].id);
  const [error, setError] = useState<string | undefined>(undefined);
  const [filesErrors, setFilesErrors] = useState<Record<string, string>>({});
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeNumber, setRemoveNumber] = useState(1);
  const [signOpen, setSignOpen] = useState(false);
  const formScrollRef = useRef<HTMLDivElement>(null);
  /* Null outside the Parties tab (the dialog has other hosts). */
  const live = usePartiesLive();

  const found = witnesses.findIndex((w) => w.id === activeId);
  const index = found >= 0 ? found : witnesses.length - 1;
  const w = witnesses[index];

  const isDirty = useMemo(
    () =>
      witnesses.length > 1 ||
      witnessComplete(witnesses[0]) ||
      witnesses[0].addresses.some(hasText) ||
      witnesses[0].contacts.some(hasText) ||
      witnesses[0].docs.length > 0 ||
      Boolean(witnesses[0].age || witnesses[0].prove),
    [witnesses]
  );

  function setField<K extends keyof DialogWitness>(
    key: K,
    value: DialogWitness[K]
  ) {
    setWitnesses((current) =>
      current.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    );
    setError(undefined);
  }

  function addWitness() {
    const created = newWitness();
    setWitnesses((current) => [...current, created]);
    setActiveId(created.id);
  }

  function askRemove(id: string) {
    const i = witnesses.findIndex((item) => item.id === id);
    if (i < 0 || witnesses.length <= 1) return;
    setRemoveNumber(i + 1);
    setRemoveId(id);
  }

  function confirmRemove() {
    const i = removeId
      ? witnesses.findIndex((item) => item.id === removeId)
      : -1;
    if (i < 0 || witnesses.length <= 1) {
      setRemoveId(null);
      return;
    }
    const fallback = witnesses[i + 1] ?? witnesses[i - 1];
    setWitnesses((current) => current.filter((item) => item.id !== removeId));
    if (removeId === activeId && fallback) setActiveId(fallback.id);
    setRemoveId(null);
  }

  function resetForm() {
    const first = newWitness();
    setStep(1);
    setWitnesses([first]);
    setActiveId(first.id);
    setError(undefined);
    setFilesErrors({});
    setRemoveId(null);
    setSignOpen(false);
  }

  function closeClean() {
    resetForm();
    onOpenChange(false);
  }

  const guard = useDiscardGuard(isDirty, closeClean);

  function requestExit() {
    guard.close();
  }

  function continueToReview() {
    const missing = witnesses.findIndex((item) => !witnessReady(item));
    if (missing >= 0) {
      setActiveId(witnesses[missing].id);
      setError(
        witnessComplete(witnesses[missing])
          ? `Witness ${missing + 1} needs at least one complete address, police station included.`
          : `Witness ${missing + 1} needs a name or a designation.`
      );
      // Surface the error where the action is — the notice sits at the top of
      // the scroll region, so bring it into view.
      formScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStep(2);
  }

  /** The generated application, from what was filled in. */
  const applicationDoc = {
    matter:
      witnesses.length === 1
        ? "Application for the addition of a witness"
        : "Application for the addition of witnesses",
    facts: witnesses.map((wit, i) => ({
      term: `Witness ${i + 1}`,
      value: `${witnessIdentity(wit)}${
        wit.prove.trim() ? ` — to prove: ${wit.prove.trim()}` : ""
      }`,
    })),
    prayer: [
      `The applicant, counsel on record in the above matter, prays that the ${
        witnesses.length === 1 ? "witness" : "witnesses"
      } named above be added to the case and summoned at the addresses on record.`,
      "It is prayed that this Hon'ble Court may allow this application and pass such orders as are deemed fit.",
    ],
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else requestExit();
        }}
      >
        <FlowDialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 gap-1.5 border-b border-hairline px-6 py-5 pr-14 text-left">
            <DialogTitle className="text-title-s font-semibold text-balance">
              Add witnesses
            </DialogTitle>
            <DialogDescription>
              {step === 1
                ? "List the witnesses you intend to rely on, and how the court can reach them."
                : "Review the application, then continue to sign it."}
            </DialogDescription>
          </DialogHeader>

          <div
            ref={formScrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
          >
            {step === 1 ? (
              <div className="flex flex-col gap-6">
                {error ? (
                  <SectionNotice variant="destructive" announce="assertive">
                    {error}
                  </SectionNotice>
                ) : null}

                <SectionTabs
                  tabs={witnesses.map((wit, i) => ({
                    id: wit.id,
                    label: `Witness ${i + 1}`,
                    status: witnessReady(wit) ? "complete" : "attention",
                    removable: witnesses.length > 1,
                  }))}
                  activeId={w.id}
                  onSelect={setActiveId}
                  onRemove={askRemove}
                  addLabel="Add witness"
                  onAdd={addWitness}
                />

                <section className="flex flex-col gap-4">
                  <h3 className="text-body font-semibold leading-snug">
                    Witness {index + 1}
                  </h3>
                  <FormField
                    asGroup
                    label="How is this witness identified?"
                    required
                    // One line on purpose: the DS description balances its
                    // lines, so two-line help breaks mid-phrase.
                    help="Their full name, or their designation if you only know the office they hold."
                    helpPlacement="above"
                  >
                    <div className="flex flex-col gap-4">
                      <FormField label="Full name">
                        <TextField
                          value={w.fullName}
                          onChange={(v) => setField("fullName", v)}
                          placeholder="e.g. Ramesh Nair"
                          autoComplete="off"
                        />
                      </FormField>

                      <FieldSeparator>OR</FieldSeparator>

                      <FormField label="Designation">
                        <TextField
                          value={w.designation}
                          onChange={(v) => setField("designation", v)}
                          placeholder="e.g. Bank Manager, SBI Sector 17"
                          autoComplete="off"
                        />
                      </FormField>
                    </div>
                  </FormField>

                  <HalfWidth>
                    <FormField label="Age" optional>
                      <TextField
                        value={w.age}
                        onChange={(v) => setField("age", v)}
                        placeholder="e.g. 42"
                        inputMode="numeric"
                      />
                    </FormField>
                  </HalfWidth>

                  <FormField label="What will this witness prove?" optional>
                    <Textarea
                      value={w.prove}
                      onChange={(e) => setField("prove", e.target.value)}
                      placeholder="e.g. Confirms the cheque was handed over on 4 March"
                    />
                  </FormField>
                </section>

                <Separator />

                <section className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-body font-semibold leading-snug">
                      Contact details
                    </h3>
                    <p className="text-body-compact text-muted-foreground">
                      Where the court can reach this witness.
                    </p>
                  </div>
                  <ContactList
                    contacts={w.contacts}
                    onChange={(contacts) => setField("contacts", contacts)}
                    addLabel="Add more"
                    emailLabel="Email ID"
                    mobilePlaceholder="Enter mobile number"
                    emailPlaceholder="ex: xyz@gmail.com"
                    optional
                  />
                </section>

                <Separator />

                <section className="flex flex-col gap-4">
                  <h3 className="text-body font-semibold leading-snug">
                    Address details
                  </h3>
                  <SectionNotice variant="info">
                    The court tries every address listed here.
                  </SectionNotice>
                  <AddressBlockList
                    blocks={w.addresses}
                    onChange={(addresses) => setField("addresses", addresses)}
                    addLabel="Add address"
                  />
                </section>

                <Separator />

                <FileField
                  label="Documents to be presented"
                  description="Documents this witness will present to the court."
                  files={w.docs}
                  error={filesErrors[w.id]}
                  onFilesChange={(docs) => setField("docs", docs)}
                  onErrorChange={(message) =>
                    setFilesErrors((current) => ({
                      ...current,
                      [w.id]: message ?? "",
                    }))
                  }
                />
              </div>
            ) : (
              <PartyApplicationDocument caseRef={caseRef} doc={applicationDoc} />
            )}
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-hairline px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {step === 2 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
            ) : (
              <span aria-hidden className="hidden sm:block" />
            )}
            {step === 1 ? (
              <Button type="button" onClick={continueToReview}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={() => setSignOpen(true)}>
                Continue to sign
              </Button>
            )}
          </footer>
          <DiscardQuestion guard={guard} />
        </FlowDialogContent>
      </Dialog>

      <PartySignatureDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onComplete={() => {
          /* The application is out — the Witnesses group shows each name
             greyed, "Awaiting order", so the register never reads as if
             the flow lost the application. */
          live?.addWitnesses(
            witnesses.map(witnessIdentity).filter(Boolean)
          );
          closeClean();
        }}
        confirmation={{
          title: "Application sent to the magistrate",
          description:
            witnesses.length === 1
              ? "The witness is added to the case once the order is passed."
              : "The witnesses are added to the case once the order is passed.",
        }}
      />

      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRemoveId(null);
        }}
        title={`Remove witness ${removeNumber}`}
        description="Are you sure you want to delete this witness and all their details? This cannot be undone."
        confirmLabel="Yes, remove"
        onConfirm={confirmRemove}
      />
    </>
  );
}
