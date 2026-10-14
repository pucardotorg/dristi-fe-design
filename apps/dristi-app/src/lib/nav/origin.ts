/**
 * Where the person came from, carried in the URL.
 *
 * The app has no back button, so the breadcrumb is the way back — and a breadcrumb that
 * describes a hierarchy instead of a journey sends people somewhere they have never
 * been. The scrutiny correction round is the case that made this obvious: it lives at
 * `/tasks/<id>/fix` whichever door you came through, so its trail always began at Tasks
 * — even for the advocate who reached it from the "Returned with defects" tab of their
 * filings queue, two areas away. Following that root did not take them back; it moved
 * them.
 *
 * So the door is recorded when it is used. A cross-area link carries `?from=<relative
 * URL>`, the screen it lands on roots its trail there, and the way back is the exact URL
 * the person left — tab, search, sort and page still on it.
 *
 * The value is a **relative path only**, checked on the way in and on the way out. It
 * arrives from the address bar, which anyone can type into, and it is rendered as an
 * `href`: an absolute URL or a protocol-relative `//host` would turn the breadcrumb root
 * into an off-site link.
 */

import { TASKS_HOME } from "@/lib/tasks/routes";

export const ORIGIN_PARAM = "from";

/** Longer than any view this app writes; a guard against a pathological address bar. */
const MAX_ORIGIN_LENGTH = 512;

/**
 * The areas the shell hosts, longest prefix first. The label is what the breadcrumb
 * calls the area — the same words the rail uses for it — and the href is where its
 * root goes when there is no recorded origin to be more specific.
 */
const AREAS: { prefix: string; label: string; href?: string }[] = [
  { prefix: "/filings", label: "File a case", href: "/filings" },
  { prefix: "/tasks", label: "Take action", href: TASKS_HOME },
  { prefix: "/cases", label: "Cases", href: "/cases" },
  { prefix: "/vakalatnama", label: "Vakalatnama", href: "/vakalatnama" },
  {
    prefix: "/raise-application",
    label: "Raise application",
    href: "/raise-application",
  },
  { prefix: "/people", label: "People", href: "/people" },
  { prefix: "/settings", label: "Settings" },
  { prefix: "/advocate", label: "Home", href: "/advocate" },
  { prefix: "/home", label: "Home", href: "/home" },
];

/** The area a path belongs to. Pending tasks is the fallback: it is the shell's own home. */
export function areaOf(path: string): { label: string; href?: string } {
  const match = AREAS.find((area) => path.startsWith(area.prefix));
  return match
    ? { label: match.label, href: match.href }
    : { label: "Take action", href: TASKS_HOME };
}

/**
 * A recorded origin, or null. Same-origin relative URLs only — one leading slash, no
 * second one (`//host` is protocol-relative), no scheme, no backslashes (which some
 * browsers normalise into slashes).
 */
export function safeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length > MAX_ORIGIN_LENGTH) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.includes("\\")) return null;
  return value;
}

/** `href` with the door recorded on it. An unusable origin is simply not recorded. */
export function withOrigin(href: string, from: string | null | undefined): string {
  const origin = safeOrigin(from);
  if (!origin) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${ORIGIN_PARAM}=${encodeURIComponent(origin)}`;
}

/** The crumb a recorded origin becomes: the area's name, pointing at the exact view. */
export function originCrumb(from: string | null | undefined): { label: string; href: string } | null {
  const origin = safeOrigin(from);
  if (!origin) return null;
  return { label: areaOf(origin).label, href: origin };
}
