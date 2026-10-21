# Bulk filing demo: how to run it and what to try

This demo shows how a lender's cheque-bounce cases move from its legal software into
SARAS 2.0 (Gujarat's e-filing system) for filing, either all at once through a connection
between the two systems or through an Excel file.

You run two websites on your own computer:

| Website | What it stands for | Address |
|---|---|---|
| **Provakil** | Tata Capital's legal case software | http://localhost:3100 |
| **SARAS 2.0** | Gujarat's court e-filing system | http://localhost:3000 |

Everything stays on your computer. No real cases, people, payments or signatures are
involved. Tata Capital's name and office address are real; every borrower, officer, phone
number and case is made up.

---

## Part 1: Set up (once)

You need about 15 minutes and an internet connection.

### 1. Install two free tools

1. **Git**: download from https://git-scm.com/downloads and install with the default
   options.
2. **Node.js, version 22 or newer**: download the "LTS" installer from https://nodejs.org
   and install with the default options.

### 2. Open a terminal

- **Mac**: press Cmd + Space, type `Terminal`, press Enter.
- **Windows**: press the Windows key, type `PowerShell`, press Enter.

Check the tools are there. Type each line and press Enter:

```bash
git --version
```

```bash
node --version
```

The second one must show `v22` or higher. If it shows a lower number, install Node.js
again from step 1.

### 3. Download the demo

Copy these lines into the terminal one at a time, pressing Enter after each:

```bash
cd ~/Desktop
```

```bash
git clone --branch bulk-filing https://github.com/pucardotorg/dristi-fe-design.git bulk-filing-demo
```

```bash
cd bulk-filing-demo
```

```bash
npm install
```

`npm install` takes a few minutes and prints a lot of text. Warnings are fine. It is done
when you get the prompt back.

---

## Part 2: Start the demo (every time)

In the terminal, inside the `bulk-filing-demo` folder:

```bash
npm run demo
```

Wait until you see the two addresses printed (about 30 seconds the first time). Then open
in your browser:

- Provakil: http://localhost:3100
- SARAS 2.0: http://localhost:3000/filings/bulk

Leave the terminal open while you test. To stop, click in the terminal and press
Ctrl + C.

**Start again from a clean slate** (removes every batch and filing you made):

```bash
npm run demo -- --reset
```

**Coming back another day:** open the terminal, then

```bash
cd ~/Desktop/bulk-filing-demo
```

```bash
npm run demo
```

---

## Part 3: What to try

### Walkthrough A: File cases from Provakil (the connection)

1. Open **Provakil**. You land on **Litigation**, Section 138 cases, the **Ready for
   Filing** tab. The workspace holds 220 cases, 50 to a page.
2. Tick cases the way you would in Gmail:
   - Click a checkbox to tick one case.
   - Hold **Shift** and click another checkbox: every case in between is ticked too. Shift +
     click on a ticked case unticks the range instead.
   - Hold **Ctrl** (Windows) or **Cmd** (Mac) and click a row to tick it without opening it.
     A plain click on a row opens the case.
   A bar appears at the bottom. Include a few **Unassigned** cases.
3. Click **File in court**. First choose the court: only **SARAS 2.0** (Gujarat) can be
   chosen; the other courts have no jurisdiction over these cases. Click **Next: advocates**.
4. Provakil fetches the advocates registered on SARAS 2.0 for Tata Capital. Each case shows
   its advocate where Provakil already had one. Give the others an advocate from the list,
   one at a time, or tick several and pick an advocate at the top, then **Assign**. The
   footer shows how many cases each advocate gets.
5. Click **File … cases on SARAS 2.0**. Each advocate's cases become their own batch, such as
   `BLK-2026-0004` for Thomas K. George and `BLK-2026-0005` for Rahul Thakkar. Click **Open on
   SARAS 2.0** on any of them.
6. Back in Provakil, the cases now sit under **Filed**, marked "On SARAS 2.0" with the batch
   number. Click a row to see its details, documents and activity.
7. **Settings** (bottom left) shows the connector and the full field-by-field mapping.

On SARAS 2.0, a push nobody has opened yet shows as **New** on the **Bulk filing** list. It
stays marked until someone opens the batch, so the next person to sign in sees it first.

Things greyed out in Provakil are not part of the demo.

### Walkthrough B: Work through a batch on SARAS 2.0

Open a batch (from Provakil's link, or from **Bulk filing** on SARAS 2.0). The tabs run in
order:

1. **Cases**: every case with its status. Click one to open it in the same screens as
   filing a single case (see Case details below).
2. **Documents**: one row per case, with each document it needs stacked underneath. Cases
   missing something are open at the top. Click an empty slot, or drag a file onto it; any
   PDF on your computer will do. **View** and **Replace** sit beside a filled slot.
3. **Case details**: every open case with what it still needs. Click a case and it opens
   in the screens used to file a single case, at the first section with something to fix,
   with every field of the case. A bar above the section says which case of the batch it
   is, lists what to fix there, and has **Previous**, **Next** and **Next case to fix**.
   The sections list on the left counts what is open in each section. Sign and Pay are not
   there: the batch signs and pays once. The complainant and advocates are the batch's, so
   they are shown but cannot be changed in one case. Changes save as you type.
   **All cases** goes back to the list.
   - **Needs fixing** (red): something required is missing or wrong. It shows under the
     field itself, and in the bar. The case waits; the rest go ahead.
   - **To check** (amber): worth a second look, for example a cheque returned for "payment
     stopped" rather than "insufficient funds". Press **Skip** in the bar to let the case
     go ahead.
   - **AI check** (sparkle mark): something a reader would catch that is not a rule, for
     example a cheque scan showing a different amount from the case, or an individual whose
     name reads like a shop. Skip it the same way. Some Provakil cases carry a cheque with a
     different amount on purpose, to show this.
4. **Review**: each case as the court will read it, its synopsis and complaint, one at a
   time with **Next case**. **Open the case** opens it to change something.
5. **Sign**: choose the cases and a method. Fastest first: Mobile OTP (one OTP signs them
   all), DSC, Aadhaar eSign (5 cases per OTP, so several OTPs; the note under it explains
   why and links to the rule), Upload signed copies. Any 6 digits work as the OTP or PIN.
6. **Pay**: one payment for all the chosen cases. Each case gets its own receipt and case
   number, and counts as filed at that moment.

Go back to Provakil and press **Refresh**: filed cases now show their case numbers.

**With AI off.** Add `?ai=off` to the batch address (for example
`http://localhost:3000/filings/bulk/<batch>?ai=off`). AI checks disappear and everything
else works by hand. `?ai=unavailable` shows the screens as they would be if the AI service
were down. Remove the parameter, or use `?ai=on`, to bring AI back.

### Walkthrough C: Upload an Excel file that follows the template

Two ready-made files are in the `demo-files` folder inside `bulk-filing-demo`:

| File | What it shows |
|---|---|
| `tata-capital-bulk-filing-template.xlsx` | 12 cases in the court's template, some with a second accused, cheque or witness. Goes straight in. |
| `tata-capital-recovery-mis.xlsx` | The same 12 cases in a lender's own report layout, with a second cheque. Needs matching. |

**Things that happen more than once.** Some cases have more than one accused, cheque,
demand notice, witness or complainant. In the sheet, the second one is the same columns
again with `_2` at the end (`Cheque number_2`), the third `_3`, and so on. This is per case:
only the cases that have a second cheque fill `Cheque number_2`; the rest leave it blank. An accused's
second address is `Accused address_1_2` (first accused, second address). The template's
**Instructions** sheet lists which columns can repeat.

1. On SARAS 2.0, **Bulk filing**, click **Download Excel template** and open it to see the
   format. Row 2 says what each column takes (text, date, a choice from a list, required or
   not). Row 3 is an example case. Both rows are skipped when you upload, so they can stay.
2. Click **Upload Excel**. Pick the complainant, and tick the advocates who appear for it:
   you are ticked already, and any advocate on your **People** page can be added. Choose
   `tata-capital-bulk-filing-template.xlsx`, click **Next**.
3. Because it follows the template, it goes straight to **Review**: 12 cases read, and the
   template's 2 guide rows discarded. Case 1003 has two accused, 1006 two witnesses and
   1009 two cheques, read from the `_2` columns. Click **Create batch**.
4. Excel cases arrive without documents, so the batch opens on **Documents**. Then
   **Case details** shows two cheques to check (returned for "payment stopped" and "account
   closed") and one case held for a 5-digit pincode: type `380015` and **Save**. Two AI
   checks also appear: an individual named "Shree Ganesh Traders", and an address in
   Vadodara with an Ahmedabad pincode. Continue as in Walkthrough B.

You can also export from Provakil: tick cases, **Export**, **SARAS 2.0 bulk filing
template**.

### Walkthrough D: Upload an Excel file in a different layout

1. **Upload Excel** again and choose `tata-capital-recovery-mis.xlsx`.
2. A **Match your columns** screen appears.
   - At the top, **Found in your file** says "Some cases have up to 2 cheques". The counts
     are the most any one case has; other cases leave the extra columns blank. If a count is
     wrong, use **−** and **+** to correct it.
   - Each row reads, left to right: the field in the case (ON Courts mark), an arrow, and
     the column in your sheet (Excel mark). The dropdown shows each column's first value,
     so you can pick by what it holds; once chosen, that value shows under it.
   - Fields with no good match say **Skip (fill manually later)**. **Continue** always goes
     on; skipped details are filled on **Case details**. Twelve are matched already by name.
     Match the rest:

   | Field | Choose |
   |---|---|
   | Case reference | Loan A/c No |
   | Accused type | Cust Type |
   | Accused mobile | Mobile No |
   | Accused address | Communication Address |
   | Person responsible name | Director/Partner |
   | Cheque date | Chq Dt |
   | Cheque amount | Chq Amount (Rs) |
   | Presentation date | Presented On |
   | Deposited in complainant's own account | Every row: Yes |
   | Nature of debt | Every row: Loan / advance repayment |
   | Notice mode of service | Sent Via |
   | Notice tracking number | AWB No |
   | Notice delivered | Notice Status |
   | Notice return date | Returned On |
   | Reason for non-delivery | Remarks |
   | Accused replied | Reply Recd |
   | Amount paid | Recovered After Notice |

   - Each column field is searchable: type part of a column's name, or of a value in it.
     Columns already used elsewhere show a green badge; picking one asks before moving it.
   - Sections that can repeat have tabs, as in a single filing. Open **Cheque 2**: it has
     already followed your Cheque 1 choices, using the `_2` columns.
   - **Show optional fields** reveals the rest (accused email, police station, witnesses and
     so on), in case your sheet has them.

   **Continue** always goes on. Fields left on Skip are filled on **Case details**.
3. A **Match your values** screen appears for the lender's own words:
   `COMPANY` and `FIRM` mean Institution; `INSUFFICIENT FUNDS` means Funds insufficient;
   `A/C CLOSED` means Account closed; `Regd. Post A/D` means Registered post (RPAD);
   `SERVED` and `Y` mean Yes; `RETURNED` and `N` mean No.
4. **Review**, then **Create batch**. The two company and firm cases will ask for their type
   of institution on **Case details**, because this file has no column for it.

If the dates in the demo files are more than two weeks old, some cases will ask for a
reason for delay. To make fresh copies dated from today, run `npm run demo:files` in the
terminal (with the demo stopped, or in a second terminal window).

### Walkthrough E: Upload case documents (AI)

Twenty sample complaints are in `demo-files/case-documents`, one Word file per case. Its
README says what each one shows.

1. On SARAS 2.0, **Bulk filing**, click **Upload cases**. (While AI is on, it takes Word
   files and PDFs as well as Excel. With `?ai=off` in the address it takes Excel only.)
2. Pick the complainant and advocates as for Excel, drag in some or all of the documents,
   and click **Next**. The AI reads each document into the template's columns, so there
   is no column matching; the review shows one row per document.
3. **Create batch**. It continues as in Walkthrough B, starting on **Documents**.
4. In **Case details**, check each case as for any batch. Fields the document did not
   have are flagged. **Original document** beside the case reference opens the file the
   case was read from. Good ones to open:
   - `TCL-AHD-PL-2004`: the cheque is described in a sentence.
   - `TCL-AHD-PL-2006`: "Insufficient funds" is read as the court's "Funds insufficient".
   - `TCL-AHD-TL-2005`: two accused.
   - `TCL-AHD-PL-2018`: no loan number, so the file name stands in.

To make fresh copies dated from today, run `npm run demo:files` in the
terminal (with the demo stopped, or in a second terminal window).

### Walkthrough E: Upload case documents (AI)

Twenty sample complaints are in `demo-files/case-documents`, one Word file per case. Its
README says what each one shows.

1. On SARAS 2.0, **Bulk filing**, click **Upload case documents**. (It is there only while
   AI is on. With `?ai=off` in the address it disappears and the page points to Excel.)
2. Pick the complainant and advocates as for Excel, drag in some or all of the documents,
   and click **Read … documents**.
3. Each case opens on its own: the document on the left, the fields read from it on the
   right, in the same sections as a single filing. Green fields were read as labelled.
   Amber ones need a look, with the reason under them; click one and its line in the
   document lights up. Required fields not in the document are marked.
4. Correct anything, then **Confirm case**, or **Set aside** to leave it out. The list on
   the left shows where every case stands. Good ones to open:
   - `TCL-AHD-PL-2004`: the cheque is described in a sentence, so its details are amber.
   - `TCL-AHD-PL-2006`: "Insufficient funds" is read as the court's "Funds insufficient".
   - `TCL-AHD-TL-2005`: two accused.
   - `TCL-AHD-PL-2018`: no loan number, so the file name stands in, marked to check.
5. When every case is decided, **Create batch with … cases**. It continues as in
   Walkthrough B, starting on **Documents**.

To make fresh copies dated from today, run `npm run demo:docs`.

### Walkthrough F: Club batches

On SARAS 2.0, **Bulk filing**, tick two or more batches for the same complainant and click
**Club … batches**. Their open cases move into one new batch; the old ones show "Clubbed
into …". Filed cases stay where they were.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| `node: command not found`, or a version below 22 | Install Node.js 22 or newer (Part 1, step 1), then close and reopen the terminal. |
| `Port 3000 is in use` or `3100 is in use` | Another program uses that address. Close it, or restart the computer, then `npm run demo` again. |
| A page is blank or keeps loading | Wait 30 seconds and reload. The first visit to each page takes longer. |
| Provakil shows "SARAS 2.0 is not reachable" | The demo was started some other way. Stop it (Ctrl + C) and use `npm run demo`. |
| `npm install` fails | Check the internet connection and run `npm install` again. |
| Anything else | Stop with Ctrl + C, run `npm run demo -- --reset`, and try again. Send the last lines of the terminal to the team. |
