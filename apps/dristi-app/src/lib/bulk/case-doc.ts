/**
 * Reading a case from one document: a Word file or a PDF that describes one S-138 case,
 * from which the fields of the bulk sheet are pulled out for the filer to review.
 *
 * STAND-IN. There is no model behind this in the demo. `caseDocText` reads the text of the
 * file (Word's XML, or the text layer of a simple PDF), and `extractCase` reads that text
 * by rule: section headings ("Accused 2", "Cheque details") and "Label: value" lines, with
 * the sheet's own headers and aliases as the labels, and a few patterns (an IFSC, a
 * six-digit cheque number) for what no label names. Its output is the shape a model would
 * return: one value per sheet column, each marked found or to check, with the line it came
 * from. `extractCase` is the one function a model replaces.
 *
 * It runs only when AI is on for the court (`aiMode`, or `?ai=`).
 */

import JSZip from "jszip";

import { documentText } from "./doc-text";
import { columnFit } from "./excel";
import {
  COLUMNS,
  GROUPS,
  LISTS,
  groupOf,
  listValue,
  normHeader,
  suffixFor,
  type Column,
  type Group,
  type GroupId,
  type Instance,
} from "./excel-spec";

export type Confidence = "found" | "check";

export type Extracted = {
  value: string;
  confidence: Confidence;
  /** The document line it was read from, for the review to point at. */
  line: number | null;
  /** Why it is marked to check. */
  note?: string;
};

export type CaseExtraction = {
  fileName: string;
  /** The document as lines of text; empty when nothing could be read. */
  lines: string[];
  /** By sheet header, in the template's form: "Cheque number", "Cheque number_2". */
  fields: Record<string, Extracted>;
};

/* ───────────────────────────── Text of the file ───────────────────────────── */

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unxml = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => XML_ENTITIES[e]).replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));

/** The text runs of a piece of Word XML, joined. */
const runs = (xml: string) => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => unxml(m[1])).join("");

/**
 * The text of a .docx, one line per paragraph. A table row of two cells reads as
 * "Label: value", since case sheets are often laid out that way.
 */
async function docxText(bytes: Uint8Array): Promise<string | null> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return null;
  const body = xml.replace(/<w:tr[\s>][\s\S]*?<\/w:tr>/g, (row) => {
    const cells = [...row.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((c) => runs(c[0]).trim());
    return `<w:p><w:t>${cells.filter(Boolean).join(cells.length === 2 ? ": " : " | ")}</w:t></w:p>`;
  });
  const lines = [...body.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((p) => runs(p[0]).trim());
  const text = lines.join("\n").trim();
  return text || null;
}

/** The text of a case document, or `null` when none can be read (a scan, an image). */
export async function caseDocText(bytes: Uint8Array, name: string, type: string): Promise<string | null> {
  if (/\.docx$/i.test(name) || /officedocument\.wordprocessingml/.test(type)) return docxText(bytes);
  if (/\.pdf$/i.test(name) || /pdf/.test(type)) return documentText(bytes, "application/pdf");
  if (/\.txt$/i.test(name) || type.startsWith("text/")) return new TextDecoder().decode(bytes).trim() || null;
  return null;
}

/* ───────────────────────────── Fields from the text ───────────────────────────── */

/** Words a document uses as a section heading, by section. */
const SECTION_WORDS: [GroupId, string[]][] = [
  ["person", ["person responsible", "director", "partner", "authorised signatory"]],
  ["address", ["address"]],
  ["accused", ["accused", "borrower", "drawer", "respondent"]],
  ["cheque", ["cheque", "check", "dishonoured cheque"]],
  ["notice", ["demand notice", "legal notice", "notice"]],
  ["witness", ["witness"]],
  ["otherCase", ["other pending case", "other case"]],
  ["jurisdiction", ["jurisdiction", "jurisdiction and limitation", "limitation"]],
  ["complainant", ["further complainant", "complainant"]],
  ["case", ["case", "case details", "loan", "loan details"]],
];

/** "Cheque 2", "ACCUSED NO. 1", "Demand notice details:" → the section and its number. */
function heading(line: string): { group: GroupId; n: number | null } | null {
  if (/:\s*\S/.test(line)) return null;
  const t = line.toLowerCase().replace(/[:.\-–]+$/, "").replace(/\bdetails?\b/g, "").replace(/\s+/g, " ").trim();
  const m = /^(.*?)(?:\s*(?:no\.?|number|#)?\s*(\d+))?$/.exec(t);
  if (!m) return null;
  const words = m[1].trim();
  for (const [group, list] of SECTION_WORDS) if (list.includes(words)) return { group, n: m[2] ? Number(m[2]) : null };
  return null;
}

/** What a column is called inside its own section: "Accused name" is "Name" under Accused 2. */
const PREFIX: Partial<Record<GroupId, RegExp>> = {
  accused: /^accused /i,
  address: /^accused /i,
  person: /^person responsible /i,
  cheque: /^cheque /i,
  notice: /^notice /i,
  witness: /^witness /i,
  complainant: /^complainant /i,
  otherCase: /^other pending case /i,
};
const shortLabel = (c: Column) => c.header.replace(PREFIX[c.group] ?? /^$/, "");

const fullLabels = (c: Column) => [c.header, ...c.aliases].map(normHeader);

/** The column a label names, preferring the section the line sits in. */
function columnFor(label: string, context: GroupId | null): Column | null {
  const n = normHeader(label);
  if (!n) return null;
  const inContext = (g: GroupId | null) =>
    g ? COLUMNS.filter((c) => c.group === g || (g === "accused" && groupOf(c.group).parent === "accused")) : [];
  // Within a section, its own short names first ("Name", "Date"), then full names.
  for (const c of inContext(context)) if (normHeader(shortLabel(c)) === n) return c;
  for (const c of inContext(context)) if (fullLabels(c).includes(n)) return c;
  for (const c of COLUMNS) if (fullLabels(c).includes(n)) return c;
  return null;
}

/** A value as the sheet takes it: amounts as digits, list words as the list's own label. */
function tidy(c: Column, raw: string): { value: string; confidence: Confidence; note?: string } {
  let value = raw.trim().replace(/\s+/g, " ");
  if (c.kind === "number") value = value.replace(/rs\.?|₹|inr|\/-|,/gi, "").trim();
  if (c.kind === "phone") value = value.replace(/[^\d+]/g, "");
  if (c.list) {
    const hit = listValue(c.list, value);
    if (hit) return { value: LISTS[c.list].find((o) => o.value === hit)!.label, confidence: "found" };
    // Close enough: an option whose words all appear in the value.
    const near = LISTS[c.list].find((o) => o.label.toLowerCase().split(/\W+/).filter((w) => w.length > 2).every((w) => value.toLowerCase().includes(w)));
    if (near) return { value: near.label, confidence: "check", note: `Read as "${near.label}" from "${value}"` };
    return { value, confidence: "check", note: "Not one of the court's options" };
  }
  const fit = columnFit(c, [value]);
  return fit.ok ? { value, confidence: "found" } : { value, confidence: "check", note: fit.note.replace(/^1 of 1 values are/, "This is") };
}

/** Patterns for required values a document states without a label we know. */
const PATTERNS: { key: string; re: RegExp; note: string }[] = [
  { key: "reference", re: /\b(?:loan|account|lan|ref(?:erence)?)\b[^:\n]*?\b([A-Z]{2,}[-/][A-Z0-9][A-Z0-9-/]{3,})\b/i, note: "Read from the text, not a labelled field" },
  { key: "chequeNumber", re: /cheque\s*(?:no\.?|number|#)?\s*[:.-]?\s*(\d{6})\b/i, note: "Read from the text, not a labelled field" },
  { key: "chequeAmount", re: /(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d+)?)/i, note: "The first amount in the document" },
  { key: "chequeIfsc", re: /\b([A-Z]{4}0[A-Z0-9]{6})\b/, note: "The first IFSC in the document" },
];

/**
 * The case's fields, read from its document's text. Every value carries where it came
 * from and whether to check it; nothing is filled that the document does not say.
 */
export function extractCase(fileName: string, text: string | null): CaseExtraction {
  const lines = (text ?? "").split(/\r?\n/).map((l) => l.trim());
  const fields: Record<string, Extracted> = {};
  // Where the reading is: the section, and which accused / cheque / witness.
  let context: GroupId | null = null;
  const nth: Partial<Record<GroupId, number>> = {};
  let accused = 1;

  const instanceOf = (g: Group): Instance => {
    if (!g.repeats) return [];
    if (g.parent) return [accused, nth[g.id] ?? 1];
    return [nth[g.id] ?? g.first];
  };

  lines.forEach((line, i) => {
    if (!line) return;
    const h = heading(line);
    if (h) {
      context = h.group;
      const g = groupOf(h.group);
      if (h.group === "accused") {
        accused = h.n ?? accused;
        nth.accused = accused;
        nth.address = 1;
        nth.person = 1;
      } else if (g.repeats) {
        // A further complainant is complainant 2 onwards: the batch's own is the first.
        nth[h.group] = h.n !== null ? (h.group === "complainant" && h.n < g.first ? g.first : h.n) : (nth[h.group] ?? g.first);
      }
      return;
    }
    const m = /^([^:]{2,60}?)\s*[:\-–]\s+(.+)$/.exec(line);
    if (!m) return;
    let label = m[1];
    // "Cheque number 2" names its own instance.
    const numbered = /^(.*?)\s+(\d+)$/.exec(label);
    if (numbered) label = numbered[1];
    const c = columnFor(label, context);
    if (!c) return;
    const g = groupOf(c.group);
    let inst = instanceOf(g);
    if (numbered && g.repeats && !g.parent) inst = [Number(numbered[2])];
    // A section inside an accused moves on when a field it already has comes again.
    const key = `${c.header}${suffixFor(g, inst)}`;
    if (fields[key] && g.parent) {
      nth[g.id] = (nth[g.id] ?? 1) + 1;
      inst = instanceOf(g);
    }
    const at = `${c.header}${suffixFor(g, inst)}`;
    if (fields[at]) return;
    fields[at] = { ...tidy(c, m[2]), line: i };
  });

  // Required values no label named, found by pattern and marked to check.
  for (const p of PATTERNS) {
    const c = COLUMNS.find((x) => x.key === p.key)!;
    const key = `${c.header}${suffixFor(groupOf(c.group), c.group === "case" ? [] : [1])}`;
    if (fields[key]) continue;
    const i = lines.findIndex((l) => p.re.test(l));
    if (i < 0) continue;
    const v = p.re.exec(lines[i])![1];
    fields[key] = { value: tidy(c, v).value, confidence: "check", line: i, note: p.note };
  }

  return { fileName, lines, fields };
}

/** Sections that have any field read, with the instances they reached. */
export function sectionsIn(extraction: CaseExtraction): GroupId[] {
  return GROUPS.filter((g) => COLUMNS.some((c) => c.group === g.id && Object.keys(extraction.fields).some((k) => k === c.header || k.startsWith(`${c.header}_`)))).map((g) => g.id);
}
