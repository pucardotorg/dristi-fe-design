/**
 * The summons, v15: one A4 sheet, both sides, in two versions (owner, 2026-10-12).
 *
 * - **Print** is what the post and the process server carry. Paper cannot be clicked,
 *   so every address is printed in full and nothing is a link.
 * - **Digital** is what the accused opens from SMS, email or the onboarding modal. The
 *   same sheet, with the addresses, phone numbers and QR as links, and "turn over" read
 *   as "scroll down".
 *
 * Every string is written in Kerala's terms (`lib/summons/content.ts`) and voiced here
 * for `court`, which the page takes from the summons URL. The root is `data-court-raw`,
 * so the app's text layer does not voice it a second time for the court in Settings.
 *
 * Styles: `app/summons/summons.css`. The sheet is paper, not app UI: black on white in
 * both themes, sized in pt and mm, on v14's type and spacing scales.
 */

import * as React from "react";

import { localizeCourtText } from "@/lib/court/localize";
import type { CourtId } from "@/lib/court/profiles";
import { SUMMONS_COURT, SUMMONS_FACTS } from "@/lib/summons/content";

export type SummonsVersion = "print" | "digital";

type Props = { court: CourtId; version: SummonsVersion };

export function SummonsDocument({ court, version }: Props) {
  const t = (text: string) => localizeCourtText(text, court);
  const f = SUMMONS_FACTS;
  const local = SUMMONS_COURT[court];
  const digital = version === "digital";

  /** An address on the portal: a link on screen, the address itself on paper. */
  const portal = (path = "") => {
    const address = `${local.portal}${path}`;
    if (!digital || !local.portalIsReal) return <b>{address}</b>;
    return (
      <a href={`https://${address}`} target="_blank" rel="noreferrer">
        <b>{address}</b>
      </a>
    );
  };

  const phone = ({ display, tel }: { display: string; tel: string | null }) =>
    digital && tel ? <a href={`tel:${tel}`}>{display}</a> : display;

  const site = (address: string) =>
    digital && !address.startsWith("[") ? (
      <a href={`https://${address}`} target="_blank" rel="noreferrer">
        {address}
      </a>
    ) : (
      address
    );

  const caseNumber = t(f.caseNumber);

  return (
    <div className="summons" data-court-raw="" data-version={version}>
      {/* ============================ FRONT :: PAGE 1 ============================ */}
      <section className="sheet" aria-label="Summons, page 1">
        <table>
          <tbody>
            <tr>
              <td style={{ width: "20mm" }}>
                <div className="emblem" aria-hidden>
                  EMBLEM
                </div>
              </td>
              <td style={{ verticalAlign: "middle" }}>
                <div className="t5">In the {t(f.court)}</div>
              </td>
              <td style={{ width: "60mm" }}>
                <div className="t4 caps title">
                  Summons to an
                  <br />
                  Accused Person
                </div>
                <div className="t2 right pt2">
                  Form No. 1
                  <br />
                  See Section 63, Bharatiya Nagarik Suraksha Sanhita, 2023
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-heavy" />

        <table>
          <tbody>
            <tr>
              <td style={{ width: "112mm", verticalAlign: "middle" }}>
                <div className="label">Case Number</div>
                <div className="strong pt2">{caseNumber}</div>
                <div className="s4" />
                <div className="label">In the Matter of</div>
                <div className="strong pt2" style={{ lineHeight: 1.3 }}>
                  {t(f.complainant)}
                  <br />
                  versus {t(f.accused)}
                </div>
              </td>
              <td style={{ paddingBottom: "2mm" }}>
                <div className="hearingbox">
                  <div className="label">You must appear on</div>
                  <div className="t5 pt2">{f.hearingDate}</div>
                  <div className="t2 pt2">
                    {f.hearingDay} &nbsp;·&nbsp; {t(f.bench)}
                  </div>
                  <div className="t2 pt2">{t(f.courtAddress)}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-thin" />

        <table>
          <tbody>
            <tr>
              <td>
                <div className="label">To</div>
                <p className="last pt2">
                  <b>{t(f.accused)}</b>
                  {f.accusedAddress.map((line) => (
                    <React.Fragment key={line}>
                      <br />
                      {t(line)}
                    </React.Fragment>
                  ))}
                </p>
              </td>
              <td style={{ width: "62mm" }} className="right">
                <div className="t2">Dated, this {f.dated}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s2" />

        <p className="last">
          <b>{t(f.complainant)}</b> has filed a complaint against you under{" "}
          <b>Section 138 of the Negotiable Instruments Act, 1881</b> (dishonour of a
          cheque, commonly called <i>cheque bounce</i>), in respect of{" "}
          <b>
            Cheque No. {f.chequeNumber} for {f.amount}
          </b>
          . You are required to appear before this Court, in person or by pleader, on{" "}
          <b>{f.hearingDate}</b>.
        </p>

        <div className="s2" />

        {/* Signed digitally, so no seal (owner's review): the signature stands alone. */}
        <table>
          <tbody>
            <tr>
              <td />
              <td style={{ width: "62mm" }}>
                <div style={{ height: "12mm" }} />
                <div className="sigline">Digitally signed by the Magistrate</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s2" />

        <p className="t2 last">
          This process is system generated and transmitted in a secured manner by an
          authorised user; as such, a physical copy is not required.{" "}
          <b>
            The court will never ask you to make payment through a link sent in a
            message, or into any personal account.
          </b>
        </p>

        <div className="rule-mid" style={{ marginBottom: "2mm" }} />

        <table>
          <tbody>
            <tr>
              <td style={{ paddingRight: "8mm" }}>
                <div className="t4">Join your case online</div>
                <div className="s4" />
                <p>
                  Joining your case lets you see the complaint filed against you, file
                  applications, and receive the court&apos;s orders.
                </p>
                <p className="last">
                  Go to {portal()} and register. Search using Case No.{" "}
                  <b>{caseNumber}</b>, then enter your access code. Your papers are under
                  the <b>Complaint</b>, <b>Documents</b> and <b>Submissions</b> tabs.
                  Share the code only with your lawyer.
                </p>
              </td>
              <td className="joincol">
                <div className="vern" lang={local.language.lang} style={{ fontFamily: local.language.font }}>
                  {local.language.line}
                </div>
                <div className="s4" />
                {digital && local.portalIsReal ? (
                  <a href={`https://${local.portal}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- print facsimile */}
                    <img className="qr" src="/summons/qr_portal.png" alt="QR code: join your case" style={{ width: "30mm", height: "30mm" }} />
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- print facsimile
                  <img className="qr" src="/summons/qr_portal.png" alt="QR code: join your case" style={{ width: "30mm", height: "30mm" }} />
                )}
                <div className="s2" />
                <div className="qrcap">
                  <b>{digital ? "Scan or tap to join your case." : "Scan to join your case."}</b>
                  <br />
                  Help is available in your language.
                </div>
                <div className="s2" />
                <div className="codebox">
                  <table>
                    <tbody>
                      <tr>
                        <td style={{ verticalAlign: "middle" }}>
                          <div className="label">
                            Your
                            <br />
                            access code
                          </div>
                        </td>
                        <td style={{ verticalAlign: "middle" }} className="right">
                          <div className="code">{f.accessCode}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s4" />
        <div className="turnband">
          <table>
            <tbody>
              <tr>
                <td style={{ width: "56mm" }}>
                  <div className="caps turncap">
                    {digital ? "Please read on" : "Please turn over"}
                  </div>
                </td>
                <td className="right">
                  <div className="strong">
                    {digital
                      ? "Options for closing this case are on page 2 ↓"
                      : "Options for closing this case are on the reverse ➔"}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="folio">Page 1 of 2</div>
      </section>

      {/* ============================ BACK :: PAGE 2 ============================ */}
      <section className="sheet back" aria-label="Summons, page 2">
        <div className="label">
          {/* The number keeps its own case: Gujarat's is eCC, not ECC. */}
          Case No. <span style={{ textTransform: "none" }}>{caseNumber}</span>
        </div>
        <div className="rule-heavy" style={{ marginTop: "2mm" }} />

        <div className="t5 upper">What you can do now</div>
        <div className="s4" />
        <p>
          <b>Before {f.hearingDate}, choose one of the three options below.</b> Options 1
          and 2 end this case without a trial.
        </p>

        <div className="bar">
          <p className="last keep12">
            <b>If today is already on or after {f.hearingDate},</b> do not ignore this.
            Check {portal()} for your new date, or call {phone(local.helpline)} first.
          </p>
        </div>

        <div className="rule-mid" />

        <table>
          <tbody>
            <tr>
              <td className="rail">
                <div className="railnum">1</div>
              </td>
              <td style={{ paddingRight: "4mm" }}>
                <div className="label">This ends the case</div>
                <div className="t4 pt2">Pay the cheque amount</div>
                <div className="s2" />
                <p className="last">
                  Pay <b>{f.amount}</b> and the case against you is closed. Pay the court
                  directly using the code alongside, or pay the complainant (account
                  details are in your case file), then upload the receipt on the portal
                  under <b>Upload Document</b>.
                </p>
              </td>
              <td style={{ width: "30mm", verticalAlign: "middle" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- print facsimile */}
                <img className="qr" src="/summons/qr_pay.png" alt="QR code: pay the court" style={{ width: "26mm", height: "26mm" }} />
                <div className="s2" />
                <div className="qrcap">
                  <b>Pay the court</b>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-thin" />

        <table>
          <tbody>
            <tr>
              <td className="rail">
                <div className="railnum">2</div>
              </td>
              <td>
                <div className="label">This ends the case</div>
                <div className="t4 pt2">Settle with the complainant</div>
                <div className="s2" />
                <p>
                  You can agree a payment plan, or a smaller amount, if the complainant
                  accepts. Call{" "}
                  <b>
                    {t(f.complainantAdvocate)}, for {t(f.complainant)}
                  </b>{" "}
                  on <b>{phone(local.complainantAdvocate)}</b>.
                </p>
                <p className="last">
                  You can also ask the court to send your case to a <b>Lok Adalat</b> or to{" "}
                  <b>mediation</b>. Both are free and overseen by the court. Read what these
                  are at {portal("/lokadalat")}. Apply on the portal, where you can also ask
                  for more time.
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-thin" />

        <table>
          <tbody>
            <tr>
              <td className="rail">
                <div className="railnum">3</div>
              </td>
              <td>
                <div className="label">If you dispute the claim</div>
                <div className="t4 pt2">Contest the case</div>
                <div className="s2" />
                <p>
                  Defend the case with a lawyer, or represent yourself, which is called{" "}
                  <i>appearing as a party in person</i>.
                </p>
                <p className="last">
                  <b>Free legal aid</b> &nbsp; {t(f.legalAid)} &nbsp;·&nbsp;{" "}
                  {phone(local.legalAid)}
                  <br />
                  <b>Find a lawyer</b> &nbsp; {t(f.barCouncil)} &nbsp;·&nbsp;{" "}
                  {site(local.barCouncilSite)}
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-mid" />

        <p>
          At the hearing you can respond to the complaint and question the complainant.
          Appear <b>in person</b> at the court, at the address on page 1, or{" "}
          <b>online by video</b>. To join by video, sign in at {portal()} and open your
          case. The video link is there.
        </p>
        <p>
          <b>Cannot attend that day?</b> Apply on the portal for a new date <b>before</b>{" "}
          {f.hearingDate}, and give your reasons.
        </p>
        <p className="last">
          <b>If you do not appear and do not apply,</b> the court can issue a warrant for
          your arrest.
        </p>

        <div className="rule-mid" />

        <div className="keep12 strong">Need help?</div>
        <div className="s2" />
        <table className="t2">
          <tbody>
            <tr>
              <td style={{ width: "56mm", paddingBottom: "2mm" }}>
                <b>Your rights and obligations</b>
              </td>
              <td style={{ paddingBottom: "2mm" }}>{portal("/s138")}</td>
            </tr>
            <tr>
              <td style={{ paddingBottom: "2mm" }}>
                <b>Guidance in other languages</b>
              </td>
              <td style={{ paddingBottom: "2mm" }}>{portal("/help")}</td>
            </tr>
            <tr>
              <td>
                <b>Help in person</b>
              </td>
              <td>
                {t(f.helpInPerson)} &nbsp;·&nbsp; helpline {phone(local.helpline)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s4" />
        <p className="t1 last">
          <b>Privacy notice.</b> The court is notified when you open this summons or use
          the links above. This is accessible only to the Judiciary, and confirms only that
          you received and viewed it. Privacy policy: {portal("/privacy")}
        </p>

        <div className="folio">Page 2 of 2</div>
      </section>
    </div>
  );
}
