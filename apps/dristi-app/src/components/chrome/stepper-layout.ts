/**
 * The journey stepper on a phone (owner, Sept 21: the vakalatnama wizard's stepper
 * crammed six names under six circles on a phone).
 *
 * The DS stepper already centres each circle over its name and joins them with a
 * hairline. Below `md` the names drop away: six of them do not fit a phone (the
 * Malayalam collides even at caption size), so the page names the current step on one
 * line under the row instead. `STEP_CAPTION` styles that line.
 */
export const CENTRED_STEPPER = "max-md:[&_[data-slot=stepper-item]>div:last-child]:hidden";

/** The one line that names the current step where the names are hidden. */
export const STEP_CAPTION = "mt-3 text-center text-caption text-muted-foreground md:hidden";
