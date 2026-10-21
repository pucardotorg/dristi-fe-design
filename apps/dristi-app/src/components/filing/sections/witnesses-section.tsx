"use client";

/**
 * Witnesses — who the complainant intends to rely on, and how the court reaches them.
 *
 * Source: demo "Witnesses" screen. A witness can be identified by name *or* by official
 * designation ("Bank Manager, SBI Sector 17"), so the two are offered as alternatives
 * either side of an OR rule rather than as two required fields.
 */

import * as React from "react";

import { blankWitness } from "@/lib/filing/blank";
import { witnessComplete } from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import type { Witness } from "@/lib/filing/types";
import { FieldSeparator } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard, HalfWidth } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { CorrectionInstance } from "@/components/filing/posture";
import { TextField } from "@/components/filing/inputs";
import { SectionNotice } from "@/components/filing/notices";
import { AddressBlockList, ContactList } from "@/components/filing/repeat-lists";
import { SectionTabs } from "@/components/filing/section-tabs";

export function WitnessesSection() {
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("witnesses");

  const [activeId, setActiveId] = React.useState(() => draft.witnesses[0]?.id ?? "");
  const [removeId, setRemoveId] = React.useState<string | null>(null);
  // Held separately from `removeId` so the title stays put while the dialog animates out.
  const [removeNumber, setRemoveNumber] = React.useState(1);

  const found = draft.witnesses.findIndex((x) => x.id === activeId);
  const index = found >= 0 ? found : draft.witnesses.length - 1;
  const w = draft.witnesses[index];

  const setField = <K extends keyof Witness>(key: K, value: Witness[K]) =>
    update((d) => {
      d.witnesses[index][key] = value;
    });

  const addWitness = () => {
    const created = blankWitness();
    update((d) => {
      d.witnesses.push(created);
    });
    setActiveId(created.id);
  };

  const askRemove = (id: string) => {
    const i = draft.witnesses.findIndex((x) => x.id === id);
    if (i < 0 || draft.witnesses.length <= 1) return;
    setRemoveNumber(i + 1);
    setRemoveId(id);
  };

  const confirmRemove = () => {
    const i = removeId ? draft.witnesses.findIndex((x) => x.id === removeId) : -1;
    if (i < 0 || draft.witnesses.length <= 1) {
      setRemoveId(null);
      return;
    }
    const fallback = draft.witnesses[i + 1] ?? draft.witnesses[i - 1];
    update((d) => {
      d.witnesses.splice(i, 1);
    });
    if (removeId === activeId && fallback) setActiveId(fallback.id);
    setRemoveId(null);
  };

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title="Witnesses"
          description="List the witnesses the complainant intends to rely on, and how the court can reach them."
        />

        <SectionTabs
          tabs={draft.witnesses.map((wit, i) => ({
            id: wit.id,
            label: `Witness ${i + 1}`,
            status: witnessComplete(wit) ? "complete" : "attention",
            removable: draft.witnesses.length > 1,
          }))}
          activeId={w.id}
          onSelect={setActiveId}
          onRemove={askRemove}
          addLabel="Add witness"
          onAdd={addWitness}
        />

        {/* Which witness the fields below belong to, so a check can point at its field. */}
        <CorrectionInstance value={index}>
        {/* Identity */}
        <FormCard
          title={`Witness ${index + 1}`}
          description="Enough for the court to identify this witness."
        >
          {/*
            Name and designation are one question with two ways of answering it, so the
            requirement sits on the group and neither field is marked required on its own
            — a `*` on both said "fill in both", which is the opposite of what the OR
            means. Age is a separate question and lives outside the group, where the rule
            between the two alternatives cannot be read as reaching it.
          */}
          <FormField
            asGroup
            label="How is this witness identified?"
            required
            help="Either one is enough. Use the designation if you only know the office they hold."
            helpPlacement="above"
          >
            <div className="flex flex-col gap-4">
              <FormField label="Full name" name="fullName">
                <TextField
                  value={w.fullName}
                  onChange={(v) => setField("fullName", v)}
                  placeholder="e.g. Ramesh Nair"
                  autoComplete="off"
                />
              </FormField>

              <FieldSeparator>OR</FieldSeparator>

              <FormField label="Designation" name="designation">
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
        </FormCard>

        {/* Contact */}
        <FormCard
          title={`Witness ${index + 1} contact details`}
          description="Where the court can reach this witness."
        >
          <ContactList
            contacts={w.contacts}
            onChange={(contacts) => setField("contacts", contacts)}
            addLabel="Add more"
            emailLabel="Email ID"
            mobilePlaceholder="Enter mobile number"
            emailPlaceholder="ex: xyz@gmail.com"
          />
        </FormCard>

        {/* Service addresses */}
        <FormCard title={`Witness ${index + 1} address details`}>
          <SectionNotice variant="info">
            The court tries every address listed here.
          </SectionNotice>
          <AddressBlockList
            blocks={w.addresses}
            onChange={(addresses) => setField("addresses", addresses)}
            addLabel="Add address"
          />
        </FormCard>
        </CorrectionInstance>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        continueHref={next ? hrefFor(next) : undefined}
      />

      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
        title={`Remove witness ${removeNumber}`}
        description="Are you sure you want to delete this witness and all their details? This cannot be undone."
        confirmLabel="Yes, remove"
        onConfirm={confirmRemove}
      />
    </>
  );
}
