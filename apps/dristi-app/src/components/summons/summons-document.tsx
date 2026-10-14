/**
 * The summons, v16: one A4 sheet, both sides.
 *
 * **One version for paper and screen** (owner, 2026-10-12). Paper cannot be clicked, so
 * every address is printed in full; on screen the same address is also a link, which
 * costs the paper nothing. "Please turn over" reads the same in both.
 *
 * **Set as a court document, not a web page** (owner, 2026-10-14): a serif body, bold
 * kept for the few things the reader must not miss, no capitalised labels and no
 * italics, paragraphs told apart by indentation, ruled lines in a clerk's variety
 * (double, dotted, dashed), generous leading and margins so it reads calm, and hierarchy
 * carried by grey steps no lighter than a cheap printer holds on off-white paper. The words are v15's, bar the turn-over line and the bail
 * paragraph under Contest the case.
 *
 * Every string is written in Kerala's terms (`lib/summons/content.ts`) and voiced here
 * for `court`, which the page takes from the summons URL. The root is `data-court-raw`,
 * so the app's text layer does not voice it a second time for the court in Settings.
 *
 * Styles: `app/summons/summons.css`. The sheet is paper, not app UI: black on white in
 * both themes, sized in pt and mm.
 */

import * as React from "react";
import { ArrowRightIcon } from "lucide-react";

import { localizeCourtText } from "@/lib/court/localize";
import type { CourtId } from "@/lib/court/profiles";
import { SUMMONS_COURT, SUMMONS_FACTS } from "@/lib/summons/content";

type Props = { court: CourtId };

export function SummonsDocument({ court }: Props) {
  const t = (text: string) => localizeCourtText(text, court);
  const f = SUMMONS_FACTS;
  const local = SUMMONS_COURT[court];

  /** An address on the portal, written in full. A placeholder is not a link. */
  const portal = (path = "") => {
    const address = `${local.portal}${path}`;
    if (!local.portalIsReal) return <span className="addr">{address}</span>;
    return (
      <a className="addr" href={`https://${address}`} target="_blank" rel="noreferrer">
        {address}
      </a>
    );
  };

  const phone = ({ display, tel }: { display: string; tel: string | null }) =>
    tel ? <a href={`tel:${tel}`}>{display}</a> : display;

  const site = (address: string) =>
    !address.startsWith("[") ? (
      <a href={`https://${address}`} target="_blank" rel="noreferrer">
        {address}
      </a>
    ) : (
      address
    );

  const caseNumber = t(f.caseNumber);

  return (
    <div className="summons" data-court-raw="">
      {/* ============================ FRONT :: PAGE 1 ============================ */}
      <section className="sheet" aria-label="Summons, page 1">
        {/* Centred masthead (owner, 2026-10-12), the way court forms set it: the court,
            then the document, then its form reference, all on the page's centre line. */}
        <div className="masthead">
          <div className="courtname">
            <div className="emblem" aria-hidden>
              EMBLEM
            </div>
            <div className="t5">In the {t(f.court)}</div>
          </div>
          <div className="title">Summons to an Accused Person</div>
          <div className="t2 muted">
            Form No. 1 &nbsp;·&nbsp; See Section 63, Bharatiya Nagarik Suraksha Sanhita, 2023
          </div>
        </div>

        <div className="rule-heavy" />

        <table>
          <tbody>
            <tr>
              <td style={{ width: "98mm", verticalAlign: "middle" }}>
                <div className="label">Case number</div>
                <div className="pt1 big">{caseNumber}</div>
                <div className="s4" />
                <div className="label">In the matter of</div>
                <div className="pt1 big" style={{ lineHeight: 1.3 }}>
                  {t(f.complainant)}
                  <br />
                  versus {t(f.accused)}
                </div>
              </td>
              <td style={{ paddingBottom: "2mm" }}>
                <div className="hearingbox">
                  <div className="label">You must appear on</div>
                  <div className="t5 pt1">{f.hearingDate}</div>
                  <div className="t2 pt1">
                    {f.hearingDay} &nbsp;·&nbsp; {t(f.bench)}
                  </div>
                  <div className="t2 pt1 muted">{t(f.courtAddress)}</div>
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
                <p className="last pt1">
                  {t(f.accused)}
                  {f.accusedAddress.map((line) => (
                    <React.Fragment key={line}>
                      <br />
                      {t(line)}
                    </React.Fragment>
                  ))}
                </p>
              </td>
              <td style={{ width: "62mm" }} className="right">
                <div className="t2 muted">Dated, this {f.dated}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s2" />

        <p className="last">
          {t(f.complainant)} has filed a complaint against you under Section 138 of the
          Negotiable Instruments Act, 1881 (dishonour of a cheque, commonly called
          “cheque bounce”), in respect of Cheque No. {f.chequeNumber} for {f.amount}.
          You are required to appear before this Court, in person or by pleader, on{" "}
          <b>{f.hearingDate}</b>.
        </p>

        <div className="s2" />

        {/* Signed digitally, so no seal (owner's review): the signature stands alone. */}
        <table>
          <tbody>
            <tr>
              <td />
              <td style={{ width: "62mm" }}>
                <div style={{ height: "7mm" }} />
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

        <div className="rule-mid" style={{ marginBottom: "3mm" }} />

        <table>
          <tbody>
            <tr>
              <td className="ragged" style={{ paddingRight: "8mm" }}>
                <div className="t4">Join your case online</div>
                <div className="s2" />
                <p>
                  Joining your case lets you see the complaint filed against you, file
                  applications, and receive the court&apos;s orders.
                </p>
                <p className="last">
                  Go to {portal()} and register. Search using Case No. {caseNumber}, then
                  enter your access code. Your papers are under the Complaint,
                  Documents and Submissions tabs. Share the code only with your
                  lawyer.
                </p>
              </td>
              <td className="joincol">
                <div className="vern" lang={local.language.lang} style={{ fontFamily: local.language.font }}>
                  {local.language.line}
                </div>
                <div className="s4" />
                {local.portalIsReal ? (
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
                  Scan to join your case.
                  <br />
                  <span className="muted">Help is available in your language.</span>
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

        <div className="s2" />
        <div className="turnband">
          <table>
            <tbody>
              <tr>
                <td style={{ width: "56mm" }}>
                  <div className="turncap">Please turn over</div>
                </td>
                <td className="right">
                  <div>
                    The steps open to you are set out overleaf
                    <ArrowRightIcon className="turnarrow" aria-hidden />
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
        <div className="label">Case No. {caseNumber}</div>
        <div className="rule-heavy" style={{ marginTop: "2mm" }} />

        <div className="t5">What you can do now</div>
        <div className="s2" />
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
                <div className="t4 pt1">Pay the cheque amount</div>
                <div className="s1" />
                <p className="last">
                  Pay <b>{f.amount}</b> and the case against you is closed. Pay the court
                  directly using the code alongside, or pay the complainant (account
                  details are in your case file), then upload the receipt on the portal
                  under “Upload Document”.
                </p>
              </td>
              <td style={{ width: "30mm", verticalAlign: "middle" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- print facsimile */}
                <img className="qr" src="/summons/qr_pay.png" alt="QR code: pay the court" style={{ width: "26mm", height: "26mm" }} />
                <div className="s2" />
                <div className="qrcap">Pay the court</div>
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
                <div className="t4 pt1">Settle with the complainant</div>
                <div className="s1" />
                <p>
                  You can agree a payment plan, or a smaller amount, if the complainant
                  accepts. Call {t(f.complainantAdvocate)}, for {t(f.complainant)}, on{" "}
                  {phone(local.complainantAdvocate)}.
                </p>
                <p className="last">
                  You can also ask the court to send your case to a Lok Adalat or to
                  mediation. Both are free and overseen by the court. Read what these are at{" "}
                  {portal("/lokadalat")}. Apply on the portal, where you can also ask for more
                  time.
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
                <div className="t4 pt1">Contest the case</div>
                <div className="s1" />
                <p>
                  Defend the case with a lawyer, or represent yourself, which is called
                  “appearing as a party in person”.
                </p>
                {/* Bail sits with contesting, the choice that needs it (owner, 2026-10-14). */}
                <p>
                  If you contest the case, your next step is to apply for bail. File the bail
                  application with <b>two sureties for {f.suretyAmount}</b>, and bring the
                  sureties&apos; documents and the bail bond to the court. Once you have
                  joined your case, you can file the bail application on {portal()}.
                </p>
                <p className="last aid">
                  <span className="aidlabel">Free legal aid</span>
                  {t(f.legalAid)} &nbsp;·&nbsp; {phone(local.legalAid)}
                  <br />
                  <span className="aidlabel">Find a lawyer</span>
                  {t(f.barCouncil)} &nbsp;·&nbsp;{" "}
                  {site(local.barCouncilSite)}
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rule-mid" />

        <p>
          At the hearing you can respond to the complaint and question the complainant.
          Appear in person at the court, at the address on page 1, or online by video. To
          join by video, sign in at {portal()} and open your case. The video link is there.
        </p>
        <p>
          Cannot attend that day? Apply on the portal for a new date before{" "}
          {f.hearingDate}, and give your reasons.
        </p>
        <p className="last">
          <b>If you do not appear and do not apply,</b> the court can issue a warrant for
          your arrest.
        </p>

        <div className="rule-mid" />

        <div className="keep12 strong">Need help?</div>
        <div className="s1" />
        <table className="t2 helptable">
          <tbody>
            <tr>
              <td style={{ width: "56mm" }}>Your rights and obligations</td>
              <td>{portal("/s138")}</td>
            </tr>
            <tr>
              <td>Guidance in other languages</td>
              <td>{portal("/help")}</td>
            </tr>
            <tr>
              <td>Help in person</td>
              <td>
                {t(f.helpInPerson)} &nbsp;·&nbsp; helpline {phone(local.helpline)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="s2" />
        <p className="t1 last muted">
          Privacy notice. The court is notified when you open this summons or use the
          links above. This is accessible only to the Judiciary, and confirms only that you
          received and viewed it. Privacy policy: {portal("/privacy")}
        </p>

        <div className="folio">Page 2 of 2</div>
      </section>
    </div>
  );
}
