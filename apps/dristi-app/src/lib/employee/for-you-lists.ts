/**
 * The magistrate's own lists on the dashboard's "For you" tab (note 1.2, Magistrate b–d,
 * plus the cases reserved for judgment): each is a card there, and a page of its own one
 * click away at `/employee/for-you/<slug>`. Names and routes only, so the rail's trail can
 * name the page without reaching into components.
 */

export type ForYouListId = "reserved" | "undated" | "far" | "silent";

export const FOR_YOU_LISTS: { id: ForYouListId; slug: string; title: string }[] = [
  { id: "reserved", slug: "reserved-for-judgment", title: "Reserved for judgment" },
  { id: "undated", slug: "no-next-hearing", title: "No next hearing date" },
  { id: "far", slug: "next-date-far-off", title: "Next date far off" },
  { id: "silent", slug: "silent-cases", title: "Silent cases" },
];

export const forYouListHref = (id: ForYouListId) => `/employee/for-you/${FOR_YOU_LISTS.find((l) => l.id === id)!.slug}`;

export const forYouListBySlug = (slug: string) => FOR_YOU_LISTS.find((l) => l.slug === slug);
