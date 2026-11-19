/**
 * Home's card footers sit on a warm beige band a step darker than the page (owner, 2026-11-19).
 * The DS drops a raised card's footer fill because its usual fill is the page's own colour; this
 * puts back one a step darker (neutral 3, the accent tone) so the band shows. A ghost button in
 * the band hovers one step darker again (accent-strong) so its hover still reads.
 */
export const FOOTER_BAND = "group-data-[variant=raised]/card:bg-accent";
export const FOOTER_GHOST = "hover:bg-accent-strong";
