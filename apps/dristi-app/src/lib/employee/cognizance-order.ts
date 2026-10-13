/**
 * The order a cognizance act draws up, before the judge has touched it.
 *
 * The PRD's bargain (§6): an act does not *perform* anything on its own. It opens the
 * order composer with its order items already loaded as blocks, and the judge edits and
 * sends it. This is the composer's **outside-a-hearing** door (`ORD-06`–`ORD-08` of
 * `order-generation.md`): no attendance and no next-hearing region, so the act's own
 * *Scheduling of hearing date* item is how the next date is set.
 *
 * | Act | Order items, in order |
 * |---|---|
 * | Take cognizance | acceptance of the delay application *(only when late)* · cognizance · issue of summons · scheduling of hearing |
 * | Issue notice | issue of notice · scheduling of hearing |
 * | Dismiss case | dismiss case |
 *
 * **None of them is fixed** (owner, 2026-10-13). Every item the act loads — the act's own
 * item included — can be removed, in all three order formats; the act only decides what
 * the order opens with.
 */

import {
  delayDays,
  hasDelay,
  type CognizanceAct,
  type CognizanceCase,
} from "./cognizance";
import {
  createItemBlock,
  type ComposerContext,
  type ItemBlock,
} from "./order-composer";

/**
 * How the condonation application is named in the order that accepts it — the head
 * alone, because the template supplies the rest: *"Application [Application Number] for
 * [Application Type] is accepted."*
 *
 * It has no row of its own anywhere: `OtherApplicationType` does not carry condonation of
 * delay, so the head is written out here and the number is derived from the filing number
 * — fixture arithmetic, marked as the gap it is.
 */
export const DELAY_APPLICATION_TYPE = "condonation of delay";

export function delayApplicationNumber(matter: CognizanceCase): string {
  const serial = matter.filingNumber.replace(/\D/g, "").slice(2, 6);
  return `CMP/${serial}/${matter.filingNumber.slice(-4)}`;
}

export type CognizanceComposition = {
  blocks: ItemBlock[];
};

/**
 * The blocks one act draws up, ready for the judge to edit. Ids are the order item's own,
 * so composing the same act twice gives the same ids.
 *
 * What the act already knows is answered: the delay application's number and head, the
 * DCA notice this act issues (the one `sign-process.ts` already writes). Who a summons or notice goes to and who takes steps follow the
 * process pre-selection rules (`AUT-02`, `AUT-05`) — at cognizance that is the accused,
 * with steps on the complainant. The next hearing's date and purpose are left to the
 * judge.
 */
export function cognizanceComposition(
  matter: CognizanceCase,
  act: CognizanceAct,
  context: ComposerContext,
): CognizanceComposition {
  /* No date and no purpose pre-filled: the catalogue gives *Scheduling of hearing date*
     no default for either (`order-template-catalogue.md`, 2026-10-06 (2)), which
     supersedes this act's earlier default purpose. */
  const scheduling = () =>
    createItemBlock("scheduling-of-hearing", context, {
      id: "scheduling-of-hearing",
    });

  if (act === "dismiss") {
    return {
      blocks: [createItemBlock("dismiss-case", context, { id: "dismiss-case" })],
    };
  }
  if (act === "notice") {
    return {
      blocks: [
        createItemBlock("issue-of-notice", context, {
          id: "issue-of-notice",
          values: { noticeType: "DCA" },
        }),
        scheduling(),
      ],
    };
  }
  return {
    blocks: [
      /* Ahead of cognizance, so the delay is disposed of before the act that depends on
         it. Only on a late complaint — there is no application otherwise. */
      ...(hasDelay(matter)
        ? [
            createItemBlock("accept-application", context, {
              id: "accept-application",
              values: {
                applicationNumber: delayApplicationNumber(matter),
                applicationType: DELAY_APPLICATION_TYPE,
              },
            }),
          ]
        : []),
      createItemBlock("cognizance", context, { id: "cognizance" }),
      createItemBlock("issue-of-summons", context, { id: "issue-of-summons" }),
      scheduling(),
    ],
  };
}

/**
 * The line under the title that says what this act does to the complaint.
 */
export function cognizanceOrderOutcome(
  matter: CognizanceCase,
  act: CognizanceAct,
): string {
  if (act === "dismiss") return "This complaint ends here.";
  if (act === "notice") {
    return "The accused is heard on the delay before the court decides it.";
  }
  const late = delayDays(matter);
  return late === null
    ? "The case is taken on file and proceeds to summons."
    : "The delay is condoned, the case is taken on file, and it proceeds to summons.";
}
