export const NEARBY_DATE_RADIUS = 5;
export const NEARBY_DATE_COUNT = NEARBY_DATE_RADIUS * 2 + 1;

/** Eleven local calendar dates around the committed day, across DST/months. */
export function nearbyDates(dayKey: string): Date[] {
  const centre = new Date(`${dayKey}T12:00:00`);
  return Array.from({ length: NEARBY_DATE_COUNT }, (_, index) => {
    const date = new Date(centre);
    date.setDate(centre.getDate() + index - NEARBY_DATE_RADIUS);
    return date;
  });
}

/** The full date square is the hit area; each segment previews one day. */
export function nearbyDateIndex(x: number, left: number, width: number): number {
  if (width <= 0) return NEARBY_DATE_RADIUS;
  return Math.max(0, Math.min(NEARBY_DATE_COUNT - 1, Math.floor(((x - left) / width) * NEARBY_DATE_COUNT)));
}
