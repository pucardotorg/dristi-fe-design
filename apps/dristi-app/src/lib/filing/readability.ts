import type { CaseDocument } from "./types";

/** Below this the court cannot read a scan — the same floor document reading uses. */
export const MIN_READABLE_EDGE = 500;

/**
 * Is this upload legible? Only the cheap, local check: a photo whose long edge is under
 * ~500px cannot be read at print size. PDFs carry their own resolution, so they pass.
 * Runs in the browser; the single filing and bulk filing both use it.
 */
export async function readability(file: File): Promise<CaseDocument["quality"]> {
  if (!file.type.startsWith("image/")) return "good";
  try {
    const bitmap = await createImageBitmap(file);
    const longEdge = Math.max(bitmap.width, bitmap.height);
    bitmap.close?.();
    return longEdge < MIN_READABLE_EDGE ? "bad" : "good";
  } catch {
    // Can't decode it here — don't accuse the file; the court's own check is the backstop.
    return "good";
  }
}
