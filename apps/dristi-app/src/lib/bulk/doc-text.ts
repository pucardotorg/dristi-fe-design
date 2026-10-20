/**
 * The text of an uploaded document, for the AI review to read.
 *
 * A stand-in for the document-reading service: it reads the text layer of a simple PDF
 * (text drawn with `Tj`, uncompressed, as the Provakil mock's documents are). A scan, an
 * image or a compressed PDF has no text it can read, and comes back `null` — the review
 * then says nothing about that document rather than guessing. The single filing reads
 * documents in the browser with Tesseract and pdf.js (`lib/filing/ocr`); the live service
 * replaces both.
 */

export function documentText(bytes: Uint8Array, type: string): string | null {
  if (!/pdf/i.test(type) && !(bytes[0] === 0x25 && bytes[1] === 0x50)) return null;
  const raw = new TextDecoder("latin1").decode(bytes);
  const parts: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    parts.push(m[1].replace(/\\([\\()])/g, "$1"));
  }
  const text = parts.join("\n").trim();
  return text ? text : null;
}
