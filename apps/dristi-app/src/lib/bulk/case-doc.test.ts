import assert from "node:assert/strict";
import { test } from "node:test";

import { extractCase } from "./case-doc";

const DOC = `Case brief: cheque dishonour
Loan account number: TCL-AHD-BL-1003

Accused 1
Type: Individual
Name: Pravin D. Solanki
Mobile: +91 98790 12303
Address: 7, Shreeji Society, Maninagar
City: Ahmedabad
Pincode: 380008

Accused 2
Name: Kusum P. Solanki
Mobile: 9879012313

Cheque details
Cheque number: 118034
Date: 21-08-2026
Amount: Rs. 3,65,000/-
Drawer bank IFSC: BARB0MANINA
Drawer account number: 21950100004471
Presentation date: 10-09-2026
Return date: 13-09-2026
Return reason: Exceeds arrangement

Demand notice
Nature of debt: Loan / advance repayment
Dispatch date: 21-09-2026
Mode of service: Speed post
Delivered: Yes
Delivery date: 29-09-2026
Accused replied: No
Payment after notice: No

Jurisdiction
Deposited in complainant's own account: Yes
Complainant branch IFSC: HDFC0000060`;

test("a case document is read section by section, by label", () => {
  const x = extractCase("brief.docx", DOC);
  const v = (k: string) => x.fields[k]?.value;
  assert.equal(v("Case reference"), "TCL-AHD-BL-1003");
  assert.equal(v("Accused name"), "Pravin D. Solanki");
  assert.equal(v("Accused name_2"), "Kusum P. Solanki");
  assert.equal(v("Accused city"), "Ahmedabad");
  assert.equal(v("Accused mobile"), "+919879012303");
  assert.equal(v("Cheque amount"), "365000");
  assert.equal(v("Cheque date"), "21-08-2026");
  assert.equal(v("Return reason"), "Exceeds arrangement");
  assert.equal(v("Notice mode of service"), "Speed post");
  assert.equal(v("Notice delivered"), "Yes");
  assert.equal(x.fields["Accused name"].confidence, "found");
  assert.equal(x.fields["Accused name"].line, 5);
});

test("what no label names is found by pattern and marked to check", () => {
  const x = extractCase("note.pdf", "Matter regarding loan TCL-AHD-PL-1004. Cheque no. 560921 for Rs. 76,400 drawn on KKBK0002561.");
  assert.equal(x.fields["Cheque number"].value, "560921");
  assert.equal(x.fields["Cheque number"].confidence, "check");
  assert.equal(x.fields["Drawer bank IFSC"].value, "KKBK0002561");
  assert.equal(x.fields["Case reference"].value, "TCL-AHD-PL-1004");
});

test("an unreadable document gives nothing", () => {
  assert.deepEqual(extractCase("scan.pdf", null).fields, {});
});

test("cheque details given in prose are read by pattern, to check", () => {
  const x = extractCase(
    "prose.docx",
    "The accused issued cheque no. 300982 dated 21-08-2026 for Rs. 52,800/-, drawn on account 4586000100028812 with PUNB0458600. It was presented on 12-09-2026 and returned unpaid on 15-09-2026.",
  );
  assert.equal(x.fields["Cheque date"].value, "21-08-2026");
  assert.equal(x.fields["Drawer account number"].value, "4586000100028812");
  assert.equal(x.fields["Presentation date"].value, "12-09-2026");
  assert.equal(x.fields["Return date"].value, "15-09-2026");
  assert.equal(x.fields["Return date"].confidence, "check");
});
