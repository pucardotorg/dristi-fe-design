"use client";

/**
 * Accused details — who the complaint is against, how the court can reach them, and
 * where process should be served.
 *
 * Source: demo "Accused Details" screen. One tab per accused; Continue is guarded, because
 * an accused with no phone or email makes the summons harder to deliver: the filer is shown
 * what that costs and must confirm it before the filing moves on.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { InfoIcon } from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import { blankAccused } from "@/lib/filing/blank";
import { ACCUSED_ENTITY_TYPES, ACCUSED_TYPES } from "@/lib/filing/options";
import {
  accusedComplete,
  accusedHasContact,
  accusedLabel,
} from "@/lib/filing/selectors";
import { nameList } from "@/lib/filing/format";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import type { Accused, AccusedType } from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard, FormRow, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { OptionSelect, TextField } from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import {
  AddressBlockList,
  ContactList,
  RepresentativeList,
} from "@/components/filing/repeat-lists";
import { SectionTabs } from "@/components/filing/section-tabs";
import { YesNoSegmented } from "@/components/filing/segmented";

export function AccusedSection() {
  const { draft, update, hrefFor } = useFiling();
  const router = useRouter();
  const { prev, next } = neighbours("accused");

  // Tracked by id, so removing an accused cannot leave the tabs pointing at a stale index.
  const [activeId, setActiveId] = React.useState(() => draft.accused[0]?.id ?? "");
  const [noContactOpen, setNoContactOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmChecked, setConfirmChecked] = React.useState(false);
  const [pendingRemove, setPendingRemove] = React.useState<string | null>(null);
  // Held apart from `pendingRemove` so the title stays put while the dialog animates out.
  const [pendingRemoveLabel, setPendingRemoveLabel] = React.useState("");

  const found = draft.accused.findIndex((x) => x.id === activeId);
  const index = found >= 0 ? found : draft.accused.length - 1;
  const a = draft.accused[index];
  const isIndividual = a.type === "individual";

  const confirmCheckboxId = React.useId();
  const confirmStatementId = React.useId();

  const setField = <K extends keyof Accused>(key: K, value: Accused[K]) =>
    update((d) => {
      d.accused[index][key] = value;
    });

  const addAccused = () => {
    const created = blankAccused();
    update((d) => {
      d.accused.push(created);
    });
    setActiveId(created.id);
  };

  const askRemove = (id: string) => {
    const i = draft.accused.findIndex((x) => x.id === id);
    if (i < 0 || draft.accused.length <= 1) return;
    setPendingRemoveLabel(accusedLabel(draft.accused[i], i));
    setPendingRemove(id);
  };

  const removeAccused = (id: string) => {
    if (draft.accused.length <= 1) return;
    const i = draft.accused.findIndex((x) => x.id === id);
    if (i < 0) return;
    const fallback = draft.accused[i + 1] ?? draft.accused[i - 1];
    update((d) => {
      d.accused.splice(i, 1);
    });
    if (id === activeId && fallback) setActiveId(fallback.id);
  };

  const goToNext = () => {
    setNoContactOpen(false);
    setConfirmOpen(false);
    router.push(hrefFor(next ?? "cheque"));
  };

  /**
   * Every accused is checked, not just the one on screen: with two tabs open the guard
   * would otherwise wave through whichever one is not being looked at.
   */
  const missingContact = draft.accused.filter((acc) => !accusedHasContact(acc));
  const missingNames = nameList(
    draft.accused.flatMap((acc, i) =>
      accusedHasContact(acc) ? [] : [accusedLabel(acc, i)]
    )
  );

  const handleContinue = () => {
    if (missingContact.length === 0) {
      goToNext();
      return;
    }
    setConfirmChecked(false);
    setNoContactOpen(true);
  };

  /** Send the person to the first accused that is actually missing a contact. */
  const goToMissing = () => {
    setNoContactOpen(false);
    setConfirmOpen(false);
    if (missingContact[0]) setActiveId(missingContact[0].id);
  };

  const proceedWithoutDetails = () => {
    setNoContactOpen(false);
    setConfirmChecked(false);
    setConfirmOpen(true);
  };

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title="Accused details"
          description="Add the person or entity you are filing this complaint against."
        />

        <SectionTabs
          tabs={draft.accused.map((acc, i) => ({
            id: acc.id,
            label: `Accused ${i + 1}`,
            meta: acc.name || undefined,
            status: accusedComplete(acc) ? "complete" : "attention",
            removable: draft.accused.length > 1,
          }))}
          activeId={a.id}
          onSelect={setActiveId}
          onRemove={askRemove}
          addLabel="Add accused"
          onAdd={addAccused}
        />

        {/*
          Identity. "Is the accused a person or an institution?" and "what kind of
          institution?" are two questions: the old single list made you answer the second
          to get past the first, and left "Proprietorship" sitting next to "Individual" as
          though they were the same kind of answer.

          Age is gone. It was optional, nothing downstream read it, and nobody knows the
          age of the person they are suing (owner, 2026-08-19).
        */}
        <FormCard title={isIndividual ? `Accused ${index + 1} details` : "Entity details"}>
          <FormRow>
            <FormField label="Accused type" required>
              <OptionSelect
                value={a.type}
                onValueChange={(v) => setField("type", v as AccusedType)}
                options={ACCUSED_TYPES}
              />
            </FormField>
            {isIndividual ? null : (
              <FormField label="Type of entity" required>
                <OptionSelect
                  value={a.entType}
                  onValueChange={(v) => setField("entType", v)}
                  options={ACCUSED_ENTITY_TYPES}
                  placeholder="Select type"
                />
              </FormField>
            )}
          </FormRow>
          <HalfWidth>
            <FormField label={isIndividual ? "Full name" : "Entity name"} required>
              <TextField
                value={a.name}
                onChange={(v) => setField("name", v)}
                placeholder="As it should appear on the summons"
                autoComplete="off"
              />
            </FormField>
          </HalfWidth>
        </FormCard>

        {/*
          Who answers for the entity. Under S-141 the company is not summoned alone —
          every person who was in charge of its business when the cheque bounced is
          proceeded against with it, so this is a list, not a field.
        */}
        {isIndividual ? null : (
          <FormCard
            title="Who is summoned for the entity"
            description="Directors, partners or officers in charge of the business when the cheque was dishonoured. Each is summoned with the entity."
          >
            <RepresentativeList
              reps={a.reps}
              onChange={(reps) => setField("reps", reps)}
            />
          </FormCard>
        )}

        {/* Contact */}
        <FormCard
          title="Contact details"
          description="Where the court can reach the accused."
        >
          <ContactList
            contacts={a.contacts}
            onChange={(contacts) => setField("contacts", contacts)}
          />
        </FormCard>

        {/* Service addresses */}
        <FormCard title="Address details">
          {!draft.dismissed.accusedAddress ? (
            <SectionNotice
              variant="info"
              onDismiss={() =>
                update((d) => {
                  d.dismissed.accusedAddress = true;
                })
              }
            >
              The summons goes to every address listed here.
            </SectionNotice>
          ) : null}
          <AddressBlockList
            blocks={a.addresses}
            onChange={(addresses) => setField("addresses", addresses)}
          />
        </FormCard>

        {/* Jurisdiction */}
        <FormCard title="Jurisdiction">
          <FormField
            asGroup
            label="Does the accused reside within the jurisdiction of this court?"
            help="The court decides jurisdiction on the facts."
          >
            <YesNoSegmented
              value={a.jurisdiction}
              onValueChange={(v) => setField("jurisdiction", v)}
              ariaLabel="Does the accused reside within the jurisdiction of this court?"
            />
          </FormField>
        </FormCard>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={handleContinue}
      />

      {/* Continue while some accused — named here — has no phone or email. */}
      <Dialog open={noContactOpen} onOpenChange={setNoContactOpen}>
        <ChromeDialogContent mobileSheet className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-muted text-info-muted-foreground"
              >
                <InfoIcon className="size-5" />
              </span>
              <DialogTitle>No contact details added</DialogTitle>
            </div>
            <DialogDescription>
              No phone number or email has been added for {missingNames}. Adding one
              increases the chances of the summons being delivered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={proceedWithoutDetails}>
              Proceed without details
            </Button>
            <Button type="button" onClick={goToMissing}>
              Add details
            </Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      {/* The confirmation itself — the court is told this was a considered choice. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ChromeDialogContent mobileSheet aria-describedby={confirmStatementId} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm: proceed without details</DialogTitle>
          </DialogHeader>
          <Label
            htmlFor={confirmCheckboxId}
            id={confirmStatementId}
            className="items-start gap-3 font-normal text-foreground"
          >
            <Checkbox
              id={confirmCheckboxId}
              checked={confirmChecked}
              onCheckedChange={(checked) => setConfirmChecked(checked === true)}
              className="mt-0.5"
            />
            {/* Wraps to several lines — the Label's own leading-none would collide. */}
            <span className="leading-normal">
              I confirm that I have no knowledge of the electronic contact details of{" "}
              {missingNames}, and cannot locate them with reasonable effort.
            </span>
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={goToMissing}>
              Add details
            </Button>
            <Button
              type="button"
              onClick={goToNext}
              disabled={!confirmChecked}
              aria-disabled={!confirmChecked || undefined}
            >
              Confirm
            </Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title={`Remove ${pendingRemoveLabel || "accused"}`}
        description="Are you sure you want to delete this accused and all their contact and address details? This cannot be undone."
        confirmLabel="Yes, remove"
        onConfirm={() => {
          if (pendingRemove) removeAccused(pendingRemove);
          setPendingRemove(null);
        }}
      />
    </>
  );
}
