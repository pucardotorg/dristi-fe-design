/**
 * What the application dialog decided before opening the order screen — Accept or Reject
 * on a decide task, Dismiss on a review task — carried in the order's URL so the order
 * opens with that decision's catalogue item already added (owner, 2026-10-14).
 *
 * Plain data, so the server page can read the URL and the client screen can act on it.
 */

export type ApplicationOrderDecision = "accept" | "reject" | "dismiss";

export function isApplicationOrderDecision(
  value: string | undefined,
): value is ApplicationOrderDecision {
  return value === "accept" || value === "reject" || value === "dismiss";
}

/**
 * Where an application's order is drawn up: under its one Applications queue. `view` is
 * the list the workstation was working, carried so the way back lands on the same list.
 */
export function applicationOrderHref(
  applicationId: string,
  decision?: ApplicationOrderDecision,
  view?: string,
): string {
  const base = `/employee/applications/${encodeURIComponent(applicationId)}/order`;
  const query = new URLSearchParams();
  if (decision) query.set("decision", decision);
  if (view) query.set("view", view);
  const search = query.toString();
  return search ? `${base}?${search}` : base;
}

/** The application itself: open as a pop-up over the list it was opened from. */
export function applicationHref(applicationId: string, view?: string): string {
  const query = new URLSearchParams({ view: view || "all", open: applicationId });
  return `/employee/applications?${query.toString()}`;
}
