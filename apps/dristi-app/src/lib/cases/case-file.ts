/**
 * Case file — the court's compiled documentary record (View Case handover §6).
 *
 * One tree, read everywhere the case file appears: the case's own Case file
 * section, the case file beside an order, and the download dialog. Sections
 * and their documents follow the registry (§6.2) below.
 *
 * Leaves point at the dummy Section 138 PDF pack under /case-file/. Each
 * section PDF starts with a cover page; child documents follow in order.
 */
import { caseSectionHref } from "./sections";

export type CaseFileNode = {
  id: string;
  /** Outline number: "1", "2.1", "5.1.1". */
  number: string;
  label: string;
  children?: CaseFileNode[];
  /** Public URL of the filed PDF. Absent on folders. */
  href?: string;
  /** 1-based page in `href`. Absent on folders and on whole-file leaves. */
  page?: number;
};

const CASE_FILE_PDF = {
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

export function isCaseFileFolder(node: CaseFileNode): boolean {
  return node.children !== undefined;
}

export function fileNumberLabel(number: string): string {
  return number.includes(".") ? number : `${number}.`;
}

export function flattenLeaves(nodes: CaseFileNode[]): CaseFileNode[] {
  const leaves: CaseFileNode[] = [];
  for (const node of nodes) {
    if (isCaseFileFolder(node)) {
      leaves.push(...flattenLeaves(node.children ?? []));
    } else {
      leaves.push(node);
    }
  }
  return leaves;
}

export function findNode(
  nodes: CaseFileNode[],
  id: string,
): CaseFileNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Root-to-node path, including the node itself. */
export function findPath(
  nodes: CaseFileNode[],
  id: string,
  trail: CaseFileNode[] = [],
): CaseFileNode[] | undefined {
  for (const node of nodes) {
    const next = [...trail, node];
    if (node.id === id) return next;
    if (node.children) {
      const found = findPath(node.children, id, next);
      if (found) return found;
    }
  }
  return undefined;
}

export function ancestorIds(nodes: CaseFileNode[], id: string): string[] {
  const path = findPath(nodes, id);
  if (!path || path.length < 2) return [];
  return path.slice(0, -1).map((node) => node.id);
}

export function firstLeaf(nodes: CaseFileNode[]): CaseFileNode | undefined {
  return flattenLeaves(nodes)[0];
}

export function parseCaseFileDoc(
  value: string | string[] | undefined,
  tree: CaseFileNode[] = CASE_FILE_TREE,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const leaves = flattenLeaves(tree);
  if (raw && leaves.some((node) => node.id === raw)) return raw;
  return firstLeaf(tree)?.id ?? "";
}

export type CaseFileView = "pdf" | "digital";

export function parseCaseFileView(
  value: string | string[] | undefined,
): CaseFileView {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "digital" ? "digital" : "pdf";
}

export function caseFileDocHref(
  caseId: string,
  docId: string,
  view: CaseFileView = "pdf",
): string {
  const base = caseSectionHref(caseId, "case-file");
  const join = base.includes("?") ? "&" : "?";
  const href = `${base}${join}doc=${docId}`;
  return view === "digital" ? `${href}&view=digital` : href;
}

/** Viewer URL, including a page fragment when the leaf is a child document. */
export function caseFilePdfSrc(node: CaseFileNode): string | undefined {
  if (!node.href) return undefined;
  return node.page ? `${node.href}#page=${node.page}` : node.href;
}

type Filed = {
  id: string;
  label: string;
  href: string;
  /** 1-based page in `href`. Absent when the whole file is the document. */
  page?: number;
};

/**
 * The case file registry (PRD §6.2): sections in the prescribed order, each
 * holding its documents in the prescribed order. Two levels, never deeper.
 * Display names follow the registry; where a type has several instances they
 * sit consecutively and are told apart by their variable part or a count.
 *
 * A section with nothing in it is left out of the tree, and sections are
 * numbered as shown, so the numbers a reader sees always run 1, 2, 3.
 * Registry sections with no document on this prototype case: Additional
 * Filings, Mandatory Submissions, Court Evidence, Notes, Bail Documents.
 */
const REGISTRY: { id: string; label: string; items: Filed[] }[] = [
  {
    id: "initial-filings",
    label: "Initial Filings",
    items: [
      {
        id: "dishonoured-cheque",
        label: "Cheque",
        href: CASE_FILE_PDF.initialFilings,
        page: 4,
      },
      {
        id: "cheque-return-memo",
        label: "Cheque Return Memo",
        href: CASE_FILE_PDF.initialFilings,
        page: 5,
      },
      {
        id: "legal-demand-notice",
        label: "Demand Notice",
        href: CASE_FILE_PDF.initialFilings,
        page: 2,
      },
      {
        id: "proof-of-dispatch",
        label: "Proof of dispatch of demand notice",
        href: CASE_FILE_PDF.initialFilings,
        page: 3,
      },
    ],
  },
  {
    id: "affidavits",
    label: "Affidavits",
    items: [
      {
        id: "affidavit-223-bnss",
        label: "Affidavit under Section 223 BNSS",
        href: CASE_FILE_PDF.affidavits,
        page: 2,
      },
      {
        id: "affidavit-225-bnss",
        label: "Affidavit under Section 225 BNSS",
        href: CASE_FILE_PDF.affidavits,
        page: 3,
      },
      {
        id: "pw1-chief-affidavit-145",
        label: "Affidavit under Section 145 NI Act",
        href: CASE_FILE_PDF.affidavits,
        page: 4,
      },
    ],
  },
  {
    id: "vakalats",
    label: "Vakalats",
    items: [
      {
        id: "vakalatnama-1",
        label: "Vakalatnama — Ramesh Menon",
        href: CASE_FILE_PDF.vakalats,
        page: 3,
      },
      {
        id: "vakalatnama-2",
        label: "Vakalatnama — P. Balachandran",
        href: CASE_FILE_PDF.vakalats,
        page: 4,
      },
    ],
  },
  {
    id: "evidence-complainant",
    label: "Evidence of Complainant",
    items: [
      {
        id: "witness-deposition-pw1",
        label: "Deposition of PW-1",
        href: CASE_FILE_PDF.evidenceComplainant,
        page: 2,
      },
      {
        id: "witness-deposition-pw2",
        label: "Deposition of PW-2",
        href: CASE_FILE_PDF.evidenceComplainant,
        page: 3,
      },
      {
        id: "exhibit-index-p1-p6",
        label: "Exhibit P1",
        href: CASE_FILE_PDF.evidenceComplainant,
        page: 4,
      },
    ],
  },
  {
    id: "examination-accused",
    label: "313 Examination and Plea of Accused",
    items: [
      {
        id: "plea",
        label: "313 Examination and Plea — Anand Traders",
        href: CASE_FILE_PDF.examinationAccused,
        page: 2,
      },
    ],
  },
  {
    id: "written-statement-accused",
    label: "Written Statement by Accused",
    items: [
      {
        id: "signed-statement-accused",
        label: "Written Statement — Anand Traders",
        href: CASE_FILE_PDF.examinationAccused,
        page: 4,
      },
    ],
  },
  {
    id: "evidence-accused",
    label: "Evidence of Accused",
    items: [
      {
        id: "witness-deposition-dw1",
        label: "Deposition of DW-1",
        href: CASE_FILE_PDF.evidenceAccused,
        page: 3,
      },
      {
        id: "exhibit-index-d1-d3",
        label: "Exhibit D1",
        href: CASE_FILE_PDF.evidenceAccused,
        page: 4,
      },
    ],
  },
  {
    id: "pending-applications",
    label: "Pending Applications",
    items: [
      {
        id: "application-production-return-memo",
        label: "Production of documents",
        href: "/case-file/17-application-production-return-memo.pdf",
      },
    ],
  },
  {
    id: "disposed-applications",
    label: "Disposed Applications",
    items: [
      {
        id: "application-advancement",
        label: "Advancement/reschedule · CMP 214/2025",
        href: "/case-file/14-application-advancement.pdf",
      },
      {
        id: "application-additional-witnesses",
        label: "Others · CMP 236/2025",
        href: "/case-file/15-application-additional-witnesses.pdf",
      },
      {
        id: "application-withdrawal",
        label: "Withdrawal · CMP 241/2025",
        href: "/case-file/16-application-withdrawal.pdf",
      },
      /* The registry lists the order disposing of an application in this
         section, after the applications, by date issued. */
      {
        id: "disposing-order-closing-complainant-evidence",
        label: "Order closing complainant evidence",
        href: CASE_FILE_PDF.orders,
        page: 6,
      },
    ],
  },
  {
    id: "memos",
    label: "Memos",
    items: [
      {
        id: "memo-cheque-calculation",
        label: "Memo",
        href: "/case-file/10-memo-cheque-calculation.pdf",
      },
    ],
  },
  {
    id: "processes",
    label: "Processes",
    items: [
      {
        id: "process-summons",
        label: "Summons",
        href: CASE_FILE_PDF.orders,
        page: 3,
      },
    ],
  },
  {
    id: "payment-receipts",
    label: "Payment Receipts",
    items: [
      "case-filing-payment",
      "summons-payment-receipt",
      "witness-process-fee",
      "partial-compensation-deposit",
    ].map((id, index) => ({
      id,
      label: `Payment Receipt ${index + 1}`,
      href: CASE_FILE_PDF.paymentReceipts,
      page: index + 2,
    })),
  },
  {
    id: "orders",
    label: "Orders",
    items: [
      { id: "order-cognizance", label: "Order taking cognizance" },
      { id: "order-issuing-summons", label: "Order issuing summons" },
      {
        id: "order-appearance-plea-bail",
        label: "Order on appearance, plea and bail",
      },
      {
        id: "order-day-evidence-complainant",
        label: "Order of the day · evidence of complainant",
      },
      {
        id: "order-closing-complainant-evidence",
        label: "Order closing complainant evidence",
      },
      {
        id: "order-day-351-examination",
        label: "Order of the day · section 351 examination",
      },
      {
        id: "order-closing-defence-evidence",
        label: "Order closing defence evidence",
      },
      { id: "order-reserving-judgment", label: "Order reserving judgment" },
      { id: "judgment", label: "Judgment and sentence order" },
    ].map((item, index) => ({
      ...item,
      href: CASE_FILE_PDF.orders,
      page: index + 2,
    })),
  },
];

/** Complaint is the registry's first section and always a single document, so
 *  it stands as a leaf rather than a folder of one. */
export const CASE_FILE_TREE: CaseFileNode[] = [
  {
    id: "complaint",
    number: "1",
    label: "Complaint",
    href: CASE_FILE_PDF.complaint,
  },
  ...REGISTRY.filter((section) => section.items.length > 0).map(
    (section, index): CaseFileNode => {
      const number = String(index + 2);
      return {
        id: section.id,
        number,
        label: section.label,
        children: section.items.map((item, itemIndex) => ({
          id: item.id,
          number: `${number}.${itemIndex + 1}`,
          label: item.label,
          href: item.href,
          page: item.page,
        })),
      };
    },
  ),
];
