/**
 * What the order composer knows about the case it is drafting for — the people a process
 * can go to, whether the accused has joined, and the order items an application decision
 * produces.
 *
 * Both doors onto the composer read it: a hearing (`ORD-05`) and a complaint at
 * cognizance (`ORD-06`). Kept apart from `order-composer.ts`, which holds the rules and
 * knows nothing about where a case's people come from.
 */

import { casePeopleFor, type CaseMatter } from "./case-people";
import {
  listingApplicationLabel,
  type ListingApplication,
  type ListingApplicationDecision,
} from "./listing-applications";
import {
  createItemBlock,
  type ComposerContext,
  type ItemBlock,
} from "./order-composer";
import type { OrderTemplateId } from "./order-templates";

/**
 * The composer's context for a matter: the people a process can go to, with their
 * addresses, mobiles and emails, and whether the accused has joined the case — both read
 * from `case-people.ts`, the court side's one source for the people on a case. A complaint
 * at cognizance passes `stage: "cognizance"`: nothing has issued, so nobody has joined.
 */
export function composerContextFor(matter: CaseMatter): ComposerContext {
  return casePeopleFor(matter);
}

/**
 * An application's type as the template's `[Application Type]` reads it — "Application
 * CMP/318/2026 for reschedule/adjournment is accepted", not "for Application to
 * reschedule/adjournment".
 */
export function applicationTypeWording(
  application: Pick<ListingApplication, "type">,
): string {
  const label = listingApplicationLabel(application).replace(
    /^Application (for|to) /,
    "",
  );
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/**
 * Which order item a decision on an application is (`APL-07`, `APL-09`): acceptance of
 * bail for a bail application, otherwise the generic accept or reject.
 */
export function decisionTemplate(
  application: Pick<ListingApplication, "type">,
  decision: ListingApplicationDecision,
): OrderTemplateId {
  if (decision === "dismissed") return "reject-application";
  return application.type === "bail" ? "acceptance-of-bail" : "accept-application";
}

/**
 * The order item block a decision adds — contextual, reached from the application, so its
 * number and type are read-only answers already given (`VAR-03`).
 */
export function decisionBlock(
  application: ListingApplication,
  decision: ListingApplicationDecision,
  context: ComposerContext,
  id?: string,
): ItemBlock {
  return createItemBlock(decisionTemplate(application, decision), context, {
    id,
    applicationId: application.id,
    values: {
      applicationNumber: application.number,
      applicationType: applicationTypeWording(application),
    },
  });
}
