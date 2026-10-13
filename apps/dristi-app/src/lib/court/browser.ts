/**
 * The selected court, read in the browser outside React — for the document downloads,
 * which build their files in plain functions on a click and have no provider to ask.
 *
 * It reads the same cookie the provider writes (`CourtProvider`), so a download always
 * carries the court the screen was showing. Off the browser it answers Kerala.
 */

import { localizeCourtText, localizeDeep } from "./localize";
import { COURT_COOKIE, DEFAULT_COURT, toCourtId, type CourtId } from "./profiles";

export function browserCourt(): CourtId {
  if (typeof document === "undefined") return DEFAULT_COURT;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COURT_COOKIE}=`));
  const value = entry?.slice(COURT_COOKIE.length + 1);
  return toCourtId(value) ?? DEFAULT_COURT;
}

/** A downloaded document's text, in the selected court's names and numbers. */
export function localizeForDownload(text: string): string {
  return localizeCourtText(text, browserCourt());
}

/** A record as the selected court shows it, for what a download names itself after. */
export function voicedForDownload<T>(record: T): T {
  return localizeDeep(record, browserCourt());
}
