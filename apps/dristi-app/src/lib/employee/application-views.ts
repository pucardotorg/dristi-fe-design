import type { CourtTaskKind } from "@/lib/applications/lifecycle";

/** The Applications screen's lists: All open, and the two queues it folds together. */
export type ApplicationView = "all" | CourtTaskKind;

/** `?view=` as the URL carries it — `onboard` for the review queue, as the rail said it. */
export const VIEW_PARAM: Record<ApplicationView, string> = {
  all: "all",
  review: "onboard",
  decide: "decide",
};

/** A `?view=` value read off the URL; All open when it names none. */
export function readApplicationView(
  value: string | string[] | undefined,
): ApplicationView {
  const raw = Array.isArray(value) ? value[0] : value;
  const match = (Object.keys(VIEW_PARAM) as ApplicationView[]).find(
    (view) => VIEW_PARAM[view] === raw,
  );
  return match ?? "all";
}
