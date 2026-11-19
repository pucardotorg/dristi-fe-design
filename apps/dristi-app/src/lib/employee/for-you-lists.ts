/**
 * The seats' own lists on the dashboard's "For you" tab: each is a card there, and a page
 * of its own one click away at `/employee/for-you/<slug>`. Names and routes only, so the
 * rail's trail can name the page without reaching into components.
 *
 * The magistrate's (note 1.2, Magistrate b–d, plus the cases reserved for judgment) and
 * the CMO / FSO's (CMO/FSO a–c; the scrutiny officer's seat, owner, 2026-11-17). Silent
 * cases and no next hearing date are on both.
 */

export type ForYouListId = "reserved" | "undated" | "far" | "silent" | "unpaid" | "summons";

export const FOR_YOU_LISTS: { id: ForYouListId; slug: string; title: string }[] = [
  { id: "reserved", slug: "reserved-for-judgment", title: "Reserved for judgment" },
  { id: "undated", slug: "no-next-hearing", title: "No next hearing date" },
  { id: "far", slug: "next-date-far-off", title: "Next date far off" },
  { id: "silent", slug: "silent-cases", title: "Silent cases" },
  { id: "unpaid", slug: "payment-not-made", title: "Payment not made" },
  { id: "summons", slug: "summons-with-no-update", title: "Summons with no update" },
];

export const forYouListHref = (id: ForYouListId) => `/employee/for-you/${FOR_YOU_LISTS.find((l) => l.id === id)!.slug}`;

export const forYouListBySlug = (slug: string) => FOR_YOU_LISTS.find((l) => l.slug === slug);
