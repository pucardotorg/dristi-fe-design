/**
 * The advocate home's desktop grid, shared by the header and the board so their
 * edges line up the way the owner's wireframe draws them:
 *
 *   gutter | rail column               | content column                  | gutter
 *          | big date (header)         | greeting, title, week strip     |
 *          | timeline rail (panel)     | filters, concluded, live, next  |
 *
 * The rail column is 160px: the panel's 24px padding, the 112px rail and the
 * 24px gap before the hearings. The header's date column is the same 160px, so
 * the title, the strip and every hearing start on one line, and the date sits
 * centred over the rail's labels. Change one of these and the others must follow.
 */

/**
 * The page frame both the header and the board sit in: one 24px gutter, one
 * width cap. Anchored left, never centred, so opening the tasks panel only
 * narrows the board from the right: nothing on the left moves.
 */
export const HOME_FRAME = "lg:w-full lg:px-6";

/** Header: date column | content column (152px = panel padding + rail + gap). */
export const HOME_HEADER_COLS = "lg:grid-cols-[10rem_minmax(0,1fr)]";

/** The date block's own width inside its column: the rail's padding + rail, so it centres over the rail. */


/** Inside the panel, after its 24px padding: rail | hearings. */
export const HOME_RAIL_COLS = "lg:grid-cols-[7rem_minmax(0,1fr)] lg:gap-x-6";

/** The panel's own padding on a desktop. */
export const HOME_PANEL_PAD = "lg:px-6 lg:pt-4 lg:pb-4";
