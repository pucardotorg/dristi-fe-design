/**
 * Longer, formatted shortcuts a browser starts on, beside the catalogue's one-liners
 * (owner, 2026-10-16: "make up some plausible sample templates by looking up orders …
 * including ones with multiple paragraphs, formatting, and bullet points").
 *
 * **Samples, not the court's wording.** Each is modelled on how §138 order sheets are
 * written — the Kollam 24×7 ON Court order frame in `Order template.pdf`, and reported
 * orders on interim compensation (§143A), plea in summary trial, and compounding (§147).
 * They are demo text a court would replace with its own. Statutory references other than
 * the NI Act's are the post-1 July 2024 BNSS ones and, like every section number here,
 * must be checked against the official text before anything relies on them.
 *
 * `[…]` marks a blank: the editor selects the first one when the shortcut goes in.
 */

import type { OrderShortcut } from "./order-shortcuts";

type Sample = { id: string; name: string; html: string };

const SAMPLES: readonly Sample[] = [
  {
    id: "sample-rich-cognizance-process",
    name: "Cognizance and issue of process",
    html: [
      "<p>Complainant present through counsel. Perused the complaint, the sworn statement of the complainant filed on affidavit under <b>Section 145 of the Negotiable Instruments Act, 1881</b>, and the documents produced, namely:</p>",
      "<ol>",
      "<li>the original cheque No. [Cheque Number] dated [Cheque Date] for <b>₹[Cheque Amount]</b>;</li>",
      "<li>the bank's return memo dated [Return Memo Date] stating the reason \"[Return Reason]\";</li>",
      "<li>the copy of the statutory demand notice dated [Notice Date] with its postal receipt; and</li>",
      "<li>the proof of delivery of the notice on [Delivery Date].</li>",
      "</ol>",
      "<p>The complaint is filed within time. The accused has not paid the cheque amount within fifteen days of receipt of the notice. On the materials placed, I am prima facie satisfied that the offence punishable under <b>Section 138 of the NI Act</b> is made out against the accused.</p>",
      "<p><b>Cognizance taken.</b> Register the case as a Summary Trial. Issue summons to the accused, returnable on the next date. The complainant shall take steps within <u>seven days</u>.</p>",
    ].join(""),
  },
  {
    id: "sample-rich-plea-not-guilty",
    name: "Plea recorded — not guilty",
    html: [
      "<p>Accused present on bail. Counsel for both sides present.</p>",
      "<p>The particulars of the offence under Section 138 of the NI Act were stated to the accused in [Language], the language the accused understands. The accused <b>pleaded not guilty</b> and claimed to be tried. Plea recorded and signed.</p>",
      "<p>The complainant's affidavit under Section 145 of the NI Act is read as the evidence in chief. The accused shall file any application under Section 145(2) to recall the complainant for cross-examination on or before the next date.</p>",
      "<p>Posted for <b>evidence of the complainant</b>.</p>",
    ].join(""),
  },
  {
    id: "sample-rich-interim-compensation",
    name: "Interim compensation under Section 143A",
    html: [
      "<p>Heard counsel for the complainant on the application for interim compensation under <b>Section 143A of the NI Act</b>, and counsel for the accused in opposition.</p>",
      "<p>The accused has pleaded not guilty. The cheque amount is ₹[Cheque Amount]. Having regard to the documents produced, the stage of the case and the conduct of the accused so far, I find this a fit case to direct interim compensation. Accordingly:</p>",
      "<ul>",
      "<li>The accused shall pay interim compensation of <b>₹[Amount]</b> to the complainant, being [Percentage]% of the cheque amount (not exceeding twenty per cent).</li>",
      "<li>The amount shall be paid <b>within sixty days</b> of this order, by deposit in this court.</li>",
      "<li>If unpaid, it may be recovered as if it were a fine.</li>",
      "<li>If the accused is acquitted, the complainant shall repay the amount with interest at the rate the Reserve Bank of India prescribes.</li>",
      "</ul>",
      "<p>The application is <b>allowed</b> in the above terms.</p>",
    ].join(""),
  },
  {
    id: "sample-rich-summons-unserved",
    name: "Summons unserved — fresh steps",
    html: [
      "<p>Summons to the accused returned <b>unserved</b> with the endorsement \"[Endorsement]\".</p>",
      "<p>The complainant is directed to:</p>",
      "<ul>",
      "<li>verify and furnish the correct present address of the accused;</li>",
      "<li>pay process fee for fresh summons by registered post and through the Station House Officer, [Police Station]; and</li>",
      "<li>also serve the summons by e-mail and messaging service, if a valid address or number is available.</li>",
      "</ul>",
      "<p>Issue fresh summons on steps. <i>If the complainant fails to take steps by the next date, the complaint is liable to be dismissed for default.</i></p>",
    ].join(""),
  },
  {
    id: "sample-rich-bail-appearance",
    name: "Bail on appearance — conditions",
    html: [
      "<p>The accused appeared in response to summons and moved for bail. The offence is bailable.</p>",
      "<p>The accused is released on bail on executing a bond for <b>₹[Bond Amount]</b> with two solvent sureties for the like sum each, on the following conditions:</p>",
      "<ol>",
      "<li>The accused shall appear before this court on every date of hearing unless exempted.</li>",
      "<li>The accused shall not change residence without informing the court.</li>",
      "<li>The accused shall file an undertaking with a current address, mobile number and e-mail for service.</li>",
      "</ol>",
      "<p>Bond and sureties accepted. Posted for <b>plea</b>.</p>",
    ].join(""),
  },
  {
    id: "sample-rich-compounding",
    name: "Compounding under Section 147",
    html: [
      "<p>Complainant and accused present in person with counsel. A joint petition to compound the offence under <b>Section 147 of the NI Act</b> is filed.</p>",
      "<p>The parties state that the dispute is settled on these terms:</p>",
      "<ul>",
      "<li>The accused has paid <b>₹[Settlement Amount]</b> to the complainant by [Mode of Payment] on [Payment Date].</li>",
      "<li>The complainant acknowledges full satisfaction of the claim under the cheque.</li>",
      "<li>Neither party has any further claim against the other in respect of this cheque.</li>",
      "</ul>",
      "<p>I have questioned both parties and am satisfied that the settlement is voluntary. <b>Compounding permitted.</b> The accused is <b>acquitted</b> of the offence under Section 138 of the NI Act. The bail bond stands cancelled and the sureties are discharged.</p>",
    ].join(""),
  },
  {
    id: "sample-rich-adjournment-costs",
    name: "Adjournment — last chance with costs",
    html: [
      "<p>Complainant's witness absent. Counsel for the complainant seeks time, stating [Reason].</p>",
      "<p>The case has been adjourned on [Number] earlier occasions at the instance of the complainant. Summary trials under the NI Act are to be concluded expeditiously. Time granted as a <b>last chance</b>, on payment of costs of <b>₹[Costs]</b> to the accused.</p>",
      "<p><i>No further adjournment will be granted for this purpose.</i></p>",
    ].join(""),
  },
];

/** The plain words of a sample, for the list and the search. */
function plainText(html: string): string {
  return html
    .replace(/<\/(p|li|ol|ul)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export const FORMATTED_SAMPLE_SHORTCUTS: readonly OrderShortcut[] =
  SAMPLES.map((sample) => ({
    id: sample.id,
    name: sample.name,
    html: sample.html,
    text: plainText(sample.html),
  }));
