/**
 * The words the complainant's representative says for a batch (owner, 2026-11-17): one
 * general affirmation for every case in it, not about any one case, recorded once. Worded
 * after individual filing's (`OATH_TEXT`, e-filing handover §18.2), whose exact court
 * wording is still to be confirmed there too.
 */
export function batchOathText(complainant: string, batchNumber: string, cases: number): string {
  return (
    `I solemnly affirm that the contents of the ${cases} ${cases === 1 ? "complaint" : "complaints"} filed by ` +
    `${complainant || "the complainant"} in batch ${batchNumber}, and everything stated in support of them, are true ` +
    "to the best of my knowledge and belief, and that nothing material has been concealed."
  );
}

/** Where the representative records it: the link they are sent. */
export const oathLinkPath = (batchId: string) => `/oath/${encodeURIComponent(batchId)}`;
