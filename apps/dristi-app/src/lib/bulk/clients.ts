/**
 * Institutional clients the signed-in advocate files for, as the Excel upload offers them.
 * A stand-in for the advocate's client records — the complainant block is the same one an
 * API push sends once per batch. The name and registered office are Tata Capital's public
 * ones; the CIN, officers and contacts are placeholders for the demo. The authorised
 * representative who signs for the company comes with it; the filer picks the company.
 */

import type { ApiComplainant } from "./contract";

export type Client = { id: string; complainant: ApiComplainant };

export const CLIENTS: Client[] = [
  {
    id: "tata-capital",
    complainant: {
      type: "institution",
      institutionType: "public-limited",
      name: "Tata Capital Ltd",
      cinPan: "U65990MH1991PLC000000",
      phone: "2266069000",
      email: "legal@tatacapital.example",
      address: { line1: "11th Floor, Tower A, Peninsula Business Park, Lower Parel", city: "Mumbai", pin: "400013" },
      representative: {
        name: "Rajesh K. Patel",
        designation: "Chief Manager, Legal",
        age: "48",
        mobile: "9825011420",
        email: "rajesh.patel@tatacapital.example",
        address: { line1: "Regional Office, C G Road", city: "Ahmedabad", pin: "380009" },
      },
    },
  },
];

/** Advocates on the Bar Council of Gujarat register, as the upload's advocate choice. */
export const BAR_ADVOCATES = [
  { barNumber: "G/1187/2011", name: "Hemant R. Desai" },
  { barNumber: "G/2290/2014", name: "Nirali S. Shah" },
  { barNumber: "G/0754/2006", name: "Kaushik P. Trivedi" },
  { barNumber: "G/3312/2018", name: "Aarav M. Joshi" },
];
