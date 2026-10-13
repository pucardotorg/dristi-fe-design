"use client";

/**
 * Demand notice & debt — the statutory notice and the debt the cheque was meant to clear.
 *
 * The dispatch date is read from the uploaded notice (or the postal receipt behind it), the
 * tracking number and mode of service from that receipt, and the delivery date from the AD
 * card: a machine-read value carries the amber prefilled fill until the person changes it,
 * and opening one shows the document it came from beside the form with the read region
 * highlighted. Service branches on whether the notice was delivered.
 */

import * as React from "react";

import { blankNotice } from "@/lib/filing/blank";
import { fromDisplayDate, toDisplayDate } from "@/lib/filing/format";
import {
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  NON_DELIVERY_REASONS,
  PAYMENT_STATUS,
  WHY_ISSUED,
} from "@/lib/filing/options";
import {
  chequeSourceSlot,
  firstReadField,
  noticeComplete,
  noticeDispatchIssue,
  noticeServiceIssue,
} from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import type { DemandNotice, NoticeField } from "@/lib/filing/types";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { DateField } from "@/components/filing/date-field";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard, FormDivider, FormRow, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import {
  CorrectionInstance,
  useCorrectionInstanceRequest,
} from "@/components/filing/posture";
import { OptionSelect, PrefixInput, TextField } from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import { PrefillNotice } from "@/components/filing/prefill-notice";
import { SectionTabs } from "@/components/filing/section-tabs";
import { YesNoSegmented } from "@/components/filing/segmented";
import {
  SourcePanel,
  ViewSourceButton,
  regionFromBox,
  useSourceOpenState,
} from "@/components/filing/source-panel";

/**
 * What the source panel can show. Beyond the fields carrying prefill markers
 * (`NoticeField`), the postal receipt and the AD card are worth reading off directly, so
 * the panel addresses them too — via the chips rather than a click on the field.
 */
type SourceField = NoticeField | "tracking" | "modeService" | "deliveryDate";

/** Panel heading for each field the panel can explain. */
const FIELD_LABELS: Record<SourceField, string> = {
  natureDebt: "Nature of debt",
  whyIssued: "Why the cheque was issued",
  dispatchDate: "Date of dispatch of demand notice",
  tracking: "Tracking number",
  modeService: "Mode of service",
  deliveryDate: "Date of delivery",
};

/** Which upload each field is read from, and where a chip lands when it is chosen. */
const DOC_OF_FIELD: Record<SourceField, "demand-notice" | "dispatch-proof" | "delivery-proof"> = {
  natureDebt: "demand-notice",
  whyIssued: "demand-notice",
  dispatchDate: "demand-notice",
  tracking: "dispatch-proof",
  modeService: "dispatch-proof",
  deliveryDate: "delivery-proof",
};

/** Field order per document, and the fallback when reading found nothing there. */
const DOC_FIELDS = {
  "demand-notice": ["dispatchDate", "natureDebt", "whyIssued"],
  "dispatch-proof": ["tracking", "modeService"],
  "delivery-proof": ["deliveryDate"],
} as const satisfies Record<string, readonly SourceField[]>;

const ENTRY_FIELD = {
  "demand-notice": "dispatchDate",
  "dispatch-proof": "tracking",
  "delivery-proof": "deliveryDate",
} as const satisfies Record<string, SourceField>;

/** Chip wording when a notice was added beyond the documents intake asked for. */
const DOC_LABELS = {
  "demand-notice": "Demand notice",
  "dispatch-proof": "Proof of dispatch",
  "delivery-proof": "Proof of delivery",
} as const;

/** Every field on a notice that document reading can fill — the prefill notice's gate. */
const ALL_NOTICE_FIELDS: NoticeField[] = [
  "natureDebt",
  "whyIssued",
  "dispatchDate",
  "tracking",
  "modeService",
  "deliveryDate",
];

/** Tab ids are notice ids; `null` when a stale id arrives after a removal. */
function indexOfId(notices: { id: string }[], id: string): number | null {
  const i = notices.findIndex((n) => n.id === id);
  return i >= 0 ? i : null;
}

export function DemandNoticeSection() {
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("demand-notice");
  const notices = draft.notices;

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
   * `null` until the person picks a field, so the panel lands on something the notice's
   * uploads actually gave up rather than on a fixed field that may be empty.
   */
  const [chosenField, setChosenField] = React.useState<SourceField | null>(null);
  /**
   * Whether the rail is answering "where did *this field* come from?" or simply showing
   * a document. A field entry point is a question about that field; a document chip is a
   * question about the document, and the header follows whichever was asked.
   */
  const [explaining, setExplaining] = React.useState(false);

  const index = Math.min(active, notices.length - 1);
  const notice = notices[index];

  /* A scrutiny defect on "Demand notice 1 › Tracking number" selects that tab first. */
  useCorrectionInstanceRequest("demand-notice", setActive);

  // The three uploads behind this notice; any of them may not be uploaded yet.
  const slots = {
    "demand-notice": chequeSourceSlot(draft, index, "demand-notice"),
    "dispatch-proof": chequeSourceSlot(draft, index, "dispatch-proof"),
    "delivery-proof": chequeSourceSlot(draft, index, "delivery-proof"),
  };

  /** Where the panel lands: the first field any of the three uploads was read for. */
  const entryFieldFor = (doc: keyof typeof DOC_FIELDS): SourceField =>
    firstReadField(slots[doc], DOC_FIELDS[doc], ENTRY_FIELD[doc]);
  const sourceField =
    chosenField ??
    (["demand-notice", "dispatch-proof", "delivery-proof"] as const)
      .map((doc) => ({ doc, field: entryFieldFor(doc) }))
      .find(({ doc, field }) => slots[doc]?.extract?.fields[field]?.value)?.field ??
    ENTRY_FIELD["demand-notice"];

  const set = <K extends keyof DemandNotice>(key: K, value: DemandNotice[K]) =>
    update((d) => {
      d.notices[index][key] = value;
    });

  /** Machine-read, still unverified — the amber fill and the "click to see source" affordance. */
  const isPrefilled = (key: NoticeField) =>
    !!notice.prefilled[key] && !notice.edited[key] && !!notice[key];

  /** Something on this notice is still waiting to be checked. */
  const anyPrefilled = ALL_NOTICE_FIELDS.some(isPrefilled);

  /** A person supplied this value: keep it and clear the machine-read marker. */
  const editField = (key: NoticeField, value: string) =>
    update((d) => {
      d.notices[index][key] = value;
      d.notices[index].edited[key] = true;
    });

  // Text buffer for the panel's date box (dd/mm/yyyy) — commits when it parses.
  const [dispatchText, setDispatchText] = React.useState(() =>
    toDisplayDate(notice.dispatchDate)
  );
  const [dispatchTextKey, setDispatchTextKey] = React.useState(notice.id);
  if (dispatchTextKey !== notice.id) {
    setDispatchTextKey(notice.id);
    setDispatchText(toDisplayDate(notice.dispatchDate));
  }

  const openSource = (field: NoticeField) => {
    setChosenField(field);
    setExplaining(true);
    setSourceOpen(true);
    if (field === "dispatchDate") setDispatchText(toDisplayDate(notice.dispatchDate));
  };

  // The dispatch date is written on the notice itself, but the postal receipt carries it
  // too — fall back to the receipt when the notice was never uploaded.
  const sourceDoc =
    sourceField === "dispatchDate" &&
    !slots["demand-notice"]?.extract?.fields.dispatchDate?.value &&
    slots["dispatch-proof"]?.file
      ? "dispatch-proof"
      : DOC_OF_FIELD[sourceField];
  const sourceSlot = slots[sourceDoc];
  /* Only uploaded documents are offered; with none there is no source rail at all. */
  const uploadedDocs = (Object.keys(slots) as (keyof typeof slots)[]).filter(
    (doc) => slots[doc]?.file
  );

  const addNotice = () => {
    update((d) => {
      d.notices.push(blankNotice());
    });
    setActive(notices.length);
  };

  const askRemove = (id: string) => {
    const i = indexOfId(notices, id);
    if (i === null || notices.length <= 1) return;
    setRemoveIndex(i);
    setRemoveOpen(true);
  };

  const confirmRemove = () => {
    const i = removeIndex;
    setRemoveOpen(false);
    if (notices.length <= 1) return;
    update((d) => {
      d.notices.splice(i, 1);
    });
    const remaining = notices.length - 1;
    let a = index;
    if (i < a) a -= 1;
    if (a >= remaining) a = remaining - 1;
    setActive(Math.max(0, a));
  };

  return (
    <>
      <FilingMain sourceOpen={sourceOpen}>
        <FilingPageHeader
          title="Demand notice & debt"
          description="Details of the statutory demand notice you sent, and the debt the cheque was meant to discharge."
        />

        <SectionTabs
          tabs={notices.map((n, i) => ({
            id: n.id,
            label: `Demand notice ${i + 1}`,
            status: noticeComplete(n) ? "complete" : "attention",
            removable: notices.length > 1,
          }))}
          activeId={notice.id}
          onSelect={(id) => setActive(indexOfId(notices, id) ?? index)}
          onRemove={askRemove}
          addLabel="Add demand notice"
          onAdd={addNotice}
          trailing={
            !sourceOpen ? (
              <ViewSourceButton onClick={() => { setExplaining(false); setSourceOpen(true); }} />
            ) : null
          }
        />

        <PrefillNotice show={anyPrefilled} />

        <CorrectionInstance value={index}>

        <SectionNotice variant="neutral">
          Where several notices went out for one cheque, use the one issued within 30
          days of the return. Add a notice per cheque.
        </SectionNotice>

        {/* What the cheque was meant to discharge */}
        <FormCard
          title="Nature of debt"
          description="The debt or liability the cheque was meant to discharge."
        >
          <FormRow>
            <FormField
              label="Nature of debt or other liability"
              name="natureDebt"
              required
              tip="The legally enforceable debt or liability that existed when the cheque was issued."
            >
              <OptionSelect
                value={notice.natureDebt}
                onValueChange={(v) => editField("natureDebt", v)}
                options={NATURE_OF_DEBT}
                prefilled={isPrefilled("natureDebt")}
                onViewSource={() => openSource("natureDebt")}
                ariaLabel="Nature of debt or other liability"
              />
            </FormField>
            <FormField
              label="Why was the cheque issued?"
              required
              tip="The purpose for which the accused handed over the cheque."
            >
              <OptionSelect
                value={notice.whyIssued}
                onValueChange={(v) => editField("whyIssued", v)}
                options={WHY_ISSUED}
                prefilled={isPrefilled("whyIssued")}
                onViewSource={() => openSource("whyIssued")}
                ariaLabel="Why was the cheque issued?"
              />
            </FormField>
          </FormRow>
        </FormCard>

        {/* The notice itself, and how it was served */}
        <FormCard
          title="Legal demand notice"
          description="The statutory notice demanding payment, sent after the cheque was dishonoured."
        >
          <FormRow>
            <FormField
              label="Date of dispatch of demand notice"
              name="dispatchDate"
              required
              error={noticeDispatchIssue(draft, index)}
              tip="The notice must be sent within 30 days of receiving information about the cheque's return."
            >
              <DateField
                value={notice.dispatchDate}
                onChange={(v) => editField("dispatchDate", v)}
                prefilled={isPrefilled("dispatchDate")}
                onViewSource={() => openSource("dispatchDate")}
                ariaLabel="Date of dispatch of demand notice"
              />
            </FormField>
            <FormField label="Mode of service" name="modeService" required>
              <OptionSelect
                value={notice.modeService}
                prefilled={isPrefilled("modeService")}
                onViewSource={() => openSource("modeService")}
                onValueChange={(v) => editField("modeService", v)}
                options={MODE_OF_SERVICE}
                ariaLabel="Mode of service"
              />
            </FormField>
          </FormRow>

          <HalfWidth>
            <FormField
              label="Tracking number"
              name="tracking"
              optional
              tip="Consignment / tracking number from the postal or courier receipt."
            >
              <TextField
                value={notice.tracking}
                prefilled={isPrefilled("tracking")}
                onViewSource={() => openSource("tracking")}
                onChange={(v) => editField("tracking", v)}
                placeholder="Enter tracking number"
                autoComplete="off"
              />
            </FormField>
          </HalfWidth>

          <FormDivider />

          <FormField asGroup label="Whether delivered?" required>
            <YesNoSegmented
              value={notice.delivered}
              onValueChange={(v) => set("delivered", v)}
              ariaLabel="Whether the demand notice was delivered?"
            />
          </FormField>

          {notice.delivered === "yes" ? (
            <>
              <FormRow>
                <FormField
                  label="Date of delivery"
                  required
                  error={noticeServiceIssue(notice)}
                  help="The 15-day payment window runs from this date."
                >
                  <DateField
                    value={notice.deliveryDate}
                prefilled={isPrefilled("deliveryDate")}
                onViewSource={() => openSource("deliveryDate")}
                    onChange={(v) => editField("deliveryDate", v)}
                    ariaLabel="Date of delivery"
                  />
                </FormField>
              </FormRow>
              <FormField asGroup label="Has the accused replied to the demand notice?">
                <YesNoSegmented
                  value={notice.replied}
                  onValueChange={(v) => set("replied", v)}
                  ariaLabel="Has the accused replied to the demand notice?"
                />
              </FormField>
            </>
          ) : (
            <>
              <FormRow>
                <FormField
                  label="Date of return as not delivered"
                  required
                  error={noticeServiceIssue(notice)}
                >
                  <DateField
                    value={notice.returnDate}
                    onChange={(v) => set("returnDate", v)}
                    ariaLabel="Date of return as not delivered"
                  />
                </FormField>
                <FormField label="Reason for non-delivery" required>
                  <OptionSelect
                    value={notice.nonDeliveryReason}
                    onValueChange={(v) => set("nonDeliveryReason", v)}
                    options={NON_DELIVERY_REASONS}
                    ariaLabel="Reason for non-delivery"
                  />
                </FormField>
              </FormRow>
              <SectionNotice variant="info">
                A notice returned unserved can still count as valid service, if it was
                correctly addressed and dispatched. Keep the envelope and the tracking
                record.
              </SectionNotice>
            </>
          )}
        </FormCard>

        {/* Anything already paid comes off the claim */}
        <FormCard
          title="Payment against the cheque"
          description="Whether the accused has paid any part of the cheque amount."
        >
          <HalfWidth>
            <FormField
              label="Has the drawer (accused) made full or part payment due under the cheque?"
              required
              tip="If any amount has already been paid, the balance due is what is claimed in the complaint."
            >
              <OptionSelect
                value={notice.paymentStatus}
                onValueChange={(v) =>
                  set("paymentStatus", v as DemandNotice["paymentStatus"])
                }
                options={PAYMENT_STATUS}
                ariaLabel="Has the drawer (accused) made full or part payment due under the cheque?"
              />
            </FormField>
          </HalfWidth>

          {notice.paymentStatus === "part" ? (
            <HalfWidth>
              <FormField
                label="How much payment has already been made?"
                required
                help="Deducted from the cheque amount to arrive at the balance claimed."
              >
                <PrefixInput
                  prefix="₹"
                  value={notice.partAmount}
                  onChange={(v) => set("partAmount", v)}
                  placeholder="Amount paid so far"
                  inputMode="numeric"
                />
              </FormField>
            </HalfWidth>
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
        title={`Remove demand notice ${removeIndex + 1}`}
        description="Are you sure you want to delete the details of this demand notice? This cannot be undone."
        confirmLabel="Yes, remove"
        onConfirm={confirmRemove}
      />

      <SourcePanel
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        title={sourceSlot?.label ?? DOC_LABELS[sourceDoc]}
        field={explaining ? FIELD_LABELS[sourceField] : undefined}
        // Only the dispatch date has no other way to be corrected once machine-read
        // (its field opens this panel instead of a picker), so it gets the value box.
        value={sourceField === "dispatchDate" ? dispatchText : undefined}
        onValueChange={
          sourceField === "dispatchDate"
            ? (v) => {
                setDispatchText(v);
                const iso = fromDisplayDate(v);
                if (iso) editField("dispatchDate", iso);
              }
            : undefined
        }
        chips={uploadedDocs.map((doc) => ({
          label: slots[doc]?.file?.name ?? slots[doc]?.label ?? DOC_LABELS[doc],
          active: doc === sourceDoc,
          onClick: () => {
            setChosenField(entryFieldFor(doc));
            setExplaining(false);
          },
        }))}
        file={sourceSlot?.file ?? null}
        uploadHref={hrefFor("upload")}
        imageAlt={`Uploaded ${sourceSlot?.label ?? "document"}`}
        region={regionFromBox(
          sourceSlot?.extract?.fields[sourceField]?.box,
          sourceSlot?.extract?.page
        )}
        note="Shown from your uploaded document."
      />
    </>
  );
}
