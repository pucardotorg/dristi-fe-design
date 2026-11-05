/**
 * The complaints to print for paper signing, one PDF each in one zip, named the way the
 * upload matches them back (`<reference>_signed.pdf`): print, sign by hand, scan, and the
 * scan keeps the name (round-3 audit: the paper path said print but offered nothing to).
 *
 * Prototype: each page carries the case's identifying facts and a signature block for
 * every party. The backend replaces it with the generated complaint itself.
 */

import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PrintCase = {
  reference: string;
  title: string;
  accused: string;
  cheque: string;
  amount: string;
};

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.45);

// The standard fonts cover WinAnsi only; anything else is dropped rather than failing.
const safe = (t: string) => t.replace(/[^\x20-\x7E]/g, "");

async function complaintPdf(c: PrintCase, signers: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 770;
  const line = (text: string, size = 12, f = font, color = INK) => {
    page.drawText(safe(text), { x: 64, y, size, font: f, color });
    y -= size + 10;
  };
  line("Complaint under Section 138, Negotiable Instruments Act", 15, bold);
  y -= 6;
  line(c.title, 12, bold);
  line(`Your reference: ${c.reference}`);
  if (c.accused) line(`Accused: ${c.accused}`);
  if (c.cheque) line(`Cheque: ${c.cheque}${c.amount ? `, ${c.amount}` : ""}`);
  y -= 24;
  line("Signed by", 12, bold);
  y -= 8;
  for (const s of signers) {
    page.drawLine({ start: { x: 64, y }, end: { x: 300, y }, thickness: 0.75, color: MUTED });
    y -= 16;
    line(s, 11, font, MUTED);
    y -= 18;
  }
  page.drawText(safe(`Scan the signed copy as ${c.reference}_signed.pdf`), { x: 64, y: 48, size: 9, font, color: MUTED });
  return pdf.save();
}

/** One zip of every complaint to print, with the name to save it under. */
export async function buildPrintPack(cases: PrintCase[], signers: string[]): Promise<Blob> {
  const zip = new JSZip();
  for (const c of cases) zip.file(`${safe(c.reference)}_signed.pdf`, await complaintPdf(c, signers));
  return zip.generateAsync({ type: "blob" });
}
