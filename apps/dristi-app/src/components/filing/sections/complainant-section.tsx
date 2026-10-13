"use client";

/**
 * Complainant details — one tab per complainant, individual or institution.
 *
 * Reading the uploaded identity proof machine-fills the name, age and residential address;
 * those fields carry the amber prefilled marker until they are checked, and clicking one
 * opens that upload beside the form with the read region highlighted.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import { blankComplainant } from "@/lib/filing/blank";
import { ENTITY_TYPES, GENDER_OPTIONS } from "@/lib/filing/options";
import { fetchOnCourtRecord } from "@/lib/filing/registry";
import {
  complainantLabel,
  complainantsMissingCinPan,
  isCinOrPan,
  normaliseCinPan,
  partySourceSlot,
} from "@/lib/filing/selectors";
import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import type {
  Address,
  Complainant,
  ComplainantPrefillKey,
  ComplainantType,
  PoaHolder,
  Representative,
} from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { AddressFields } from "@/components/filing/address-fields";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
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
import { useLeaveGuard } from "@/components/filing/leave-guard";
import {
  CorrectionInstance,
  useCorrectionInstanceRequest,
  useInCorrection,
} from "@/components/filing/posture";
import { OptionSelect, PrefixInput, TextField } from "@/components/filing/inputs";
import { InfoWell, SectionNotice } from "@/components/filing/notices";
import { PrefillNotice } from "@/components/filing/prefill-notice";
import { RichTextEditor } from "@/components/filing/rich-text-editor";
import { SectionTabs } from "@/components/filing/section-tabs";
import { Segmented, YesNoSegmented } from "@/components/filing/segmented";
import { YesNoChoice } from "@/components/filing/yes-no-choice";
import {
  SourcePanel,
  ViewSourceButton,
  regionFromBox,
  useSourceOpenState,
} from "@/components/filing/source-panel";

/** Panel title per machine-filled field. */
const SOURCE_TITLES: Record<ComplainantPrefillKey, string> = {
  name: "Full name",
  age: "Age",
  email: "Email address",
  res: "Residential address",
  entName: "Entity name",
};

/**
 * Which box on the identity proof each field was read from. An age is written as a date of
 * birth on most IDs, and an address line comes from the address block (or, failing that,
 * the pincode) — so each falls back to what the parser actually found.
 */
const PREFILL_ORDER: ComplainantPrefillKey[] = ["name", "age", "res", "email", "entName"];

const ADDRESS_SOURCE_KEYS: Record<keyof Address, string> = { line1: "address", pin: "pin", city: "city", district: "district", state: "state" };
const ADDRESS_LABELS: Record<keyof Address, string> = { line1: "Address line", pin: "Pincode", city: "City / town", district: "District", state: "State / UT" };

const SOURCE_BOX_KEYS: Record<ComplainantPrefillKey, string[]> = {
  name: ["name"],
  age: ["age", "dob"],
  res: ["address", "pin"],
  email: [],
  entName: [],
};

/** The documents uploaded for a complainant, in the order the panel offers them. */
const PARTY_DOCS = ["id-proof", "poa", "vakalatnama"] as const;
type PartyDoc = (typeof PARTY_DOCS)[number];

/** Chip wording when a complainant was added beyond the documents intake asked for. */
const PARTY_DOC_LABELS: Record<PartyDoc, string> = {
  "id-proof": "Identity proof",
  poa: "Power of attorney",
  vakalatnama: "Vakalatnama",
};

const COMPLAINANT_TYPES: { value: ComplainantType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "institution", label: "Institution" },
];

export function ComplainantSection() {
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("complainant");

  const complainants = draft.complainants;
  const [activeIndex, setActiveIndex] = React.useState(0);
  const active = Math.min(activeIndex, complainants.length - 1);
  const c = complainants[active];

  /* A scrutiny defect on "Complainant 1 › Age" selects that tab before it takes focus. */
  useCorrectionInstanceRequest("complainant", setActiveIndex);

  /**
   * The source rail is a column beside the form from `xl` up, so it starts expanded
   * there as in the demo; collapsed, it stays in the layout as a strip. Below that it
   * is a sheet over the form — opened on request (a prefilled field, or "View source
   * document") rather than covering the screen on arrival.
   */
  const [sourceOpen, setSourceOpen] = useSourceOpenState();
  /**
   * `null` until the person picks a field, so the panel lands on something the identity
   * proof actually gave up rather than on a fixed field that may be empty.
   */
  const [chosenField, setChosenField] = React.useState<ComplainantPrefillKey | null>(null);
  /** Which of the complainant's uploads the panel shows; the chips switch between them. */
  const [addressField, setAddressField] = React.useState<keyof Address>("line1");
  const [sourceDoc, setSourceDoc] = React.useState<PartyDoc>("id-proof");
  const [pendingRemove, setPendingRemove] = React.useState<number | null>(null);
  /** The sandbox stand-in for mobile verification — see the dialog at the foot of the file. */
  const [otpOpen, setOtpOpen] = React.useState(false);
  const [otp, setOtp] = React.useState("");

  /* ── CIN / PAN ───────────────────────────────────────────────────────────── */

  const router = useRouter();
  /** Complainants whose CIN / PAN field has been left once — the format error waits for that. */
  const [cinPanVisited, setCinPanVisited] = React.useState<Record<string, boolean>>({});
  /** Where the person was going when the missing CIN / PAN stopped them. */
  const [leaveTo, setLeaveTo] = React.useState<string | null>(null);
  /** Ticked in the warning itself: skipping is allowed once the consequence is understood. */
  const [skipCinPanUnderstood, setSkipCinPanUnderstood] = React.useState(false);
  const skipCinPanId = React.useId();
  const cinPanInput = React.useRef<HTMLInputElement>(null);
  /** "Add CIN or PAN" closed the question — focus lands on the field, not on Continue. */
  const focusCinPan = React.useRef(false);

  /**
   * Every complainant is checked, not just the one on screen: with two tabs open the
   * question would otherwise wave through whichever one is not being looked at.
   */
  const missingCinPan = complainantsMissingCinPan(complainants);
  const hereHref = hrefFor("complainant");
  /* A correction round locks every field scrutiny did not flag, so there would be no
     adding one; the question stands down rather than point at a shut field. */
  const inCorrection = useInCorrection();
  const hasMissingCinPan = missingCinPan.length > 0 && !inCorrection;

  /**
   * The field is mandatory but skippable (handover `LIT-18a`): leaving without it is
   * allowed only through the declaration below — asked on
   * Continue and on a jump from the sections rail alike. Back is not moving on, and stays
   * a plain link.
   */
  const askBeforeLeaving = (href: string) => {
    if (href === hereHref || !hasMissingCinPan) return false;
    setSkipCinPanUnderstood(false);
    setLeaveTo(href);
    return true;
  };
  useLeaveGuard(askBeforeLeaving);

  const continueHref = next ? hrefFor(next) : undefined;
  const handleContinue = () => {
    if (continueHref && !askBeforeLeaving(continueHref)) router.push(continueHref);
  };

  /** The dialog's tick is the same declaration as the field's — recorded the same way. */
  const leaveWithoutCinPan = () => {
    const href = leaveTo;
    const at = new Date().toISOString();
    update((d) => {
      for (const i of missingCinPan) {
        d.complainants[i].entCinPanSkippedAt = at;
        d.complainants[i].entCinPan = "";
      }
    });
    setLeaveTo(null);
    if (href) router.push(href);
  };

  /** Back to the first complainant that is actually missing one, on its field. */
  const addCinPan = () => {
    focusCinPan.current = true;
    if (missingCinPan[0] !== undefined) setActiveIndex(missingCinPan[0]);
    setLeaveTo(null);
  };

  const cinPanError =
    cinPanVisited[c.id] && c.entCinPan && !isCinOrPan(c.entCinPan)
      ? "Enter a 21-character CIN or a 10-character PAN."
      : undefined;

  /* ── writes ──────────────────────────────────────────────────────────────── */

  const set = <K extends keyof Complainant>(key: K, value: Complainant[K]) =>
    update((d) => {
      d.complainants[active][key] = value;
    });

  /** Changing the number retires the check that was run against the old one. */
  const setMobile = (value: string) =>
    update((d) => {
      const target = d.complainants[active];
      if (value !== target.mobile) target.verified = false;
      target.mobile = value;
    });

  /** Editing a machine-filled field clears its amber marker. */
  const setRead = (key: ComplainantPrefillKey, value: string) =>
    update((d) => {
      const target = d.complainants[active];
      if (key === "res") target.res[addressField] = value;
      else if (key === "name") target.name = value;
      else if (key === "age") target.age = value;
      else if (key === "email") target.email = value;
      else target.entName = value;
      target.edited[key] = true;
    });

  const setRes = (value: Address) =>
    update((d) => {
      const target = d.complainants[active];
      // Only the address line was read from the record, so only it clears the marker.
      if (value.line1 !== target.res.line1) target.edited.res = true;
      target.res = value;
    });

  const setPoa = <K extends keyof PoaHolder>(key: K, value: PoaHolder[K]) =>
    update((d) => {
      d.complainants[active].poaHolder[key] = value;
    });

  const setRep = <K extends keyof Representative>(key: K, value: Representative[K]) =>
    update((d) => {
      d.complainants[active].rep[key] = value;
    });

  const addComplainant = () => {
    update((d) => {
      d.complainants.push(blankComplainant());
    });
    setActiveIndex(complainants.length);
  };

  const removeComplainant = (index: number) => {
    if (complainants.length <= 1) return;
    update((d) => {
      d.complainants.splice(index, 1);
    });
    setActiveIndex(Math.min(active, complainants.length - 2));
  };

  /* ── source panel ────────────────────────────────────────────────────────── */

  const openSource = (field: ComplainantPrefillKey) => {
    setChosenField(field);
    setSourceDoc("id-proof");
    setSourceOpen(true);
  };

  // Everything machine-read on a complainant comes off their identity proof; the PoA and
  // Vakalatnama are here to be looked at while the rest of the form is filled in.
  const partySlots = PARTY_DOCS.map((doc) => ({
    doc,
    slot: partySourceSlot(draft, active, doc),
  }));
  /* Only documents actually uploaded are offered; with none there is no rail at all. */
  const uploadedDocs = partySlots.filter((s) => s.slot?.file);
  const shownDoc = uploadedDocs.some((s) => s.doc === sourceDoc)
    ? sourceDoc
    : uploadedDocs[0]?.doc;
  const sourceSlot = partySlots.find((s) => s.doc === shownDoc)?.slot;
  const idProof = shownDoc === "id-proof" ? sourceSlot : undefined;
  /* Only the identity proof is read, so it alone decides where the panel lands. */
  const idProofSlot = partySlots.find((s) => s.doc === "id-proof")?.slot;
  /* A field's value can come from more than one box (age from `age` or `dob`), so the
     landing field is the first whose boxes the parser actually filled. */
  const sourceField =
    chosenField ??
    PREFILL_ORDER.find((key) =>
      SOURCE_BOX_KEYS[key].some((box) => idProofSlot?.extract?.fields[box]?.value)
    ) ??
    "name";
  const sourceValue =
    sourceField === "res"
      ? c.res[addressField]
      : sourceField === "entName"
        ? c.entName
        : sourceField === "email"
          ? c.email
          : sourceField === "age"
            ? c.age
            : c.name;
  /** The document in the rail, named as a person would name it, not by its file name. */
  const sourceDocLabel =
    sourceSlot?.label ?? PARTY_DOC_LABELS[shownDoc ?? "id-proof"];
  const sourceBox = (sourceField === "res" ? [ADDRESS_SOURCE_KEYS[addressField]] : SOURCE_BOX_KEYS[sourceField])
    .map((key) => idProof?.extract?.fields[key]?.box)
    .find(Boolean);
  const sourceRegion = regionFromBox(sourceBox, idProof?.extract?.page);

  /** Amber shows only while the value is still the machine-read one. */
  const isPrefilled = (key: ComplainantPrefillKey, value: string) =>
    !!c.prefilled[key] && !c.edited[key] && !!value;

  const namePrefilled = isPrefilled("name", c.name);
  const agePrefilled = isPrefilled("age", c.age);
  const emailPrefilled = isPrefilled("email", c.email);
  const entNamePrefilled = isPrefilled("entName", c.entName);
  const resPrefilled = !!c.prefilled.res && !c.edited.res;
  /** Something on this complainant is still waiting to be checked. */
  const anyPrefilled =
    namePrefilled || agePrefilled || emailPrefilled || entNamePrefilled || resPrefilled;

  const mobile10 = c.mobile.replace(/\D/g, "");
  /** Appearing in person settles the PoA question — see the note on the control. */
  const inPerson = c.pip === "yes";

  /** Nothing to verify until there is a whole number to verify. */
  const canVerify = mobile10.length === 10;

  /**
   * One step, not two: the OTP is what authorises reading a saved record back onto the
   * screen, so verifying and fetching cannot sensibly be separate buttons. Nothing found
   * is the ordinary case, not a failure — the screen says so and the person types on.
   */
  React.useEffect(() => {
    if (inPerson && c.poa === "yes") {
      update((d) => {
        d.complainants[active].poa = "no";
      });
    }
  }, [inPerson, c.poa, active, update]);

  const verifyAndFetch = async () => {
    const record = await fetchOnCourtRecord(c.mobile);
    update((d) => {
      const target = d.complainants[active];
      target.verified = true;
      target.fetched = !!record;
      if (!record) return;
      // Anything already typed is the person's own and is left alone.
      if (!target.name.trim()) target.name = record.name;
      if (!target.email.trim()) target.email = record.email;
      if (!target.age.trim()) target.age = record.age;
      if (!target.res.line1.trim()) target.res = { ...record.address };
    });
    setOtp("");
    setOtpOpen(false);
  };

  return (
    <>
      <FilingMain sourceOpen={sourceOpen}>
        <FilingPageHeader
          title="Complainant details"
          description="Who is bringing this complaint, and where the court can reach them."
        />

        <SectionTabs
          tabs={complainants.map((cp, i) => ({
            id: cp.id,
            label: complainantLabel(cp, i),
            status: cp.toReview ? "attention" : "complete",
            removable: complainants.length > 1,
          }))}
          activeId={c.id}
          onSelect={(id) => {
            const i = complainants.findIndex((cp) => cp.id === id);
            if (i >= 0) setActiveIndex(i);
          }}
          onRemove={(id) => {
            const i = complainants.findIndex((cp) => cp.id === id);
            if (i >= 0) setPendingRemove(i);
          }}
          addLabel="Add complainant"
          onAdd={addComplainant}
          trailing={
            !sourceOpen ? (
              <ViewSourceButton onClick={() => { setChosenField(null); setSourceOpen(true); }} />
            ) : null
          }
        />

        <PrefillNotice show={anyPrefilled} />

        <CorrectionInstance value={active}>
        {/* Representation & type */}
        <FormCard title="Representation & type">
          <FormField
            asGroup
            label="Are you representing yourself in person (party-in-person)?"
          >
            <YesNoSegmented
              value={c.pip}
              onValueChange={(v) => set("pip", v)}
              ariaLabel="Are you representing yourself in person (party-in-person)?"
            />
          </FormField>
          <FormField asGroup label="Complainant type">
            <Segmented
              value={c.type}
              onValueChange={(v) => set("type", v)}
              options={COMPLAINANT_TYPES}
              ariaLabel="Complainant type"
            />
          </FormField>
        </FormCard>

        {c.type === "individual" ? (
          <>
            {/* Contact */}
            <FormCard
              title="Contact"
              description="Use the complainant's own number and email, not the advocate's."
            >
              {/* Why the number matters, said before it is typed. An Alert-based notice,
                  not a Banner: the DS keeps Banner for page-wide conditions, and this
                  explains one field. Not dismissible; it governs a required field. */}
              <SectionNotice variant="info">
                The complainant verifies this number when signing the complaint. All case
                updates are sent to it, and it is how they log in to see the case.
              </SectionNotice>
              {/* Email sat under Basic details, two cards from the number it belongs
                  beside. Both are how this person is reached; they are asked together. */}
              <FormRow>
                <FormField label="Mobile number" required>
                  <PrefixInput
                    prefix="+91"
                    value={c.mobile}
                    onChange={setMobile}
                    placeholder="10-digit number"
                    inputMode="numeric"
                    autoComplete="tel-national"
                  />
                </FormField>
                <FormField label="Email address" name="email" optional>
                  <TextField
                    type="email"
                    value={c.email}
                    onChange={(v) => setRead("email", v)}
                    placeholder="optional@example.com"
                    autoComplete="email"
                    prefilled={emailPrefilled}
                    onViewSource={() => openSource("email")}
                  />
                </FormField>
              </FormRow>

              {/* Verify & fetch details removed — the phone number is collected as
                 contact information, not as a lookup key. */}
            </FormCard>

            {/* Basic details */}
            {/* Who this person is; how to reach them is the card above. */}
            <FormCard title="Basic details">
              <FormRow>
                <FormField label="Full name" name="name" required>
                  <TextField
                    value={c.name}
                    onChange={(v) => setRead("name", v)}
                    placeholder="As printed on the cheque"
                    autoComplete="name"
                    prefilled={namePrefilled}
                    onViewSource={() => openSource("name")}
                  />
                </FormField>
                <FormField label="Age" name="age" required>
                  <TextField
                    value={c.age}
                    onChange={(v) => setRead("age", v)}
                    placeholder="e.g. 47"
                    inputMode="numeric"
                    prefilled={agePrefilled}
                    onViewSource={() => openSource("age")}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Gender" name="gender" optional>
                  <OptionSelect
                    value={c.gender}
                    onValueChange={(v) => set("gender", v as Complainant["gender"])}
                    options={GENDER_OPTIONS}
                    placeholder="Select"
                  />
                </FormField>
                <FormField
                  asGroup
                  label="Differently abled?"
                  optional
                >
                  <YesNoChoice
                    value={c.differentlyAbled}
                    onValueChange={(v) => set("differentlyAbled", v as Complainant["differentlyAbled"])}
                    ariaLabel="Is the complainant differently abled?"
                    name={`complainant-${c.id}-differently-abled`}
                  />
                </FormField>
              </FormRow>
            </FormCard>

            {/* Residential address */}
            <FormCard
              title="Residential address"
              description="Where the complainant currently lives."
            >
              <AddressFields
                value={c.res}
                onChange={setRes}
                prefilled={resPrefilled}
                prefilledFields={Object.fromEntries((Object.keys(ADDRESS_SOURCE_KEYS) as (keyof Address)[]).map((key) => [key, !!idProof?.extract?.fields[ADDRESS_SOURCE_KEYS[key]]?.value && idProof.extract.fields[ADDRESS_SOURCE_KEYS[key]].value === c.res[key]]))}
                onViewSource={(key) => { setAddressField(key); openSource("res"); }}
              />
              <FormField
                asGroup
                label="Is the permanent address the same as the residential address?"
              >
                <YesNoSegmented
                  value={c.permSame}
                  onValueChange={(v) => set("permSame", v)}
                  ariaLabel="Is the permanent address the same as the residential address?"
                />
              </FormField>
            </FormCard>

            {c.permSame === "no" ? (
              <FormCard title="Permanent address">
                <AddressFields value={c.perm} onChange={(v) => set("perm", v)} />
              </FormCard>
            ) : null}

            {/* Power of attorney */}
            <FormCard title="Power of attorney (PoA)">
              <FormField
                asGroup
                label="Has the complainant authorised any person as their power of attorney in this case?"
                help={
                  inPerson
                    ? "Answered by your appearing in person: conducting the case yourself and authorising someone else to conduct it are alternatives, not both."
                    : undefined
                }
              >
                <YesNoSegmented
                  value={inPerson ? "no" : c.poa}
                  onValueChange={(v) => set("poa", v)}
                  ariaLabel="Has the complainant authorised any person as their power of attorney in this case?"
                  disabled={inPerson}
                />
              </FormField>

              {!inPerson && c.poa === "yes" ? (
                <>
                  <FormDivider />
                  <FormSubhead>PoA holder details</FormSubhead>
                  <HalfWidth>
                    <FormField label="PoA holder mobile number" required>
                      <PrefixInput
                        prefix="+91"
                        value={c.poaHolder.mobile}
                        onChange={(v) => setPoa("mobile", v)}
                        placeholder="10-digit number"
                        inputMode="numeric"
                      />
                    </FormField>
                  </HalfWidth>
                  <FormRow>
                    <FormField label="PoA holder full name" required>
                      <TextField
                        value={c.poaHolder.name}
                        onChange={(v) => setPoa("name", v)}
                        placeholder="Full name"
                      />
                    </FormField>
                    <FormField label="PoA holder age" required>
                      <TextField
                        value={c.poaHolder.age}
                        onChange={(v) => setPoa("age", v)}
                        placeholder="e.g. 52"
                        inputMode="numeric"
                      />
                    </FormField>
                  </FormRow>
                  <FormSubhead>PoA holder&apos;s residential address</FormSubhead>
                  <AddressFields
                    value={c.poaHolder.res}
                    onChange={(v) => setPoa("res", v)}
                  />
                  <FormField
                    asGroup
                    label="Is the PoA holder's permanent address the same as residential?"
                  >
                    <YesNoSegmented
                      value={c.poaHolder.permSame}
                      onValueChange={(v) => setPoa("permSame", v)}
                      ariaLabel="Is the PoA holder's permanent address the same as residential?"
                    />
                  </FormField>
                  {c.poaHolder.permSame === "no" ? (
                    <>
                      <FormSubhead>PoA holder&apos;s permanent address</FormSubhead>
                      <AddressFields
                        value={c.poaHolder.perm}
                        onChange={(v) => setPoa("perm", v)}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </FormCard>
          </>
        ) : (
          <>
            {/* Institution details */}
            <FormCard title="Institution details">
              <FormRow>
                <FormField label="Type of entity" required>
                  <OptionSelect
                    value={c.entType}
                    onValueChange={(v) => set("entType", v)}
                    options={ENTITY_TYPES}
                    placeholder="Select type"
                  />
                </FormField>
                <FormField label="Entity name" required>
                  <TextField
                    value={c.entName}
                    onChange={(v) => setRead("entName", v)}
                    placeholder="Registered name"
                    prefilled={entNamePrefilled}
                    onViewSource={() => openSource("entName")}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Contact number" optional>
                  <PrefixInput
                    prefix="+91"
                    value={c.entPhone}
                    onChange={(v) => set("entPhone", v)}
                    placeholder="10-digit number"
                    inputMode="numeric"
                  />
                </FormField>
                <FormField label="Email address" optional>
                  <TextField
                    type="email"
                    value={c.entEmail}
                    onChange={(v) => set("entEmail", v)}
                    placeholder="optional@example.com"
                    autoComplete="email"
                  />
                </FormField>
              </FormRow>
              <HalfWidth className="flex flex-col gap-3">
                <FormField
                  label="CIN or PAN"
                  name="entCinPan"
                  required
                  help="This will be used to identify cases belonging to the same complainant."
                  error={c.entCinPanSkippedAt ? undefined : cinPanError}
                >
                  <TextField
                    ref={cinPanInput}
                    value={c.entCinPan}
                    onChange={(v) => set("entCinPan", normaliseCinPan(v))}
                    onBlur={() => setCinPanVisited((v) => ({ ...v, [c.id]: true }))}
                    placeholder="21-character CIN or 10-character PAN"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={!!c.entCinPanSkippedAt}
                  />
                </FormField>
                {/* Mandatory, but skippable by declaration (`LIT-18a`). The declaration is
                    the skip — it is recorded on the filing, and it turns the field off.
                    An option of the field, so it sits in the field's column, quietly. */}
                <Label
                  htmlFor={`${skipCinPanId}-${c.id}`}
                  className="items-start gap-2 text-body-compact font-normal text-muted-foreground"
                >
                  <Checkbox
                    id={`${skipCinPanId}-${c.id}`}
                    checked={!!c.entCinPanSkippedAt}
                    onCheckedChange={(checked) =>
                      update((d) => {
                        const target = d.complainants[active];
                        target.entCinPanSkippedAt =
                          checked === true ? new Date().toISOString() : null;
                        if (checked === true) target.entCinPan = "";
                      })
                    }
                    className="mt-0.5"
                  />
                  {/* Wraps to several lines — the Label's own leading-none would collide. */}
                  <span className="leading-normal">
                    Skip — I understand this case won&apos;t be linked to the
                    complainant&apos;s other cases.
                  </span>
                </Label>
              </HalfWidth>
            </FormCard>

            {/* Registered address */}
            <FormCard title="Registered address">
              <AddressFields value={c.entAddr} onChange={(v) => set("entAddr", v)} />
            </FormCard>

            {/* Authorised representative */}
            <FormCard
              title="Authorised representative"
              description="The person authorised to act for the institution in this case."
            >
              <HalfWidth>
                <FormField label="Mobile number" required>
                  <PrefixInput
                    prefix="+91"
                    value={c.rep.mobile}
                    onChange={(v) => setRep("mobile", v)}
                    placeholder="10-digit number"
                    inputMode="numeric"
                  />
                </FormField>
              </HalfWidth>
              <FormRow>
                <FormField label="Full name" required>
                  <TextField
                    value={c.rep.name}
                    onChange={(v) => setRep("name", v)}
                    placeholder="Full name"
                  />
                </FormField>
                <FormField label="Age" required>
                  <TextField
                    value={c.rep.age}
                    onChange={(v) => setRep("age", v)}
                    placeholder="e.g. 47"
                    inputMode="numeric"
                  />
                </FormField>
              </FormRow>
              <HalfWidth>
                <FormField label="Email address" optional>
                  <TextField
                    type="email"
                    value={c.rep.email}
                    onChange={(v) => setRep("email", v)}
                    placeholder="optional@example.com"
                    autoComplete="email"
                  />
                </FormField>
              </HalfWidth>
              <FormRow>
                <FormField label="Gender" name="repGender" optional>
                  <OptionSelect
                    value={c.rep.gender}
                    onValueChange={(v) => setRep("gender", v as Representative["gender"])}
                    options={GENDER_OPTIONS}
                    placeholder="Select"
                  />
                </FormField>
                <FormField
                  asGroup
                  label="Differently abled?"
                  optional
                >
                  <YesNoChoice
                    value={c.rep.differentlyAbled}
                    onValueChange={(v) => setRep("differentlyAbled", v as Representative["differentlyAbled"])}
                    ariaLabel="Is the representative differently abled?"
                    name={`complainant-${c.id}-rep-differently-abled`}
                  />
                </FormField>
              </FormRow>
              <FormSubhead>Representative&apos;s address</FormSubhead>
              <AddressFields
                value={c.rep.addr}
                onChange={(v) => setRep("addr", v)}
              />
            </FormCard>
          </>
        )}

        {/* Affidavit — only when appearing without an advocate */}
        {c.pip === "yes" ? (
          <FormCard
            title="Affidavit for appearing as party-in-person"
            description="Pre-filled from the standard template. Edit if needed."
          >
            <RichTextEditor
              value={c.affidavit}
              onChange={(html) => set("affidavit", html)}
              ariaLabel="Affidavit for appearing as party-in-person"
            />
          </FormCard>
        ) : null}
        </CorrectionInstance>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        onContinue={continueHref ? handleContinue : undefined}
      />

      <SourcePanel
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        title={sourceDocLabel}
        // Named only when the person asked about that field from the form; switching
        // documents in the rail is a question about the document, so it clears it.
        field={chosenField ? (chosenField === "res" ? ADDRESS_LABELS[addressField] : SOURCE_TITLES[chosenField]) : undefined}
        value={sourceValue}
        onValueChange={(v) => setRead(sourceField, v)}
        chips={uploadedDocs.map(({ doc, slot }) => ({
          label: slot?.file?.name ?? slot?.label ?? PARTY_DOC_LABELS[doc],
          active: doc === shownDoc,
          onClick: () => {
            setChosenField(null);
            setSourceDoc(doc);
          },
        }))}
        file={sourceSlot?.file ?? null}
        uploadHref={hrefFor("upload")}
        imageAlt={`Uploaded ${sourceSlot?.label ?? "document"}`}
        region={sourceRegion}
        note="Shown from your uploaded document."
      />

      {/* Mobile verification — the sandbox stand-in, shown as one. Nothing is sent, so the
          dialog says so in place and the field afterwards says so too. */}
      <Dialog
        open={otpOpen}
        onOpenChange={(open) => {
          setOtpOpen(open);
          if (!open) setOtp("");
        }}
      >
        <ChromeDialogContent mobileSheet className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify &amp; fetch details</DialogTitle>
            <DialogDescription>
              This confirms the number the court will use to reach{" "}
              {complainantLabel(c, active)} and, if ON Court already holds a record
              against it, fills in the name and address it has.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="complainant-otp" className="text-body-compact">
              Enter OTP
            </Label>
            <InputOTP
              id="complainant-otp"
              maxLength={6}
              value={otp}
              onChange={setOtp}
              containerClassName="gap-2"
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="size-10 rounded-lg border border-input"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <p className="text-caption text-muted-foreground">
              Sandbox: no OTP is sent, and any 6-digit code is accepted here.
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={otp.length < 6}
            onClick={() => void verifyAndFetch()}
          >
            Verify &amp; fetch details
          </Button>
        </ChromeDialogContent>
      </Dialog>

      {/* Leaving while some institutional complainant has no CIN or PAN. */}
      <Dialog
        open={leaveTo !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveTo(null);
        }}
      >
        <ChromeDialogContent
          mobileSheet
          className="sm:max-w-lg"
          onCloseAutoFocus={(event) => {
            if (!focusCinPan.current) return;
            focusCinPan.current = false;
            event.preventDefault();
            cinPanInput.current?.focus();
          }}
        >
          <DialogHeader>
            <span
              aria-hidden
              className="mb-2 flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-muted text-warning-muted-foreground"
            >
              <TriangleAlertIcon className="size-5" />
            </span>
            <DialogTitle>Continue without a CIN or PAN?</DialogTitle>
            <DialogDescription>
              The CIN or PAN is used to identify cases belonging to the same complainant.
            </DialogDescription>
          </DialogHeader>
          {/* The acknowledgement is its own recessed well — a hairline, since it holds a control. */}
          <Label
            htmlFor={skipCinPanId}
            className="items-start gap-3 rounded-lg border border-hairline bg-surface-sunken p-4 font-normal text-foreground"
          >
            <Checkbox
              id={skipCinPanId}
              checked={skipCinPanUnderstood}
              onCheckedChange={(checked) => setSkipCinPanUnderstood(checked === true)}
              className="mt-0.5"
            />
            {/* Wraps to several lines — the Label's own leading-none would collide. */}
            <span className="leading-normal">
              I understand that without it, this case will not be linked to the
              complainant&apos;s other cases.
            </span>
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={addCinPan}>
              Add CIN or PAN
            </Button>
            <Button
              type="button"
              onClick={leaveWithoutCinPan}
              disabled={!skipCinPanUnderstood}
              aria-disabled={!skipCinPanUnderstood || undefined}
            >
              Continue without it
            </Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title={
          pendingRemove !== null && complainants[pendingRemove]
            ? `Remove ${complainantLabel(complainants[pendingRemove], pendingRemove)}`
            : "Remove complainant"
        }
        description="Are you sure you want to delete this complainant and all their details? This cannot be undone."
        onConfirm={() => {
          if (pendingRemove !== null) removeComplainant(pendingRemove);
          setPendingRemove(null);
        }}
      />
    </>
  );
}
