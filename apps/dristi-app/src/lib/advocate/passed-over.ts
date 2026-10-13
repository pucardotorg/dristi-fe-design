import { pick, type Locale } from "@/lib/onboarding/content";
import { advHome } from "./content";

/**
 * "Passed over", the same whether the court passed the matter over today or
 * carried it from an earlier day. The day of the decision is not the advocate's
 * concern on the board; the case's own history keeps it.
 */
export function passedOverLabel(locale: Locale): string {
  return pick(advHome.statusPassedOver, locale);
}
