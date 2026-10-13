import {
  affidavitBody,
  htmlToParagraphs,
} from "@/components/filing/sections/preview/derive";
import {
  addressToString,
  plural,
  rupees,
  toDisplayDate,
  toLongDate,
} from "@/lib/filing/format";
import {
  ACCUSED_ENTITY_TYPES,
  ENTITY_TYPES,
  GENDER_OPTIONS,
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  NON_DELIVERY_REASONS,
  PAYMENT_STATUS,
  RETURN_REASONS,
  WHY_ISSUED,
  type Option,
} from "@/lib/filing/options";
import {
  advocateName,
  chequeSourceSlot,
  limitationView,
  partySourceSlot,
  signatories,
} from "@/lib/filing/selectors";
import type {
  Address,
  AddressBlock,
  Contact,
  FilingDraft,
  IntakeDocType,
  IntakeSlot,
  YesNo,
} from "@/lib/filing/types";
import type { CaseDocumentKind } from "@/lib/employee/case-review";
import type {
  BundleDoc,
  CaseParty,
  Field,
  FieldGroupDef,
  GroupIcon,
  Rect,
  SectionDef,
} from "@/lib/employee/scrutiny/types";

/**
 * The scrutiny workbench, read off an e-filing draft.
 *
 * The officer reviews what the advocate filed, so the field list is the e-filing form
 * itself: every question the form asked, in the form's own order, with the branches the filer took (an institution complainant shows the
 * institution's questions, a notice returned unserved shows the return date and reason).
 * Repeating records — complainants, advocates, accused, cheques, notices, witnesses —
 * become one group each. Nothing here is typed by hand, so a field added to the form has
 * one place to be added here and cannot silently go missing from scrutiny.
 *
 * Provenance comes from the draft too. A value the form machine-read from an upload
 * points at that upload and the region it was read at; a value the reading disagreed
 * with carries the reading (`docread`); a value the reading could not find says so
 * (`ocrfail`). A value the filer typed with nothing behind it carries no source at all.
 *
 * Labels are the form's own, except where the form asks a sentence-long question: the
 * label column is narrow, so "Did the payee (complainant) deposit the cheque in their bank
 * account?" reads here as "Cheque deposited in the payee's own account?".
 *
 * Field ids are positional (`c1-name`, `q2-amt`, `a1-r2-desig`) rather than the draft's
 * own row ids, so a flag survives the draft being re-read and the ids read in a URL.
 */

/** What the preview and the court sheet print for a question left unanswered. */
const NOT_PROVIDED = "Not provided";

/** Gujarat signs with every advocate and an oath (`lib/court/profiles.ts`). */
export interface DraftReadOptions {
  /** The deployment's signing rules — passed, not read from the client-side switch. */
  signing: { oath: boolean; everyAdvocate: boolean };
  /**
   * Pages with something real to show, keyed by bundle id: the scans and generated
   * pages of the one hand-authored case. Every other page is drawn as an illegible
   * facsimile of its kind — a legible page for a case we are only standing in for would
   * be a fabricated court record.
   */
  pages?: Record<string, Pick<BundleDoc, "kind" | "src">>;
  /** Bundle ids whose upload is poor enough to worry about, beyond what the draft says. */
  poorScans?: string[];
}

export interface DraftCase {
  party: CaseParty;
  sections: SectionDef[];
  bundle: BundleDoc[];
  docRow: Record<string, string>;
}

/* ── value helpers ───────────────────────────────────────────────────────── */

function optionLabel(options: readonly Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function shown(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  return trimmed || NOT_PROVIDED;
}

function yesNo(value: YesNo | "" | undefined): string {
  return value === "yes" ? "Yes" : value === "no" ? "No" : NOT_PROVIDED;
}

function date(iso: string | undefined): string {
  return shown(toDisplayDate(iso ?? ""));
}

function money(amount: string): string {
  return shown(amount ? rupees(amount) : "");
}

function address(a: Address | undefined): string {
  return shown(addressToString(a));
}

/** Rich text as the form stores it (HTML), as paragraphs the row can set as prose. */
function prose(html: string): string {
  return shown(htmlToParagraphs(html).join("\n\n"));
}

/** Loose comparison for a machine reading against the filed value. */
function same(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm(a) === norm(b);
}

/* ── provenance ──────────────────────────────────────────────────────────── */

/** Which illegible page shape each upload is drawn as. */
const SHEET_FOR: Record<IntakeDocType, CaseDocumentKind> = {
  "cheque-front": "cheque",
  "return-memo": "memo",
  "demand-notice": "letter",
  "dispatch-proof": "receipt",
  "delivery-proof": "receipt",
  "notice-reply": "letter",
  "id-proof": "id",
  poa: "form",
  vakalatnama: "form",
  other: "letter",
  supporting: "receipt",
};

/**
 * Where a filed value came from.
 *
 * `key` is the reading's own field key (`ocr/fields.ts`), `filed` the raw draft value it
 * is compared against, and `show` formats a reading for the row the way the filed value
 * is formatted, so "₹ 50,25,000" is never set against "5025000".
 */
function readFrom(
  slot: IntakeSlot | undefined,
  key: string,
  filed: string,
  show: (raw: string) => string = (raw) => raw,
): Partial<Field> {
  if (!slot) return {};
  if (!slot.file) {
    return { nodoc: `No ${slot.label.toLowerCase()} uploaded` };
  }
  const source: Partial<Field> = { doc: slot.key };
  const extract = slot.extract;
  // Uploaded but never machine-read: the value points at its page and says nothing more.
  if (!extract) return source;
  const read = extract.fields[key];
  if (!read?.value) {
    return {
      ...source,
      ocrfail: true,
      failnote: `Not found on the ${slot.label.toLowerCase()}`,
    };
  }
  if (read.box && extract.page.width && extract.page.height) {
    const { x0, y0, x1, y1 } = read.box;
    const { width, height } = extract.page;
    const region: Rect = [
      (x0 / width) * 100,
      (y0 / height) * 100,
      ((x1 - x0) / width) * 100,
      ((y1 - y0) / height) * 100,
    ];
    source.region = region;
  }
  if (filed && !same(read.value, filed)) {
    // The filer kept their own value over the reading — that is the warning they dismissed.
    source.docread = show(read.value);
    source.skipped = true;
  }
  return source;
}

/**
 * The same, from whichever of several uploads actually yielded the value — the notice's
 * dispatch date is printed on the notice and stamped on the postal receipt, and the
 * officer is pointed at the one it was read from.
 */
function readFromFirst(
  slots: (IntakeSlot | undefined)[],
  key: string,
  filed: string,
  show?: (raw: string) => string,
): Partial<Field> {
  const found =
    slots.find((s) => s?.file && s.extract?.fields[key]?.value) ??
    slots.find((s) => s?.file) ??
    slots.find(Boolean);
  return readFrom(found, key, filed, show);
}

/* ── the builder ─────────────────────────────────────────────────────────── */

function group(
  id: string,
  icon: GroupIcon,
  title: string,
  fields: Field[],
): FieldGroupDef {
  return { id, icon, title, fields };
}

/** "Mobile number", or "Contact 2 · Mobile number" when there is more than one. */
function nth(label: string, prefix: string, index: number, count: number): string {
  return count > 1 ? `${prefix} ${index + 1} · ${label}` : label;
}

function contactFields(idPrefix: string, contacts: Contact[]): Field[] {
  return contacts.flatMap((contact, k) => [
    {
      id: `${idPrefix}-k${k + 1}-mob`,
      label: nth("Mobile number", "Contact", k, contacts.length),
      value: shown(contact.mobile && `+91 ${contact.mobile}`),
    },
    {
      id: `${idPrefix}-k${k + 1}-mail`,
      label: nth("Email address", "Contact", k, contacts.length),
      value: shown(contact.email),
    },
  ]);
}

function addressBlockFields(idPrefix: string, blocks: AddressBlock[]): Field[] {
  return blocks.flatMap((block, k) => [
    {
      id: `${idPrefix}-addr${k + 1}`,
      label: blocks.length > 1 ? `Address ${k + 1}` : "Address",
      value: address(block.addr),
    },
    {
      id: `${idPrefix}-ps${k + 1}`,
      label: nth("Police station", "Address", k, blocks.length),
      value: shown(block.police),
    },
  ]);
}

function complainantGroups(draft: FilingDraft): FieldGroupDef[] {
  const many = draft.complainants.length > 1;
  return draft.complainants.map((c, i) => {
    const n = i + 1;
    const p = `c${n}`;
    const idSlot = partySourceSlot(draft, i, "id-proof");
    const institution = c.type === "institution";
    const fields: Field[] = [
      {
        id: `${p}-pip`,
        label: "Party-in-person?",
        value: yesNo(c.pip),
      },
      {
        id: `${p}-type`,
        label: "Complainant type",
        value: institution ? "Institution" : "Individual",
      },
    ];

    if (!institution) {
      fields.push(
        { id: `${p}-mob`, label: "Mobile number", value: shown(c.mobile && `+91 ${c.mobile}`) },
        { id: `${p}-mail`, label: "Email address", value: shown(c.email) },
        {
          id: `${p}-name`,
          label: "Full name",
          value: shown(c.name),
          ...readFrom(idSlot, "name", c.name),
        },
        {
          id: `${p}-age`,
          label: "Age",
          value: shown(c.age),
          ...readFrom(idSlot, "age", c.age),
        },
        {
          id: `${p}-gender`,
          label: "Gender",
          value: shown(c.gender && optionLabel(GENDER_OPTIONS, c.gender)),
        },
        { id: `${p}-abled`, label: "Differently abled?", value: yesNo(c.differentlyAbled) },
        {
          id: `${p}-res`,
          label: "Residential address",
          value: address(c.res),
          ...readFrom(idSlot, "address", c.res.line1),
        },
        {
          id: `${p}-permsame`,
          label: "Permanent address same as residential?",
          value: yesNo(c.permSame),
        },
      );
      if (c.permSame === "no") {
        fields.push({ id: `${p}-perm`, label: "Permanent address", value: address(c.perm) });
      }
      fields.push({
        id: `${p}-poa`,
        label: "Power of attorney given?",
        value: yesNo(c.poa),
      });
      if (c.poa === "yes") {
        const h = c.poaHolder;
        fields.push(
          {
            id: `${p}-poa-mob`,
            label: "PoA holder mobile number",
            value: shown(h.mobile && `+91 ${h.mobile}`),
          },
          { id: `${p}-poa-name`, label: "PoA holder full name", value: shown(h.name) },
          { id: `${p}-poa-age`, label: "PoA holder age", value: shown(h.age) },
          { id: `${p}-poa-res`, label: "PoA holder residential address", value: address(h.res) },
          {
            id: `${p}-poa-permsame`,
            label: "PoA holder's permanent address same as residential?",
            value: yesNo(h.permSame),
          },
        );
        if (h.permSame === "no") {
          fields.push({
            id: `${p}-poa-perm`,
            label: "PoA holder permanent address",
            value: address(h.perm),
          });
        }
      }
    } else {
      const r = c.rep;
      fields.push(
        {
          id: `${p}-ent-type`,
          label: "Type of entity",
          value: shown(c.entType && optionLabel(ENTITY_TYPES, c.entType)),
        },
        { id: `${p}-ent-name`, label: "Entity name", value: shown(c.entName) },
        {
          id: `${p}-ent-phone`,
          label: "Contact number",
          value: shown(c.entPhone && `+91 ${c.entPhone}`),
        },
        { id: `${p}-ent-mail`, label: "Email address", value: shown(c.entEmail) },
        {
          id: `${p}-ent-cinpan`,
          label: "CIN or PAN",
          value: c.entCinPan.trim()
            ? c.entCinPan
            : c.entCinPanSkippedAt
              ? `Skipped — the filer declared on ${toLongDate(c.entCinPanSkippedAt.slice(0, 10))} that this case will not be linked to the complainant's other cases`
              : NOT_PROVIDED,
          ident: !!c.entCinPan.trim(),
        },
        { id: `${p}-ent-addr`, label: "Registered address", value: address(c.entAddr) },
        {
          id: `${p}-rep-mob`,
          label: "Authorised representative · Mobile number",
          value: shown(r.mobile && `+91 ${r.mobile}`),
        },
        { id: `${p}-rep-name`, label: "Authorised representative · Full name", value: shown(r.name) },
        { id: `${p}-rep-age`, label: "Authorised representative · Age", value: shown(r.age) },
        {
          id: `${p}-rep-mail`,
          label: "Authorised representative · Email address",
          value: shown(r.email),
        },
        {
          id: `${p}-rep-gender`,
          label: "Authorised representative · Gender",
          value: shown(r.gender && optionLabel(GENDER_OPTIONS, r.gender)),
        },
        {
          id: `${p}-rep-abled`,
          label: "Authorised representative · Differently abled?",
          value: yesNo(r.differentlyAbled),
        },
      );
    }

    if (c.pip === "yes") {
      fields.push({
        id: `${p}-pip-aff`,
        label: "Affidavit for appearing as party-in-person",
        value: prose(c.affidavit),
        long: true,
      });
    }

    const name = institution ? c.entName : c.name;
    return group(
      `compl${n}`,
      "user",
      many ? `Complainant ${n}${name.trim() ? ` · ${name.trim()}` : ""}` : "Complainant details",
      fields,
    );
  });
}

function advocateGroups(draft: FilingDraft): FieldGroupDef[] {
  if (!draft.advocates.length) return [];
  const many = draft.advocates.length > 1;
  return draft.advocates.map((a, i) => {
    const n = i + 1;
    const forAll =
      draft.complainants.length > 0 &&
      draft.complainants.every((_, ci) => a.forComplainants.includes(ci));
    const appearingFor = forAll
      ? draft.complainants.length > 1
        ? "All complainants"
        : "Complainant"
      : a.forComplainants
          .filter((ci) => ci < draft.complainants.length)
          .map((ci) => `Complainant ${ci + 1}`)
          .join(", ");
    return group(`advo${n}`, "scale", many ? `Advocate ${n}` : "Advocate details", [
      { id: `adv${n}-name`, label: "Advocate name", value: shown(advocateName(a)) },
      { id: `adv${n}-bar`, label: "Bar registration", value: shown(a.barNumber), ident: true },
      { id: `adv${n}-for`, label: "Advocate for", value: shown(appearingFor) },
    ]);
  });
}

function accusedGroups(draft: FilingDraft): FieldGroupDef[] {
  const many = draft.accused.length > 1;
  return draft.accused.map((a, i) => {
    const n = i + 1;
    const p = `a${n}`;
    const institution = a.type === "institution";
    const fields: Field[] = [
      { id: `${p}-type`, label: "Accused type", value: institution ? "Institution" : "Individual" },
    ];
    if (institution) {
      fields.push({
        id: `${p}-ent-type`,
        label: "Type of entity",
        value: shown(a.entType && optionLabel(ACCUSED_ENTITY_TYPES, a.entType)),
      });
    }
    fields.push({
      id: `${p}-name`,
      label: institution ? "Entity name" : "Full name",
      value: shown(a.name),
    });
    if (institution) {
      // S-141: everyone in charge of the business is summoned with the entity.
      a.reps.forEach((r, k) => {
        const tag = `Person summoned ${a.reps.length > 1 ? `${k + 1} ` : ""}·`;
        fields.push(
          { id: `${p}-r${k + 1}-name`, label: `${tag} Full name`, value: shown(r.name) },
          { id: `${p}-r${k + 1}-desig`, label: `${tag} Designation`, value: shown(r.designation) },
          {
            id: `${p}-r${k + 1}-mob`,
            label: `${tag} Mobile number`,
            value: shown(r.mobile && `+91 ${r.mobile}`),
          },
          { id: `${p}-r${k + 1}-mail`, label: `${tag} Email address`, value: shown(r.email) },
        );
      });
    }
    fields.push(...contactFields(p, a.contacts), ...addressBlockFields(p, a.addresses), {
      id: `${p}-juris`,
      label: "Resides within this court's jurisdiction?",
      value: yesNo(a.jurisdiction),
    });
    return group(
      `accu${n}`,
      "userSearch",
      many ? `Accused ${n}${a.name.trim() ? ` · ${a.name.trim()}` : ""}` : "Accused details",
      fields,
    );
  });
}

function chequeGroups(draft: FilingDraft): FieldGroupDef[] {
  const many = draft.cheques.length > 1;
  return draft.cheques.flatMap((c, i) => {
    const n = i + 1;
    const front = chequeSourceSlot(draft, i, "cheque-front");
    const memo = chequeSourceSlot(draft, i, "return-memo");
    const cheque: Field[] = [
      {
        id: `q${n}-no`,
        label: "Cheque number",
        value: shown(c.chequeNumber),
        ident: true,
        srcnote: "MICR band",
        ...readFrom(front, "chequeNumber", c.chequeNumber),
      },
      {
        id: `q${n}-date`,
        label: "Date on cheque",
        value: date(c.dateOnCheque),
        ...readFrom(front, "dateOnCheque", c.dateOnCheque, toDisplayDate),
      },
      {
        id: `q${n}-amt`,
        label: "Amount",
        value: money(c.amount),
        ...readFrom(front, "amount", c.amount, rupees),
      },
    ];
    if (i > 0) {
      cheque.push({
        id: `q${n}-same`,
        label: "Bank details same as the previous cheque?",
        value: yesNo(c.sameAsPrev),
      });
    }
    cheque.push(
      {
        id: `q${n}-ifsc`,
        label: "IFSC code",
        value: shown(c.ifsc),
        ident: true,
        ...readFrom(front, "ifsc", c.ifsc),
      },
      {
        id: `q${n}-bank`,
        label: "Bank name",
        value: shown(c.bankName),
        ...readFrom(front, "bankName", c.bankName),
      },
      {
        id: `q${n}-branch`,
        label: "Bank branch",
        value: shown(c.bankBranch),
        ...readFrom(front, "bankBranch", c.bankBranch),
      },
    );
    const returned: Field[] = [
      {
        id: `m${n}-pres`,
        label: "Date of presentation / deposit",
        value: date(c.presentDate),
        ...readFrom(memo, "presentDate", c.presentDate, toDisplayDate),
      },
      {
        id: `m${n}-ret`,
        label: "Date of return",
        value: date(c.returnDate),
        ...readFrom(memo, "returnDate", c.returnDate, toDisplayDate),
      },
      {
        id: `m${n}-why`,
        label: "Return reason",
        value: shown(c.returnReason && optionLabel(RETURN_REASONS, c.returnReason)),
        ...readFrom(memo, "returnReason", c.returnReason, (v) => optionLabel(RETURN_REASONS, v)),
      },
    ];
    return [
      group(`chq${n}`, "cheque", many ? `Cheque ${n}` : "Cheque details", cheque),
      group(
        `memo${n}`,
        "memo",
        many ? `Cheque ${n} · return memo` : "Cheque return memo",
        returned,
      ),
    ];
  });
}

function noticeGroups(draft: FilingDraft): FieldGroupDef[] {
  const many = draft.notices.length > 1;
  return draft.notices.map((nt, i) => {
    const n = i + 1;
    const p = `n${n}`;
    const letter = chequeSourceSlot(draft, i, "demand-notice");
    const dispatch = chequeSourceSlot(draft, i, "dispatch-proof");
    const delivery = chequeSourceSlot(draft, i, "delivery-proof");
    const fields: Field[] = [
      {
        id: `${p}-nature`,
        label: "Nature of debt or other liability",
        value: shown(nt.natureDebt && optionLabel(NATURE_OF_DEBT, nt.natureDebt)),
      },
      {
        id: `${p}-why`,
        label: "Why was the cheque issued?",
        value: shown(nt.whyIssued && optionLabel(WHY_ISSUED, nt.whyIssued)),
      },
      {
        id: `${p}-date`,
        label: "Date of dispatch of demand notice",
        value: date(nt.dispatchDate),
        ...readFromFirst([letter, dispatch], "dispatchDate", nt.dispatchDate, toDisplayDate),
      },
      {
        id: `${p}-mode`,
        label: "Mode of service",
        value: shown(nt.modeService && optionLabel(MODE_OF_SERVICE, nt.modeService)),
        ...readFrom(dispatch, "modeService", nt.modeService, (v) =>
          optionLabel(MODE_OF_SERVICE, v),
        ),
      },
      {
        id: `${p}-track`,
        label: "Tracking number",
        value: shown(nt.tracking),
        ident: !!nt.tracking.trim(),
        ...readFrom(dispatch, "tracking", nt.tracking),
      },
      { id: `${p}-del`, label: "Whether delivered?", value: yesNo(nt.delivered) },
    ];
    if (nt.delivered === "yes") {
      fields.push({
        id: `${p}-deldate`,
        label: "Date of delivery",
        value: date(nt.deliveryDate),
        ...readFrom(delivery, "deliveryDate", nt.deliveryDate, toDisplayDate),
      });
    } else {
      fields.push(
        { id: `${p}-retdate`, label: "Date of return as not delivered", value: date(nt.returnDate) },
        {
          id: `${p}-nondel`,
          label: "Reason for non-delivery",
          value: shown(
            nt.nonDeliveryReason && optionLabel(NON_DELIVERY_REASONS, nt.nonDeliveryReason),
          ),
        },
      );
    }
    fields.push(
      {
        id: `${p}-reply`,
        label: "Accused replied to the notice?",
        value: yesNo(nt.replied),
      },
      {
        id: `${p}-pay`,
        label: "Payment made by the drawer",
        value: shown(nt.paymentStatus && optionLabel(PAYMENT_STATUS, nt.paymentStatus)),
      },
    );
    if (nt.paymentStatus === "part") {
      fields.push({
        id: `${p}-part`,
        label: "Amount already paid",
        value: money(nt.partAmount),
      });
    }
    return group(
      `notice${n}`,
      "mail",
      many ? `Demand notice ${n}` : "Demand notice & debt",
      fields,
    );
  });
}

function jurisdictionGroup(draft: FilingDraft): FieldGroupDef {
  const j = draft.jurisdiction;
  const lim = limitationView(draft);
  const fields: Field[] = [
    {
      id: "j-deposit",
      label: "Cheque deposited in the payee's own account?",
      value: yesNo(j.deposited),
    },
  ];
  if (j.deposited === "yes") {
    fields.push(
      { id: "j-ifsc", label: "IFSC code", value: shown(j.ifsc), ident: true },
      { id: "j-bank", label: "Bank name", value: shown(j.payeeBankName) },
      { id: "j-branch", label: "Bank branch", value: shown(j.payeeBankBranch) },
      { id: "j-ps", label: "Police station of bank branch", value: shown(j.payeePolice) },
    );
  } else {
    fields.push({
      id: "j-ps",
      label: "Police station of drawer (accused) bank branch",
      value: shown(j.drawerPolice),
    });
  }
  fields.push({
    id: "j-other",
    label: "Other §138 complaint pending between the same parties?",
    value: yesNo(j.otherPending),
  });
  if (j.otherPending === "yes") {
    j.otherCases.forEach((oc, k) => {
      const tag = `Other complaint ${j.otherCases.length > 1 ? `${k + 1} ` : ""}·`;
      fields.push(
        { id: `j-oc${k + 1}-court`, label: `${tag} Court`, value: shown(oc.court) },
        {
          id: `j-oc${k + 1}-no`,
          label: `${tag} Case number`,
          value: shown(oc.caseNumber),
          ident: !!oc.caseNumber.trim(),
        },
      );
    });
  }
  fields.push(
    {
      id: "j-cause",
      label: "Date of cause of action",
      value: date(lim.causeDate),
      ...(lim.causeDerived
        ? { srcnote: "Worked out from the demand notice — 15 days after service" }
        : {}),
    },
    { id: "j-file", label: "Date of complaint filing", value: date(lim.filingDate) },
    {
      id: "j-limit",
      label: "Limitation period",
      value:
        lim.elapsed === null
          ? NOT_PROVIDED
          : lim.withinLimit
            ? "Within limitation"
            : `${plural(lim.overBy, "day")} beyond the one-month limit`,
    },
  );
  if (!lim.withinLimit && lim.elapsed !== null) {
    fields.push({
      id: "j-delay",
      label: "Reason for condonation of delay",
      value: prose(j.condonationReason),
      long: true,
    });
  }
  return group("jur", "pin", "Jurisdiction & limitation", fields);
}

const ADR_LABELS = { yes: "Yes", no: "No", maybe: "Maybe" } as const;

function prayerGroup(draft: FilingDraft): FieldGroupDef {
  return group("adr", "doc", "ADR, other details & prayer", [
    {
      id: "p-adr",
      label: "Willing to try ADR?",
      value: ADR_LABELS[draft.adr.adr] ?? NOT_PROVIDED,
    },
    { id: "p-other", label: "Other details", value: prose(draft.adr.otherDetails), long: true },
    { id: "p-interim", label: "Interim relief", value: prose(draft.adr.interimRelief), long: true },
    {
      id: "p-final",
      label: "Final relief",
      value: prose(draft.adr.finalRelief),
      long: true,
      doc: "complaint",
    },
  ]);
}

function witnessGroups(draft: FilingDraft): FieldGroupDef[] {
  // An optional section: a filing with no witnesses says so rather than going quiet.
  const named = draft.witnesses.filter(
    (w) => w.fullName.trim() || w.designation.trim(),
  );
  if (!named.length) {
    return [
      group("wit", "user", "Witnesses", [
        { id: "w-none", label: "Witnesses", value: "None listed" },
      ]),
    ];
  }
  const many = named.length > 1;
  return named.map((w, i) => {
    const n = i + 1;
    const p = `w${n}`;
    const fields: Field[] = [
      {
        id: `${p}-by`,
        label: "How is this witness identified?",
        value: w.fullName.trim() ? "By name" : "By designation",
      },
    ];
    if (w.fullName.trim()) {
      fields.push({ id: `${p}-name`, label: "Full name", value: w.fullName });
    }
    if (w.designation.trim() || !w.fullName.trim()) {
      fields.push({ id: `${p}-desig`, label: "Designation", value: shown(w.designation) });
    }
    fields.push(
      { id: `${p}-age`, label: "Age", value: shown(w.age) },
      { id: `${p}-prove`, label: "What will this witness prove?", value: prose(w.prove), long: true },
      ...contactFields(p, w.contacts),
      ...addressBlockFields(p, w.addresses),
    );
    const title = w.fullName.trim() || w.designation.trim();
    return group(`wit${n}`, "user", many ? `Witness ${n} · ${title}` : "Witness details", fields);
  });
}

/* ── the bundle ──────────────────────────────────────────────────────────── */

interface BundleBuild {
  bundle: BundleDoc[];
  docRow: Record<string, string>;
  documentGroups: FieldGroupDef[];
}

function intakeByKey(draft: FilingDraft): Map<string, IntakeSlot> {
  const slots = [
    ...draft.intake.cheques.flatMap((g) => g.slots),
    ...draft.intake.parties.flatMap((g) => g.slots),
    ...draft.intake.supporting,
  ];
  return new Map(slots.map((s) => [s.key, s]));
}

/**
 * The bundle in the complaint PDF's reading order — the generated synopsis, complaint
 * and affidavit, then every upload in the order the List of documents step lists it —
 * and the Evidence › Documents groups, one per group on that step.
 */
function buildBundle(draft: FilingDraft, options: DraftReadOptions): BundleBuild {
  const pages = options.pages ?? {};
  const poor = new Set(options.poorScans ?? []);
  const paper = draft.sign.mode === "upload";
  const bundle: BundleDoc[] = [];
  const docRow: Record<string, string> = {};

  const push = (doc: Omit<BundleDoc, "no">) => {
    const page = pages[doc.id];
    bundle.push({
      ...doc,
      ...(page ? { kind: page.kind, src: page.src, sheet: undefined } : {}),
      no: bundle.length + 1,
    });
  };

  push({ id: "synopsis", name: "Synopsis", kind: "facsimile", sheet: "letter" });
  push({ id: "complaint", name: "Complaint — filed details", kind: "facsimile", sheet: "letter" });
  push({
    id: "affidavit",
    // On paper the whole complaint is printed, signed by hand and uploaded as one file;
    // the affidavit the officer reads is that scan.
    name: paper ? "Affidavit (scanned & signed)" : "Affidavit",
    kind: "facsimile",
    sheet: "letter",
    poorScan: poor.has("affidavit") || undefined,
  });

  const slots = intakeByKey(draft);
  const documentGroups: FieldGroupDef[] = draft.documents.map((g) => {
    const fields: Field[] = g.docs.map((d) => {
      const key = d.intakeKey ?? d.id;
      const slot = d.intakeKey ? slots.get(d.intakeKey) : undefined;
      const rowId = `d-${key}`;
      if (!d.file) {
        return {
          id: rowId,
          label: d.name,
          value: d.required ? "Not uploaded" : "Not uploaded · optional",
        };
      }
      const bad = d.quality === "bad" || slot?.poor || poor.has(key);
      push({
        id: key,
        name: d.name,
        kind: "facsimile",
        sheet: slot ? SHEET_FOR[slot.docType] : "letter",
        poorScan: bad || undefined,
      });
      docRow[key] = rowId;
      return {
        id: rowId,
        label: d.name,
        value: `${d.file.name} · ${d.file.ext}`,
        docrow: key,
        ...(bad ? { scannote: "Poor scan — check for blur or missing pages" } : {}),
      };
    });
    return group(`docs-${g.id}`, "doc", `Documents · ${g.title}`, fields);
  });

  // The supporting upload has no row on the List of documents step; it still went in.
  for (const slot of draft.intake.supporting) {
    if (!slot.file) continue;
    push({ id: slot.key, name: slot.label, kind: "facsimile", sheet: SHEET_FOR[slot.docType] });
    docRow[slot.key] = `d-${slot.key}`;
    documentGroups[0]?.fields.push({
      id: `d-${slot.key}`,
      label: slot.label,
      value: `${slot.file.name} · ${slot.file.ext}`,
      docrow: slot.key,
    });
  }

  if (paper) {
    docRow.affidavit = "d-affidavit";
  }

  return { bundle, docRow, documentGroups };
}

/* ── affidavit and oath ──────────────────────────────────────────────────── */

function affidavitGroup(draft: FilingDraft): FieldGroupDef {
  const paper = draft.sign.mode === "upload";
  const fields: Field[] = [
    {
      id: "aff-body",
      label: "Affidavit of fact",
      value: prose(affidavitBody(draft)),
      long: true,
      doc: "affidavit",
    },
    {
      id: "aff-edited",
      label: "Standard text edited by the filer?",
      value: draft.affidavit.trim() ? "Yes" : "No — the standard text, composed from the case",
    },
  ];
  if (paper) {
    fields.push({
      id: "d-affidavit",
      label: "Signed copy (scanned)",
      value: draft.sign.signedCopy
        ? `${draft.sign.signedCopy.name} · ${draft.sign.signedCopy.ext}`
        : "Uploaded at filing",
      docrow: "affidavit",
    });
  }
  return group("aff", "doc", "Affidavit", fields);
}

function stamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // IST, as the live service records it.
  const ist = new Date(d.getTime() + 330 * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)}/${ist.getUTCFullYear()} · ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())} IST`;
}

/**
 * Who swore the affidavit, one row per person the court's rules ask an oath of. Only
 * where the filing records an oath (`signing.oath`: Gujarat, for now); elsewhere there is
 * nothing to read, so no group.
 */
function oathGroup(draft: FilingDraft, options: DraftReadOptions): FieldGroupDef | null {
  if (!options.signing.oath) return null;
  const { complainants, advocates } = signatories(
    draft,
    null,
    options.signing.oath,
    options.signing.everyAdvocate,
  );
  const fields: Field[] = [...complainants, ...advocates].map((sig, k) => {
    const oath = draft.sign.oaths[sig.id];
    return {
      id: `s-oath${k + 1}`,
      label: `Oath · ${sig.name}`,
      value: oath
        ? `${oath.video ? `Video recorded (${oath.video.file.name})` : "Recorded"} · ${stamp(oath.at)}`
        : "Not taken",
    };
  });
  return group("oath", "pen", "Oath", fields);
}

/* ── the whole case ──────────────────────────────────────────────────────── */

function partyName(draft: FilingDraft): { complainant: string; accused: string } {
  const first = draft.complainants[0];
  const c = first ? (first.type === "institution" ? first.entName : first.name) : "";
  const a = draft.accused[0]?.name ?? "";
  const others = (n: number) => (n > 1 ? ` and ${plural(n - 1, "other")}` : "");
  return {
    complainant: `${c.trim() || "Complainant"}${others(draft.complainants.length)}`,
    accused: `${a.trim() || "The accused"}${others(draft.accused.length)}`,
  };
}

export function caseFromDraft(draft: FilingDraft, options: DraftReadOptions): DraftCase {
  const { bundle, docRow, documentGroups } = buildBundle(draft, options);
  const names = partyName(draft);

  const sections: SectionDef[] = [
    {
      id: "party",
      num: "1",
      title: "Parties",
      groups: [...complainantGroups(draft), ...advocateGroups(draft), ...accusedGroups(draft)],
    },
    {
      id: "case",
      num: "2",
      title: "Case details",
      groups: [
        ...chequeGroups(draft),
        ...noticeGroups(draft),
        jurisdictionGroup(draft),
        prayerGroup(draft),
      ],
    },
    {
      id: "evid",
      num: "3",
      title: "Evidence",
      groups: [...witnessGroups(draft), ...documentGroups],
    },
  ];
  /* Signing and payment are not the scrutiny officer's to check, so they are not read
     here (owner, 2026-10-13). The oath is part of the affidavit: it is what swears it. */
  const oath = oathGroup(draft, options);
  sections.push({
    id: "aff",
    num: "4",
    title: oath ? "Affidavit and oath" : "Affidavit",
    groups: oath ? [affidavitGroup(draft), oath] : [affidavitGroup(draft)],
  });

  return {
    party: {
      complainant: names.complainant,
      accused: names.accused,
      submitted: draft.filedAt ? `Submitted ${toLongDate(draft.filedAt.slice(0, 10))}` : "Not yet submitted",
      advocate: draft.advocates[0] ? shown(advocateName(draft.advocates[0])) : "Party in person",
    },
    sections,
    bundle,
    docRow,
  };
}
