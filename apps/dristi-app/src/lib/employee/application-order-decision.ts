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

/** Where an application's order is drawn up: under its one Applications queue. */
export function applicationOrderHref(
  applicationId: string,
  decision?: ApplicationOrderDecision,
): string {
  const base = `/employee/applications/${encodeURIComponent(applicationId)}/order`;
  return decision ? `${base}?decision=${decision}` : base;
}
