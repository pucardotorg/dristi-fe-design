/**
 * The case file in the format set by case-file.md (dristi-be PRDs, v30):
 * sections in the order the state's format gives (§6.2), documents named as
 * §3.1 gives, and Exhibits built from the evidence numbers actually given on
 * the case (CFL-09, CFL-31).
 *
 * The documents are the fictional PDF pack under /case-file/; names, dates
 * and receipt numbers are taken from those PDFs. Leaf ids are the older
 * tree's ids, so the digital read and the Documents register still resolve.
 * The links between orders and documents are sample data, set below.
 *
 * A document shown in a second place (CFL-04) gets `<id>@<where>`: an
 * exhibit `<id>@exhibits`, an order under a document `<order>@<document>`.
 * `caseFileBaseId` strips it.
 */
import type { CourtId } from "@/lib/court/profiles";

import type { CaseFileNode } from "./case-file";

type CategoryId =
  | "synopsis"
  | "complaint"
  | "original-filing"
  | "vakalatnamas"
  | "affidavits"
  | "applications"
  | "orders"
  | "judgment"
  | "roznamas"
  | "recorded-statements"
  | "processes"
  | "bail-bonds"
  | "payment-receipts"
  | "other-documents"
  | "exhibits";

const CATEGORY_LABEL: Record<CategoryId, string> = {
  synopsis: "Synopsis",
  complaint: "Complaint",
  "original-filing": "Original filing documents",
  vakalatnamas: "Vakalatnamas",
  affidavits: "Affidavits",
  applications: "Applications",
  orders: "Orders",
  judgment: "Judgment",
  roznamas: "Roznamas",
  "recorded-statements": "Recorded statements",
  processes: "Processes",
  "bail-bonds": "Bail bonds",
  "payment-receipts": "Payment receipts",
  "other-documents": "Other documents",
  exhibits: "Exhibits",
};

/** Categories whose documents can be marked as evidence (§1.2). */
const MARKABLE: ReadonlySet<CategoryId> = new Set([
  "original-filing",
  "affidavits",
  "applications",
  "recorded-statements",
  "other-documents",
]);

/** Synopsis, Complaint and Judgment hold one document, numbered as the section (CFL-02). */
const SINGLE: ReadonlySet<CategoryId> = new Set(["synopsis", "complaint", "judgment"]);

const PDF = {
  complaint: "/case-file/01-complaint.pdf",
  initialFilings: "/case-file/02-initial-filings.pdf",
  affidavits: "/case-file/03-affidavits.pdf",
  vakalats: "/case-file/04-vakalats.pdf",
  evidenceComplainant: "/case-file/05-evidence-of-complainant.pdf",
  evidenceAccused: "/case-file/06-evidence-of-accused.pdf",
  paymentReceipts: "/case-file/07-payment-receipts.pdf",
  examinationAccused: "/case-file/08-examination-of-accused.pdf",
  orders: "/case-file/09-orders.pdf",
} as const;

type Doc = {
  id: string;
  name: string;
  href: string;
  page?: number;
  docket?: boolean;
  category: CategoryId;
  /** Orders: the documents the order is linked to (§1.1). */
  links?: string[];
  /** A document submitted with an application or bail bond: that document's id. */
  parent?: string;
  /** An objection: the application it objects to (CFL-05). */
  objectsTo?: string;
  /** An execution report: the process it reports on. */
  reportOn?: string;
};

/**
 * Every document in the pack, by category, each category in the order the
 * documents came into the case (CFL-02). Dates are the PDFs' own.
 */
const DOCUMENTS: Doc[] = [
  { id: "synopsis", name: "Synopsis", href: "/case-file/19-synopsis.pdf", category: "synopsis" },
  { id: "complaint", name: "Complaint", href: PDF.complaint, category: "complaint" },

  /* Upload-slot names in e-filing's order (efiling.md §14, DSB-23); one file
     per slot, so no number. */
  { id: "dishonoured-cheque", name: "Cheque", href: PDF.initialFilings, page: 4, category: "original-filing" },
  { id: "cheque-return-memo", name: "Cheque return memo", href: PDF.initialFilings, page: 5, category: "original-filing" },
  { id: "legal-demand-notice", name: "Legal Demand Notice", href: PDF.initialFilings, page: 2, category: "original-filing" },
  { id: "proof-of-dispatch", name: "Proof of dispatch of demand notice", href: PDF.initialFilings, page: 3, category: "original-filing" },

  /* Named for the litigant, not the advocate. */
  { id: "vakalatnama-1", name: "Vakalatnama - Sunil Varghese", href: PDF.vakalats, page: 3, category: "vakalatnamas" },
  { id: "vakalatnama-2", name: "Vakalatnama - Anand Traders", href: PDF.vakalats, page: 4, category: "vakalatnamas" },

  /* Only affidavits submitted directly. The section 223 and 225 BNSS
     affidavits were made in e-filing, so they are part of the complaint
     (§1, row 5), not documents of their own. */
  { id: "pw1-chief-affidavit-145", name: "PW-1 chief affidavit under section 145 of the Negotiable Instruments Act", href: PDF.affidavits, page: 4, category: "affidavits" },
  { id: "affidavit-pw2", name: "Chief affidavit of PW-2", href: "/case-file/13-affidavit-pw2.pdf", category: "affidavits" },

  /* In the order filed, by the dates on the applications. */
  /* The pack gives this pending application no number. */
  { id: "application-production-return-memo", name: "Production of documents", href: "/case-file/17-application-production-return-memo.pdf", category: "applications" },
  { id: "application-withdrawal", name: "Application for withdrawal - CMP/241/2025", href: "/case-file/16-application-withdrawal.pdf", category: "applications" },
  { id: "application-additional-witnesses", name: "Application for adding witnesses - CMP/236/2025", href: "/case-file/15-application-additional-witnesses.pdf", category: "applications" },
  { id: "application-bail", name: "Bail - CMP/287/2025", href: "/case-file/22-application-documents.pdf", page: 2, category: "applications" },
  /* Bail's fixed attachments, named by their field (application-lifecycle.md); one surety, so no number. */
  { id: "bail-surety-id", name: "Document attached: Surety ID proof", href: "/case-file/22-application-documents.pdf", page: 3, category: "applications", parent: "application-bail" },
  { id: "bail-solvency", name: "Document attached: Proof of solvency", href: "/case-file/22-application-documents.pdf", page: 4, category: "applications", parent: "application-bail" },
  { id: "application-advancement", name: "Advance (prepone) - CMP/214/2025", href: "/case-file/14-application-advancement.pdf", category: "applications" },
  /* A supporting document, named by the filer. */
  { id: "advancement-bank-letter", name: "Document attached: Letter from the bank on PW-2's transfer", href: "/case-file/22-application-documents.pdf", page: 5, category: "applications", parent: "application-advancement" },
  { id: "objection-advancement", name: "Objection - CMP/214/2025", href: "/case-file/22-application-documents.pdf", page: 6, category: "applications", objectsTo: "application-advancement" },

  ...[
    /* Sample links, each to documents the order deals with. */
    { id: "order-cognizance", title: "Order taking cognizance", date: "3 July 2025", links: ["complaint"] },
    { id: "order-issuing-summons", title: "Order issuing summons", date: "7 July 2025", links: ["process-summons", "summons-payment-receipt"] },
    {
      id: "order-appearance-plea-bail",
      title: "Order on appearance, plea and bail",
      date: "12 August 2025",
      links: ["application-withdrawal", "application-additional-witnesses", "application-bail", "plea", "bail-bond", "vakalatnama-2"],
    },
    {
      id: "order-day-evidence-complainant",
      title: "Order of the day, complainant evidence",
      date: "15 September 2025",
      links: ["pw1-chief-affidavit-145", "application-advancement", "witness-deposition-pw1", "process-summons-pw2-rpad", "process-summons-pw2-hand"],
    },
    {
      id: "order-closing-complainant-evidence",
      title: "Order closing complainant evidence",
      date: "3 November 2025",
      links: ["affidavit-pw2", "witness-deposition-pw2", "process-summons-pw2-hand", "exhibit-index-p1-p6"],
    },
    {
      id: "order-day-351-examination",
      title: "Order of the day, section 351 examination",
      date: "1 December 2025",
      links: ["questionnaire-351-bnss", "signed-statement-accused"],
    },
    {
      id: "order-closing-defence-evidence",
      title: "Order closing defence evidence",
      date: "2 February 2026",
      links: ["witness-deposition-dw1", "exhibit-index-d1-d3"],
    },
    { id: "order-reserving-judgment", title: "Order reserving judgment", date: "6 April 2026", links: [] },
  ].map(
    (order, index): Doc => ({
      id: order.id,
      name: `Order: ${order.title} - ${order.date}`,
      href: PDF.orders,
      page: index + 2,
      docket: false,
      category: "orders",
      links: order.links,
    }),
  ),
  { id: "judgment", name: "Order: Judgment and sentence order - 5 May 2026", href: PDF.orders, page: 10, docket: false, category: "judgment" },

  /* Gujarat: the Roznama of each order, and a Roznama-type order for each
     hearing that had no other order. Neither is linked to documents. */
  ...[
    "3 July 2025",
    "7 July 2025",
    "12 August 2025",
    "15 September 2025",
    "6 October 2025",
    "3 November 2025",
    "1 December 2025",
    "12 January 2026",
    "2 February 2026",
    "16 March 2026",
    "6 April 2026",
    "5 May 2026",
  ].map(
    (date, index): Doc => ({
      id: `roznama-${index + 1}`,
      name: `Roznama - ${date}`,
      href: "/case-file/20-roznamas.pdf",
      page: index + 2,
      docket: false,
      category: "roznamas",
    }),
  ),

  /* Plea, the depositions and the examination of the accused, in the order recorded. */
  { id: "plea", name: "Plea record", href: PDF.examinationAccused, page: 2, category: "recorded-statements" },
  { id: "witness-deposition-pw1", name: "Deposition of PW-1", href: PDF.evidenceComplainant, page: 2, category: "recorded-statements" },
  { id: "witness-deposition-pw2", name: "Deposition of PW-2", href: PDF.evidenceComplainant, page: 3, category: "recorded-statements" },
  { id: "questionnaire-351-bnss", name: "Questionnaire under section 351 BNSS", href: PDF.examinationAccused, page: 3, category: "recorded-statements" },
  { id: "witness-deposition-dw1", name: "Deposition of DW-1", href: PDF.evidenceAccused, page: 3, category: "recorded-statements" },

  { id: "bail-bond", name: "Bail bond - Anand Traders", href: "/case-file/21-bail-bonds.pdf", page: 2, category: "bail-bonds" },
  /* No PRD sets this title yet (case-file.md Q-10); the surety bond's own title stands in. */
  {
    id: "bail-bond-surety",
    name: "Document attached: Surety bail bond of S. Mohanan",
    href: "/case-file/21-bail-bonds.pdf",
    page: 3,
    category: "bail-bonds",
    parent: "bail-bond",
  },

  /* Each process is one channel (process.md §3): the witness summons to PW-2 went by RPAD
     and By hand on one order. Execution reports sit under their process. */
  { id: "process-summons", name: "Summons via RPAD - 7 July 2025", href: "/case-file/23-processes.pdf", page: 2, category: "processes" },
  { id: "report-summons", name: "Execution report - 21 July 2025", href: "/case-file/23-processes.pdf", page: 3, category: "processes", reportOn: "process-summons" },
  { id: "process-summons-pw2-rpad", name: "Summons via RPAD - 15 September 2025", href: "/case-file/23-processes.pdf", page: 4, category: "processes" },
  { id: "report-summons-pw2-rpad", name: "Execution report - 1 October 2025", href: "/case-file/23-processes.pdf", page: 5, category: "processes", reportOn: "process-summons-pw2-rpad" },
  { id: "process-summons-pw2-hand", name: "Summons via By hand - 15 September 2025", href: "/case-file/23-processes.pdf", page: 6, category: "processes" },
  { id: "report-summons-pw2-hand", name: "Execution report - 30 September 2025", href: "/case-file/23-processes.pdf", page: 7, category: "processes", reportOn: "process-summons-pw2-hand" },

  ...[
    { id: "case-filing-payment", receipt: "RCPT-DUMMY-2025-0001", date: "12 June 2025" },
    { id: "summons-payment-receipt", receipt: "RCPT-DUMMY-2025-0002", date: "4 July 2025" },
    { id: "witness-process-fee", receipt: "RCPT-DUMMY-2025-0003", date: "20 October 2025" },
    { id: "partial-compensation-deposit", receipt: "RCPT-DUMMY-2026-0004", date: "10 May 2026" },
  ].map(
    (item, index): Doc => ({
      id: item.id,
      name: `${item.receipt} - ${item.date}`,
      href: PDF.paymentReceipts,
      page: index + 2,
      category: "payment-receipts",
    }),
  ),

  /* The two exhibit indexes came in with applications that are not in this
     pack, so they sit here rather than under an application. */
  { id: "exhibit-index-p1-p6", name: "Complainant exhibit index P1–P6", href: PDF.evidenceComplainant, page: 4, category: "other-documents" },
  { id: "signed-statement-accused", name: "Signed statement of accused", href: PDF.examinationAccused, page: 4, category: "other-documents" },
  { id: "exhibit-index-d1-d3", name: "Defence exhibit index D1–D3", href: PDF.evidenceAccused, page: 4, category: "other-documents" },
  { id: "memo-cheque-calculation", name: "Memo of calculation of cheque amount and interest", href: "/case-file/10-memo-cheque-calculation.pdf", category: "other-documents" },
];

type Section = { category: CategoryId };

/** §6.2: the starting format for each state. Roznamas only where the court setting is Yes (§6.1). */
const FORMAT: Record<CourtId, Section[]> = {
  gujarat: [
    "synopsis",
    "roznamas",
    "complaint",
    "original-filing",
    "affidavits",
    "applications",
    "orders",
    "judgment",
    "recorded-statements",
    "processes",
    "bail-bonds",
    "vakalatnamas",
    "exhibits",
    "other-documents",
    "payment-receipts",
  ].map((category) => ({ category: category as CategoryId })),
  "punjab-haryana": [],
  kerala: [],
};
FORMAT["punjab-haryana"] = FORMAT.gujarat.filter((s) => s.category !== "roznamas");
FORMAT.kerala = FORMAT["punjab-haryana"];

/** §6.1: Exhibits splits by party only where evidence is marked separately by party. */
const EVIDENCE_BY_PARTY: Record<CourtId, boolean> = {
  gujarat: false,
  "punjab-haryana": false,
  kerala: true,
};

const COPY = "@";

/** The document a node shows, for a copy shown in a second place (CFL-04). */
export function caseFileBaseId(id: string): string {
  return id.split(COPY)[0];
}

/** Whether a document's category lets it be marked as evidence (§1.2). */
export function isMarkableCaseFileDoc(id: string): boolean {
  const doc = DOCUMENTS.find((item) => item.id === caseFileBaseId(id));
  return Boolean(doc && markable(doc));
}

/** §1.2: of an application, only the documents submitted with it can be marked. */
function markable(doc: Doc): boolean {
  if (doc.category === "applications") return Boolean(doc.parent);
  return MARKABLE.has(doc.category);
}

/** A `doc` query value that names a document in this format, or undefined. */
export function caseFileFormatDoc(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  return DOCUMENTS.some((doc) => doc.id === caseFileBaseId(raw)) ? raw : undefined;
}

/** CFL-31: the exhibit number in brackets at the end of the name. */
function named(doc: Doc, exhibit: string | undefined): string {
  return exhibit ? `${doc.name} (${exhibit})` : doc.name;
}

type LinkedKind = "attachments" | "objections" | "reports" | "orders";

/** §6.2, "Linked to each document, in order": the kinds of linked document a section shows under each document. */
const LINKED_KINDS: Partial<Record<CategoryId, LinkedKind[]>> = {
  complaint: ["orders"],
  "original-filing": ["orders"],
  affidavits: ["orders"],
  applications: ["attachments", "objections", "orders"],
  "recorded-statements": ["orders"],
  processes: ["reports", "orders"],
  "bail-bonds": ["attachments", "orders"],
  vakalatnamas: ["orders"],
  exhibits: ["orders"],
  "other-documents": ["orders"],
  "payment-receipts": ["orders"],
};

/** The documents shown under `doc` in a section, in the format's order (CFL-03). */
function linkedTo(doc: Doc, section: CategoryId): Doc[] {
  return (LINKED_KINDS[section] ?? []).flatMap((kind) =>
    DOCUMENTS.filter((item) => {
      if (kind === "attachments") return item.parent === doc.id;
      if (kind === "objections") return item.objectsTo === doc.id;
      if (kind === "reports") return item.reportOn === doc.id;
      return item.category === "orders" && item.links?.includes(doc.id);
    }),
  );
}

/**
 * One document at `number`, with the documents linked to it numbered one
 * level below (CFL-03). Each linked document is a copy, so its id names the
 * node it sits under.
 */
function docNode(
  doc: Doc,
  id: string,
  number: string,
  section: CategoryId,
  exhibitFor: ExhibitFor,
): CaseFileNode {
  const linked = linkedTo(doc, section);
  return {
    id,
    number,
    label: named(doc, exhibitFor(doc.id)),
    href: doc.href,
    page: doc.page,
    docket: doc.docket,
    children:
      linked.length > 0
        ? linked.map((item, index) => ({
            id: `${item.id}${COPY}${id}`,
            number: `${number}.${index + 1}`,
            label: named(item, exhibitFor(item.id)),
            href: item.href,
            page: item.page,
            docket: item.docket,
          }))
        : undefined,
  };
}

function folder(id: string, number: string, label: string, children: CaseFileNode[]): CaseFileNode {
  return { id, number, label, children };
}

function numbered(
  docs: Doc[],
  number: string,
  section: CategoryId,
  exhibitFor: ExhibitFor,
  copyOf?: string,
): CaseFileNode[] {
  return docs.map((doc, index) =>
    docNode(doc, copyOf ? `${doc.id}${COPY}${copyOf}` : doc.id, `${number}.${index + 1}`, section, exhibitFor),
  );
}

/** Party of an exhibit from its prefix: P complainant, D accused, anything else other. */
function exhibitParty(exhibit: string): "complainant" | "accused" | "other" {
  if (/^P\d/i.test(exhibit)) return "complainant";
  if (/^D\d/i.test(exhibit)) return "accused";
  return "other";
}

const PARTY_ORDER = { complainant: 0, accused: 1, other: 2 } as const;

function byExhibit(exhibitFor: ExhibitFor) {
  return (a: Doc, b: Doc) => {
    const x = exhibitFor(a.id) ?? "";
    const y = exhibitFor(b.id) ?? "";
    const party = PARTY_ORDER[exhibitParty(x)] - PARTY_ORDER[exhibitParty(y)];
    return party || x.localeCompare(y, undefined, { numeric: true });
  };
}

export type ExhibitFor = (docId: string) => string | undefined;

/**
 * The case file for a state, numbered as shown (CFL-01, CFL-02, CFL-08).
 * `exhibitFor` gives a document's exhibit number, if it has one.
 */
export function caseFileTree(court: CourtId, exhibitFor: ExhibitFor): CaseFileNode[] {
  return FORMAT[court].map(({ category }, index): CaseFileNode => {
    const number = String(index + 1);
    const label = CATEGORY_LABEL[category];

    if (category === "exhibits") {
      const marked = DOCUMENTS.filter((doc) => markable(doc) && exhibitFor(doc.id)).sort(
        byExhibit(exhibitFor),
      );
      if (!EVIDENCE_BY_PARTY[court]) {
        return folder(category, number, label, numbered(marked, number, category, exhibitFor, category));
      }
      const parts = [
        { id: "complainant", label: "Evidence of the complainant" },
        { id: "accused", label: "Evidence of the accused" },
        { id: "other", label: "Other evidence" },
      ] as const;
      return folder(
        category,
        number,
        label,
        parts.map((part, partIndex) => {
          const sub = `${number}.${partIndex + 1}`;
          const docs = marked.filter((doc) => exhibitParty(exhibitFor(doc.id) ?? "") === part.id);
          return folder(`${category}-${part.id}`, sub, part.label, numbered(docs, sub, category, exhibitFor, category));
        }),
      );
    }

    /* Documents submitted with another sit under it, not in the section's own list. */
    /* Attachments, objections and execution reports sit under the document they belong to. */
    const docs = DOCUMENTS.filter(
      (doc) => doc.category === category && !doc.parent && !doc.objectsTo && !doc.reportOn,
    );

    if (category === "orders") {
      const parts = [
        { id: "linked", label: "Orders linked to other documents", docs: docs.filter((doc) => doc.links?.length) },
        { id: "independent", label: "Independent orders", docs: docs.filter((doc) => !doc.links?.length) },
      ];
      return folder(
        category,
        number,
        label,
        parts.map((part, partIndex) => {
          const sub = `${number}.${partIndex + 1}`;
          return folder(`${category}-${part.id}`, sub, part.label, numbered(part.docs, sub, category, exhibitFor));
        }),
      );
    }

    if (SINGLE.has(category) && docs.length === 1) {
      return docNode(docs[0], docs[0].id, number, category, exhibitFor);
    }

    return folder(category, number, label, numbered(docs, number, category, exhibitFor));
  });
}
