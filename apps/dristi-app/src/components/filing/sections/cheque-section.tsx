"use client";

/**
 * Cheque & return memo — the dishonoured cheque(s) and the bank's memo for each.
 *
 * Most values arrive machine-read from the uploaded cheque and memo: they keep the amber
 * prefilled fill until the person edits them, and clicking one opens that upload beside the
 * form with the read region highlighted. Correcting a value from that panel (or typing over
 * it) clears the marker. The IFSC is looked up against the public registry — a code that
 * isn't found, or a registry that can't be reached, leaves the bank fields to be typed.
 */

import * as React from "react";
import { CreditCardIcon } from "lucide-react";

import { blankCheque, removeCaseRecord } from "@/lib/filing/blank";
import { getRepository } from "@/lib/filing/data";
import { forgetFile } from "@/lib/filing/files";
import { fromDisplayDate, toDisplayDate } from "@/lib/filing/format";
import type { IfscResult } from "@/lib/filing/lookups";
import { RETURN_REASONS, S138_SAFE_REASONS } from "@/lib/filing/options";
import {
  chequeComplete,
  chequePresentIssue,
  chequePresentedLate,
  chequeReturnIssue,
  chequeSourceSlot,
  firstReadField,
} from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import type { ChequeField } from "@/lib/filing/types";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { DateField } from "@/components/filing/date-field";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import {
  FormCard,
  FormDivider,
  FormRow,
  FormSubhead,
  HalfWidth,
} from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import {
  CorrectionInstance,
  useCorrectionInstanceRequest,
} from "@/components/filing/posture";
import { IfscField } from "@/components/filing/ifsc-field";
import { OptionSelect, PrefixInput, TextField } from "@/components/filing/inputs";
import { InfoWell, SectionNotice } from "@/components/filing/notices";
import { PrefillNotice } from "@/components/filing/prefill-notice";
import { SectionTabs } from "@/components/filing/section-tabs";
import { YesNoSegmented } from "@/components/filing/segmented";
import {
  SourcePanel,
  ViewSourceButton,
  regionFromBox,
  useSourceOpenState,
} from "@/components/filing/source-panel";

/** Panel heading for each machine-read field. */
const FIELD_LABELS: Record<ChequeField, string> = {
  dateOnCheque: "Date on cheque",
  amount: "Amount",
  chequeNumber: "Cheque number",
  ifsc: "IFSC code",
  bankName: "Bank name",
  bankBranch: "Bank branch",
  presentDate: "Date of presentation",
  returnDate: "Date of return",
  returnReason: "Return reason",
};

const ALL_FIELDS = Object.keys(FIELD_LABELS) as ChequeField[];

/** Fields read off the cheque leaf; the rest come from the return memo. */
const CHEQUE_FIELDS: ChequeField[] = [
  "dateOnCheque",
  "amount",
  "chequeNumber",
  "ifsc",
  "bankName",
  "bankBranch",
];

const DATE_FIELDS: ChequeField[] = [
  "dateOnCheque",
  "presentDate",
  "returnDate",
];

/** Fields read off the return memo, in the order the panel prefers to land on them. */
const MEMO_FIELDS: ChequeField[] = [
  "returnDate",
  "returnReason",
  "presentDate",
];

/** Where a chip lands when reading found nothing on that document at all. */
const CHEQUE_FALLBACK: ChequeField = "dateOnCheque";
const MEMO_FALLBACK: ChequeField = "returnDate";

/** Tab ids are cheque ids; `null` when a stale id arrives after a removal. */
function indexOfId(cheques: { id: string }[], id: string): number | null {
  const i = cheques.findIndex((c) => c.id === id);
  return i >= 0 ? i : null;
}

/**
 * The return reason is stored as an option value; the source panel is citizen-facing, so
 * it shows and accepts the reason as written on the memo, never the stored code.
 */
function reasonLabel(value: string): string {
  return RETURN_REASONS.find((o) => o.value === value)?.label ?? value;
}

function reasonValue(label: string): string {
  const hit = RETURN_REASONS.find(
    (o) => o.label.toLowerCase() === label.trim().toLowerCase()
  );
  return hit ? hit.value : "";
}

export function ChequeSection() {
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("cheque");
  const cheques = draft.cheques;

  const [active, setActive] = React.useState(0);
  // Kept apart from `removeOpen` so the dialog keeps its wording while it fades out.
  const [removeIndex, setRemoveIndex] = React.useState(0);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  /**
   * The source rail is a column beside the form from `xl` up, so it starts expanded
   * there as in the demo; collapsed, it stays in the layout as a strip. Below that it
   * is a sheet over the form — opened on request (a prefilled field, or "View source
   * document") rather than covering the screen on arrival.
   */
  const [sourceOpen, setSourceOpen] = useSourceOpenState();
  /**
   * `null` until the person picks a field, so the panel follows what reading actually
   * found rather than opening on a fixed field that may be empty. Their choice wins from
   * the moment they make one.
   */
  const [chosenField, setChosenField] = React.useState<ChequeField | null>(null);
  /**
   * Whether the rail is answering "where did *this field* come from?" or simply showing
   * a document. A field entry point is a question about that field; a document chip is a
   * question about the document, and the header follows whichever was asked.
   */
  const [explaining, setExplaining] = React.useState(false);
  /**
   * What the panel's value box shows while it is being retyped — a half-typed date reads
   * back as "" from the draft, so keep the keystrokes here. Tagged with the field it
   * belongs to so switching cheque or field falls back to the stored value.
   */
  const [sourceEdit, setSourceEdit] = React.useState<{
    key: string;
    text: string;
  } | null>(null);

  const index = Math.min(active, cheques.length - 1);
  const cheque = cheques[index];

  /* A scrutiny defect on "Cheque 2 › Bank branch" selects that tab before it takes focus. */
  useCorrectionInstanceRequest("cheque", setActive);

  const frontSlot = chequeSourceSlot(draft, index, "cheque-front");
  const memoSlot = chequeSourceSlot(draft, index, "return-memo");
  /** The field each document opens on: the first one reading found there. */
  const chequeEntry = firstReadField(frontSlot, CHEQUE_FIELDS, CHEQUE_FALLBACK);
  const memoEntry = firstReadField(memoSlot, MEMO_FIELDS, MEMO_FALLBACK);
  const sourceField = chosenField ?? chequeEntry;

  /* Nothing uploaded for this cheque means there is no source document to show at all. */
  const sourceDocs = [
    { slot: frontSlot, entry: chequeEntry, fallbackLabel: "Cheque (front side)" },
    { slot: memoSlot, entry: memoEntry, fallbackLabel: "Cheque return memo" },
  ].filter((d) => d.slot?.file);

  const sourceKey = `${cheque.id}:${sourceField}`;
  const sourceText = sourceEdit?.key === sourceKey ? sourceEdit.text : null;

  /** Machine-read, still unverified — the amber fill and the "click to see source" affordance. */
  const isPrefilled = (key: ChequeField) =>
    !!cheque.prefilled[key] && !cheque.edited[key] && !!cheque[key];

  /** Something on this cheque is still waiting to be checked. */
  const anyPrefilled = ALL_FIELDS.some(isPrefilled);

  /** A person supplied this value: keep it and clear the machine-read marker. */
  const editField = (key: ChequeField, value: string) =>
    update((d) => {
      d.cheques[index][key] = value;
      d.cheques[index].edited[key] = true;
    });

  /** Retyping the code invalidates whatever the last lookup filled from it. */
  const editIfsc = (value: string) =>
    update((d) => {
      d.cheques[index].ifsc = value;
      d.cheques[index].edited.ifsc = true;
      d.cheques[index].ifscFetched = false;
    });

  const openSource = (field: ChequeField) => {
    setChosenField(field);
    setExplaining(true);
    setSourceOpen(true);
  };

  /** The registry answered — written by cheque id, since tabs can change mid-lookup. */
  const fillFromIfsc = (id: string) => (hit: IfscResult) =>
    update((d) => {
      const c = d.cheques.find((x) => x.id === id);
      if (!c) return;
      c.ifsc = hit.ifsc;
      c.bankName = hit.bank;
      c.bankBranch = hit.branch;
      c.edited.bankName = true;
      c.edited.bankBranch = true;
      c.ifscFetched = true;
    });

  const addCheque = () => {
    update((d) => {
      d.cheques.push(blankCheque());
    });
    setActive(cheques.length);
  };

  const askRemove = (id: string) => {
    const i = indexOfId(cheques, id);
    if (i === null || cheques.length <= 1) return;
    setRemoveIndex(i);
    setRemoveOpen(true);
  };

  const confirmRemove = () => {
    const i = removeIndex;
    setRemoveOpen(false);
    if (cheques.length <= 1) return;
    // Its upload group goes with it, so the list of documents stops asking for it.
    let files: ReturnType<typeof removeCaseRecord> = [];
    update((d) => {
      files = removeCaseRecord(d, "cheque", i);
    });
    for (const f of files) {
      forgetFile(f.id);
      void getRepository().deleteFile(f.id);
    }
    const remaining = cheques.length - 1;
    let a = index;
    if (i < a) a -= 1;
    if (a >= remaining) a = remaining - 1;
    setActive(Math.max(0, a));
  };

  const showBankFields = index === 0 || cheque.sameAsPrev === "no";
  const showInheritNote = index > 0 && cheque.sameAsPrev === "yes";
  const previous = index > 0 ? cheques[index - 1] : null;
  const inheritedBank = previous?.bankName || "previous cheque";
  const presentedLate = chequePresentedLate(cheque);
  const reasonNeedsCheck =
    !!cheque.returnReason && !S138_SAFE_REASONS.has(cheque.returnReason);

  // Source panel — which upload, which region, and the value we read there. The two
  // documents behind this cheque come from intake; either may not be uploaded yet.
  const fromCheque = CHEQUE_FIELDS.includes(sourceField);
  const sourceSlot = (explaining ? [frontSlot, memoSlot].find((slot) => slot?.extract?.fields[sourceField]?.value === cheque[sourceField]) : undefined) ?? (fromCheque ? frontSlot : memoSlot);
  /** The document in the rail — the rail's subject until a field is asked about. */
  const sourceDocLabel =
    sourceSlot?.label ?? (fromCheque ? "Cheque (front side)" : "Cheque return memo");
  const isDateSource = DATE_FIELDS.includes(sourceField);
  const storedValue = isDateSource
    ? toDisplayDate(cheque[sourceField])
    : sourceField === "returnReason"
      ? reasonLabel(cheque.returnReason)
      : cheque[sourceField];
  const sourceValue = sourceText ?? storedValue;
  const setSourceValue = (v: string) => {
    setSourceEdit({ key: sourceKey, text: v });
    if (isDateSource) editField(sourceField, fromDisplayDate(v));
    else if (sourceField === "returnReason") editField(sourceField, reasonValue(v));
    // A corrected code retires the last lookup, exactly as retyping the field would.
    else if (sourceField === "ifsc") editIfsc(v.toUpperCase());
    else editField(sourceField, v);
  };

  return (
    <>
      <FilingMain sourceOpen={sourceOpen}>
        <FilingPageHeader
          title="Cheque & return memo"
          description="Add the dishonoured cheque(s) and the bank's return memo for each."
        />

        <SectionTabs
          tabs={cheques.map((c, i) => ({
            id: c.id,
            label: `Cheque ${i + 1}`,
            meta: c.amount ? `₹${c.amount}` : undefined,
            status: chequeComplete(c) ? "complete" : "attention",
            removable: cheques.length > 1,
          }))}
          activeId={cheque.id}
          onSelect={(id) => setActive(indexOfId(cheques, id) ?? index)}
          onRemove={askRemove}
          addLabel="Add cheque"
          onAdd={addCheque}
          trailing={
            !sourceOpen ? (
              <ViewSourceButton onClick={() => { setExplaining(false); setSourceOpen(true); }} />
            ) : null
          }
        />

        <PrefillNotice show={anyPrefilled} />

        <CorrectionInstance value={index}>
        {/* Cheque leaf */}
        <FormCard
          title={`Cheque ${index + 1} details`}
          description="As written on the cheque leaf."
        >
          <FormRow>
            <FormField label="Date on cheque" name="dateOnCheque" required tip="As written on the cheque.">
              <DateField
                value={cheque.dateOnCheque}
                onChange={(v) => editField("dateOnCheque", v)}
                prefilled={isPrefilled("dateOnCheque")}
                onViewSource={() => openSource("dateOnCheque")}
                ariaLabel="Date on cheque"
              />
            </FormField>
            <FormField label="Amount" name="amount" required tip="As written on the cheque.">
              <PrefixInput
                prefix="₹"
                value={cheque.amount}
                onChange={(v) => editField("amount", v)}
                prefilled={isPrefilled("amount")}
                onViewSource={() => openSource("amount")}
                placeholder="Enter amount"
                inputMode="numeric"
              />
            </FormField>
          </FormRow>

          <HalfWidth>
            <FormField
              label="Cheque number"
              name="chequeNumber"
              required
              tip="First set of six digits printed at the bottom of the cheque."
              help="The six-digit number, not the full MICR line."
            >
              <TextField
                value={cheque.chequeNumber}
                onChange={(v) => editField("chequeNumber", v)}
                prefilled={isPrefilled("chequeNumber")}
                onViewSource={() => openSource("chequeNumber")}
                placeholder="6-digit number"
                inputMode="numeric"
              />
            </FormField>
          </HalfWidth>

          {index > 0 ? (
            <>
              <FormDivider />
              <FormField asGroup label="Are the bank details below the same as the previous cheque?">
                <YesNoSegmented
                  value={cheque.sameAsPrev}
                  onValueChange={(v) =>
                    update((d) => {
                      d.cheques[index].sameAsPrev = v;
                    })
                  }
                  ariaLabel="Are the bank details the same as the previous cheque?"
                />
              </FormField>
            </>
          ) : null}

          {showBankFields ? (
            <>
              <FormSubhead>Drawer&apos;s bank details</FormSubhead>
              {/* Keyed to the cheque so a lookup on one tab never speaks for another. */}
              <IfscField
                key={cheque.id}
                value={cheque.ifsc}
                onChange={editIfsc}
                onFetched={fillFromIfsc(cheque.id)}
                fetched={cheque.ifscFetched}
                tip="The 11-character code on the cheque. Fetch to auto-fill the bank name and branch."
                placeholder="e.g. SBIN0001234"
                prefilled={isPrefilled("ifsc")}
                onViewSource={() => openSource("ifsc")}
              />
              <FormRow>
                <FormField
                  label="Bank name"
                  name="bankName"
                  required
                  tip="The bank written on the cheque, i.e. the drawer's (accused's) bank."
                >
                  <TextField
                    value={cheque.bankName}
                    onChange={(v) => editField("bankName", v)}
                    prefilled={isPrefilled("bankName")}
                    onViewSource={() => openSource("bankName")}
                    placeholder="Drawer's bank"
                  />
                </FormField>
                <FormField
                  label="Bank branch"
                  name="bankBranch"
                  required
                  tip="The branch written on the cheque, i.e. the drawer's (accused's) branch."
                >
                  <TextField
                    value={cheque.bankBranch}
                    onChange={(v) => editField("bankBranch", v)}
                    prefilled={isPrefilled("bankBranch")}
                    onViewSource={() => openSource("bankBranch")}
                    placeholder="Branch name"
                  />
                </FormField>
              </FormRow>
            </>
          ) : null}

          {showInheritNote ? (
            <InfoWell>
              <CreditCardIcon className="size-5 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-body">
                Using bank details from Cheque {index}:{" "}
                <span className="font-semibold">{inheritedBank}</span>
                {previous?.bankBranch ? `, ${previous.bankBranch}` : ""}.
              </p>
            </InfoWell>
          ) : null}
        </FormCard>

        {/* Return memo */}
        <FormCard
          title="Cheque return memo details"
          description="From the memo the bank issued when the cheque was dishonoured."
        >
          <FormRow>
            <FormField
              label="Date of presentation / deposit"
              name="presentDate"
              required
              tip="Date on which the cheque was presented in the bank for clearance."
              error={chequePresentIssue(cheque)}
            >
              <DateField
                value={cheque.presentDate}
                onChange={(v) => editField("presentDate", v)}
                prefilled={isPrefilled("presentDate")}
                onViewSource={() => openSource("presentDate")}
                ariaLabel="Date of presentation or deposit"
              />
            </FormField>
            <FormField
              label="Date of return"
              name="returnDate"
              required
              tip="Date on which the cheque was dishonoured / returned, as written on the return memo."
              error={chequeReturnIssue(cheque)}
            >
              <DateField
                value={cheque.returnDate}
                onChange={(v) => editField("returnDate", v)}
                prefilled={isPrefilled("returnDate")}
                onViewSource={() => openSource("returnDate")}
                ariaLabel="Date of return"
              />
            </FormField>
          </FormRow>

          {presentedLate ? (
            <SectionNotice variant="warning">{presentedLate}</SectionNotice>
          ) : null}

          <HalfWidth>
            <FormField
              label="Return reason"
              name="returnReason"
              required
              tip="Reason for return of the cheque, as per the return memo."
            >
              <OptionSelect
                value={cheque.returnReason}
                onValueChange={(v) => editField("returnReason", v)}
                options={RETURN_REASONS}
                placeholder="Select reason"
                prefilled={isPrefilled("returnReason")}
                onViewSource={() => openSource("returnReason")}
                ariaLabel="Return reason"
              />
            </FormField>
          </HalfWidth>

          {reasonNeedsCheck ? (
            <SectionNotice variant="warning" title="Check that S-138 still applies">
              Section 138 is squarely attracted when a cheque is returned for{" "}
              <span className="font-semibold">insufficiency of funds</span> (or because it
              exceeds the arrangement). For other return reasons, confirm the dishonour
              still falls within S-138 before filing.
            </SectionNotice>
          ) : null}

        </FormCard>
        </CorrectionInstance>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        continueHref={next ? hrefFor(next) : undefined}
      />

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove cheque ${removeIndex + 1}`}
        description="Are you sure you want to delete the details of this cheque? This also removes its return memo details and any documents added for it."
        confirmLabel="Yes, remove"
        onConfirm={confirmRemove}
      />

      <SourcePanel
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        title={sourceDocLabel}
        field={explaining ? FIELD_LABELS[sourceField] : undefined}
        value={sourceValue}
        onValueChange={setSourceValue}
        chips={sourceDocs.map((d) => ({
          label: d.slot?.file?.name ?? d.slot?.label ?? d.fallbackLabel,
          active: d.slot === sourceSlot,
          onClick: () => {
            setChosenField(d.entry);
            setExplaining(false);
          },
        }))}
        file={sourceSlot?.file ?? null}
        uploadHref={hrefFor("upload")}
        imageAlt={fromCheque ? "Uploaded cheque" : "Uploaded cheque return memo"}
        region={regionFromBox(
          sourceSlot?.extract?.fields[sourceField]?.box,
          sourceSlot?.extract?.page
        )}
        note="Shown from your uploaded document."
      />
    </>
  );
}
