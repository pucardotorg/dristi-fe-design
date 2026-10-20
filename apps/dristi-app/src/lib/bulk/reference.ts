/**
 * Reference lookups bulk intake runs on the server, the ones the PRD says a bulk
 * submission must run too (§3.6): IFSC → bank and branch, pincode → district and state,
 * bar registration → advocate name.
 *
 * Each answers from a small local register first, so the demo works offline and the demo's
 * collection branches resolve, then falls back to the same public
 * endpoints the single filing uses (`lib/filing/lookups.ts`, which is browser-only). The
 * Bar Council has no public registry, so the bar register is local only. Engineering swaps
 * all three for the court's services behind these signatures.
 */

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export type IfscRecord = { bank: string; branch: string };
export type PinRecord = { district: string; state: string };

const IFSC_REGISTER: Record<string, IfscRecord> = {
  // The branches of the complainant's banker where its collection account is held.
  HDFC0000060: { bank: "HDFC Bank", branch: "Navrangpura, Ahmedabad" },
  HDFC0000146: { bank: "HDFC Bank", branch: "Maninagar, Ahmedabad" },
  HDFC0000291: { bank: "HDFC Bank", branch: "Satellite, Ahmedabad" },
  // Drawee banks the borrowers bank with.
  SBIN0060421: { bank: "State Bank of India", branch: "Navrangpura, Ahmedabad" },
  HDFC0000521: { bank: "HDFC Bank", branch: "Satellite Road, Ahmedabad" },
  BARB0MANINA: { bank: "Bank of Baroda", branch: "Maninagar, Ahmedabad" },
  ICIC0000317: { bank: "ICICI Bank", branch: "Vastrapur, Ahmedabad" },
  PUNB0458600: { bank: "Punjab National Bank", branch: "Naroda, Ahmedabad" },
  UTIB0000080: { bank: "Axis Bank", branch: "Ellisbridge, Ahmedabad" },
  KKBK0002561: { bank: "Kotak Mahindra Bank", branch: "Bopal, Ahmedabad" },
  CNRB0002627: { bank: "Canara Bank", branch: "Paldi, Ahmedabad" },
  BKID0002005: { bank: "Bank of India", branch: "Alkapuri, Vadodara" },
};

const PIN_REGISTER: Record<string, PinRecord> = {
  "380001": { district: "Ahmedabad", state: "Gujarat" },
  "400013": { district: "Mumbai", state: "Maharashtra" },
  "380006": { district: "Ahmedabad", state: "Gujarat" },
  "380007": { district: "Ahmedabad", state: "Gujarat" },
  "380008": { district: "Ahmedabad", state: "Gujarat" },
  "380009": { district: "Ahmedabad", state: "Gujarat" },
  "380013": { district: "Ahmedabad", state: "Gujarat" },
  "380015": { district: "Ahmedabad", state: "Gujarat" },
  "380052": { district: "Ahmedabad", state: "Gujarat" },
  "380054": { district: "Ahmedabad", state: "Gujarat" },
  "380058": { district: "Ahmedabad", state: "Gujarat" },
  "380061": { district: "Ahmedabad", state: "Gujarat" },
  "382330": { district: "Ahmedabad", state: "Gujarat" },
  "382350": { district: "Ahmedabad", state: "Gujarat" },
  "382415": { district: "Ahmedabad", state: "Gujarat" },
  "382421": { district: "Gandhinagar", state: "Gujarat" },
  "390007": { district: "Vadodara", state: "Gujarat" },
  "395007": { district: "Surat", state: "Gujarat" },
};

/** Enrolment number → name, as the Bar Council of Gujarat would answer. */
const BAR_REGISTER: Record<string, string> = {
  "G/1187/2011": "Hemant R. Desai",
  "G/2290/2014": "Nirali S. Shah",
  "G/0754/2006": "Kaushik P. Trivedi",
  "G/3312/2018": "Aarav M. Joshi",
};

/** The district the bulk demo files in — an address outside it is a soft flag. */
export const COURT_DISTRICT = "Ahmedabad";

const ifscCache = new Map<string, Promise<IfscRecord | null>>();
const pinCache = new Map<string, Promise<PinRecord | null>>();

/** Bank and branch for an IFSC; `null` when the code is malformed or unknown. */
export function resolveIfsc(code: string): Promise<IfscRecord | null> {
  const ifsc = code.trim().toUpperCase();
  if (!IFSC_PATTERN.test(ifsc)) return Promise.resolve(null);
  const local = IFSC_REGISTER[ifsc];
  if (local) return Promise.resolve(local);
  let p = ifscCache.get(ifsc);
  if (!p) {
    p = fetch(`https://ifsc.razorpay.com/${ifsc}`, { signal: AbortSignal.timeout(4000) })
      .then(async (res) => {
        if (!res.ok) return null;
        const j = (await res.json()) as Record<string, string>;
        return { bank: j.BANK ?? "", branch: j.BRANCH ?? "" };
      })
      .catch(() => null);
    ifscCache.set(ifsc, p);
  }
  return p;
}

/** District and state for a pincode; `null` when it is not 6 digits or not known. */
export function resolvePin(pin: string): Promise<PinRecord | null> {
  const p6 = pin.replace(/\D/g, "");
  if (p6.length !== 6) return Promise.resolve(null);
  const local = PIN_REGISTER[p6];
  if (local) return Promise.resolve(local);
  let p = pinCache.get(p6);
  if (!p) {
    p = fetch(`https://api.postalpincode.in/pincode/${p6}`, { signal: AbortSignal.timeout(4000) })
      .then(async (res) => {
        if (!res.ok) return null;
        const j = (await res.json()) as Array<{
          Status: string;
          PostOffice: Array<{ District: string; State: string }> | null;
        }>;
        const po = j?.[0]?.Status === "Success" ? j[0].PostOffice?.[0] : undefined;
        return po ? { district: po.District, state: po.State } : null;
      })
      .catch(() => null);
    pinCache.set(p6, p);
  }
  return p;
}

/** The advocate's name for an enrolment number; `null` when the register has no match. */
export function resolveBar(barNumber: string): string | null {
  return BAR_REGISTER[barNumber.trim().toUpperCase()] ?? null;
}
