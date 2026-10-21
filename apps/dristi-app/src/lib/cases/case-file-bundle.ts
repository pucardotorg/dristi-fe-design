/**
 * Downloaded case file (View Case handover §6.3, ACT-01): one PDF holding the
 * case file tree in tree order (CF-01), a docket page before every document
 * the registry gives one (CF-02) showing where it sits in the tree (CF-03).
 *
 * Built in the browser from the filed PDFs under /case-file/. The cover page
 * and the index are generated here; the documents are copied page for page.
 * The backend replaces this with the server-side bundle (CF-04 freshness);
 * the dialog only needs a Blob back.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { isCaseFileFolder, type CaseFileNode } from "./case-file";

export type BundleCase = {
  caseNumber: string;
  /** "Complainant vs accused". */
  title: string;
  court: string;
};

type Entry = {
  number: string;
  label: string;
  /** "2.3  Cheque Return Memo   in   2  Initial Filings" */
  path: string;
  node: CaseFileNode;
  docket: boolean;
  firstPage: number;
  lastPage: number;
};

type IndexRow =
  | { kind: "section"; number: string; label: string }
  | { kind: "document"; entry: Entry };

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 64;
const ROW = 17;
const INK = rgb(0, 0, 0);
const MUTED = rgb(0.4, 0.4, 0.4);
const RULE = rgb(0.75, 0.75, 0.75);
const PANEL = rgb(0.95, 0.95, 0.95);

/** The standard fonts carry WinAnsi only; anything outside it would throw. */
function safe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E -ÿ–—•…]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of safe(text).split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function centred(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const value = safe(text);
  const x = (page.getWidth() - font.widthOfTextAtSize(value, size)) / 2;
  page.drawText(value, { x, y, size, font, color });
}

function right(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = INK) {
  const value = safe(text);
  page.drawText(value, { x: x - font.widthOfTextAtSize(value, size), y, size, font, color });
}

function parties(title: string): [string, string] {
  const [complainant, accused] = title.split(/\s+vs\.?\s+/i);
  return [complainant ?? title, accused ?? ""];
}

async function loadSources(nodes: CaseFileNode[]): Promise<Map<string, PDFDocument>> {
  const hrefs = [...new Set(nodes.map((node) => node.href).filter((href): href is string => !!href))];
  const docs = await Promise.all(
    hrefs.map(async (href) => {
      const response = await fetch(href);
      if (!response.ok) throw new Error(`Could not read ${href}`);
      return PDFDocument.load(await response.arrayBuffer(), { ignoreEncryption: true });
    }),
  );
  return new Map(hrefs.map((href, index) => [href, docs[index]]));
}

function documentPages(node: CaseFileNode, sources: Map<string, PDFDocument>): number[] {
  const source = node.href ? sources.get(node.href) : undefined;
  if (!source) return [];
  if (node.page) return [node.page - 1];
  return source.getPageIndices();
}

export async function buildCaseFileBundle(
  tree: CaseFileNode[],
  bundleCase: BundleCase,
): Promise<Blob> {
  const sections = tree.map((node) => ({
    node,
    leaves: isCaseFileFolder(node) ? (node.children ?? []) : [node],
  }));
  const sources = await loadSources(sections.flatMap((section) => section.leaves));

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [complainant, accused] = parties(bundleCase.title);

  // Plan the index first: its own length moves every page number after it.
  const rows: IndexRow[] = [];
  const entries: Entry[] = [];
  for (const { node, leaves } of sections) {
    if (isCaseFileFolder(node)) rows.push({ kind: "section", number: node.number, label: node.label });
    for (const leaf of leaves) {
      const entry: Entry = {
        number: leaf.number,
        label: leaf.label,
        path: leaf === node ? `${leaf.number}  ${leaf.label}` : `${leaf.number}  ${leaf.label}   in   ${node.number}  ${node.label}`,
        node: leaf,
        docket: leaf.docket !== false,
        firstPage: 0,
        lastPage: 0,
      };
      entries.push(entry);
      rows.push({ kind: "document", entry });
    }
  }
  const [width, height] = A4;
  const firstRows = Math.floor((height - 2 * MARGIN - 130) / ROW);
  const nextRows = Math.floor((height - 2 * MARGIN - 40) / ROW);
  // Split the index into pages, never leaving a section heading last on one.
  const indexChunks: IndexRow[][] = [[]];
  for (let i = 0; i < rows.length; i++) {
    let chunk = indexChunks[indexChunks.length - 1];
    const limit = indexChunks.length === 1 ? firstRows : nextRows;
    const strands = rows[i].kind === "section" && chunk.length === limit - 1;
    if (chunk.length >= limit || strands) {
      chunk = [];
      indexChunks.push(chunk);
    }
    chunk.push(rows[i]);
  }
  const indexPages = indexChunks.length;
  let cursor = 2 + indexPages;
  for (const entry of entries) {
    const count = documentPages(entry.node, sources).length + (entry.docket ? 1 : 0);
    entry.firstPage = cursor;
    entry.lastPage = cursor + count - 1;
    cursor += count;
  }

  // Cover page — download only, never in the on-screen tree (§6.2).
  const cover = pdf.addPage(A4);
  cover.drawRectangle({
    x: MARGIN, y: MARGIN + 40, width: width - 2 * MARGIN, height: height - 2 * MARGIN - 80,
    borderColor: INK, borderWidth: 1.5,
  });
  centred(cover, "IN THE COURT OF", height - 230, regular, 12);
  centred(cover, bundleCase.court.toUpperCase(), height - 248, regular, 12);
  centred(cover, bundleCase.caseNumber, height - 340, bold, 28);
  centred(cover, "Section 138, Negotiable Instruments Act", height - 368, regular, 12);
  centred(cover, complainant, height - 450, bold, 20);
  centred(cover, "Complainant", height - 470, regular, 12);
  centred(cover, "vs.", height - 505, regular, 12);
  centred(cover, accused, height - 545, bold, 20);
  centred(cover, "Accused", height - 565, regular, 12);
  const year = bundleCase.caseNumber.match(/(\d{4})\s*$/)?.[1];
  centred(cover, year ? `CASE FILE — ${year}` : "CASE FILE", MARGIN + 110, bold, 14);
  const generated = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  centred(cover, `Generated ${generated} IST`, MARGIN + 60, regular, 9, MUTED);

  // Index.
  for (let p = 0; p < indexPages; p++) {
    const page = pdf.addPage(A4);
    let y = height - MARGIN;
    if (p === 0) {
      centred(page, `${bundleCase.caseNumber}  ·  ${bundleCase.title}`, y, regular, 10);
      y -= 40;
      centred(page, "INDEX", y, bold, 18);
      y -= 44;
    }
    page.drawText("NO.", { x: MARGIN, y, size: 9, font: bold, color: MUTED });
    page.drawText("DOCUMENT", { x: MARGIN + 44, y, size: 9, font: bold, color: MUTED });
    right(page, "PAGES", width - MARGIN, y, bold, 9, MUTED);
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 0.6, color: INK });
    y -= ROW - 4;
    for (const item of indexChunks[p]) {
      if (item.kind === "section") {
        y -= 4;
        page.drawText(safe(item.number), { x: MARGIN, y, size: 10.5, font: bold });
        page.drawText(safe(item.label), { x: MARGIN + 44, y, size: 10.5, font: bold });
      } else {
        const { entry } = item;
        const nested = entry.number.includes(".");
        const x = nested ? MARGIN + 14 : MARGIN;
        const font = nested ? regular : bold;
        const pages = entry.firstPage === entry.lastPage ? `${entry.firstPage}` : `${entry.firstPage}–${entry.lastPage}`;
        const labelX = nested ? MARGIN + 58 : MARGIN + 44;
        page.drawText(safe(entry.number), { x, y, size: 10, font });
        page.drawText(safe(entry.label), { x: labelX, y, size: 10, font });
        const from = labelX + font.widthOfTextAtSize(safe(entry.label), 10) + 6;
        const to = width - MARGIN - regular.widthOfTextAtSize(pages, 10) - 6;
        if (to > from) {
          page.drawLine({ start: { x: from, y: y + 1 }, end: { x: to, y: y + 1 }, thickness: 0.6, color: RULE, dashArray: [1, 2] });
        }
        right(page, pages, width - MARGIN, y, regular, 10);
      }
      y -= ROW;
    }
  }

  // Documents, each behind its docket page.
  for (const entry of entries) {
    if (entry.docket) {
      const page = pdf.addPage(A4);
      centred(page, `BEFORE THE ${bundleCase.court.toUpperCase()}`, height - 110, regular, 11);
      centred(page, bundleCase.caseNumber, height - 150, bold, 16);
      centred(page, `${complainant}  ...  Complainant`, height - 190, regular, 12);
      centred(page, "vs.", height - 210, regular, 12);
      centred(page, `${accused}  ...  Accused`, height - 230, regular, 12);
      page.drawLine({ start: { x: MARGIN + 60, y: height - 260 }, end: { x: width - MARGIN - 60, y: height - 260 }, thickness: 0.8 });
      let y = height - 330;
      for (const line of wrap(entry.label.toUpperCase(), bold, 20, width - 2 * MARGIN - 40)) {
        centred(page, line, y, bold, 20);
        y -= 26;
      }
      page.drawRectangle({ x: MARGIN, y: MARGIN + 50, width: width - 2 * MARGIN, height: 44, color: PANEL });
      page.drawText("LOCATION IN CASE FILE", { x: MARGIN + 12, y: MARGIN + 80, size: 8, font: regular, color: MUTED });
      page.drawText(safe(entry.path), { x: MARGIN + 12, y: MARGIN + 62, size: 11, font: bold });
    }
    const source = entry.node.href ? sources.get(entry.node.href) : undefined;
    if (source) {
      const copied = await pdf.copyPages(source, documentPages(entry.node, sources));
      for (const page of copied) pdf.addPage(page);
    }
  }

  // Running footer on every page, filed documents included.
  const footer = safe(`${bundleCase.caseNumber}  ·  ${bundleCase.title}`);
  pdf.getPages().forEach((page, index) => {
    const pageWidth = page.getWidth();
    page.drawText(footer, { x: 36, y: 20, size: 8, font: regular, color: MUTED });
    right(page, `Page ${index + 1}`, pageWidth - 36, 20, regular, 8, MUTED);
  });

  pdf.setTitle(`${bundleCase.caseNumber} — Case file`);
  pdf.setCreator("DRISTI");
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
