/**
 * The type Gujarat registers each sample complaint as, by its CMP sequence (owner,
 * 2026-10-13): a delayed complaint is a criminal miscellaneous application (`eCR MA`),
 * one outside this court's jurisdiction a criminal inquiry (`eCR EN`) — jurisdiction
 * first where both apply — and the rest criminal cases (`eCC`).
 *
 * Every queue row is listed, eCC too, so none falls to the sequence rule other
 * sample cases use. Written out rather than derived because the number rule (`localize.ts`) runs on plain
 * text and cannot see a complaint's facts. `cognizance.test.ts` checks every entry
 * against those facts, so the number shown and the tab it sits on cannot drift.
 */
export const GUJARAT_CASE_TYPE_BY_CMP: Record<number, "eCC" | "eCR EN" | "eCR MA"> = {
  2041: "eCR EN",
  2015: "eCR EN",
  1954: "eCR EN",
  1847: "eCR EN",
  2009: "eCR MA",
  1987: "eCR MA",
  1931: "eCR MA",
  1893: "eCR MA",
  1866: "eCR MA",
  1836: "eCR MA",
  2038: "eCC",
  2030: "eCC",
  2022: "eCC",
  1998: "eCC",
  1975: "eCC",
  1966: "eCC",
  1943: "eCC",
  1920: "eCC",
  1912: "eCC",
  1904: "eCC",
  1885: "eCC",
  1877: "eCC",
  1858: "eCC",
  1825: "eCC",
};
