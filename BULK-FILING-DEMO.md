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
   Filing** tab.
2. Some cases say **Unassigned** in the Advocate column. Tick a few cases, including some
   unassigned ones. A bar appears at the bottom.
3. **File in court** is greyed out until every ticked case has an advocate. Click
   **Assign advocate**, pick one, click **Assign**.
4. Click **File in court**. Only **SARAS 2.0** (Gujarat) can be chosen; the other courts
   have no jurisdiction over these cases.
5. Read the summary: Tata Capital as complainant, the advocate, and any gaps Provakil can
   see (for example a missing tracking report). Click **File … cases on SARAS 2.0**.
6. The result shows a batch number such as `BLK-2026-0001`. Cases for different advocates
   become separate batches, one per advocate. Click **Open on SARAS 2.0**.
7. Back in Provakil, the cases now sit under **Filed**, marked "On SARAS 2.0" with the batch
   number. Click a row to see its details, documents and activity.
8. **Settings** (bottom left) shows the connector and the full field-by-field mapping.

Things greyed out in Provakil are not part of the demo.

### Walkthrough B: Work through a batch on SARAS 2.0

Open a batch (from Provakil's link, or from **Bulk filing** on SARAS 2.0). The tabs run in
order:

1. **Cases**: every case with its status. Click one for details and documents.
2. **Documents**: what each case is missing. Use **Upload** in any "Missing" cell and pick
   any PDF on your computer. Or drop several files at once named like
   `GJ-PL-0041870_DCM-5.pdf` (case reference, underscore, document code); they attach
   themselves.
3. **Scrutiny**: the filing checks.
   - **Hold** (red): something required is missing or wrong. The case waits; the rest go
     ahead. Fix it right there (for example type a reason for delay, or correct a mobile
     number) and press **Save**.
   - **Check** (amber): worth a second look, for example a cheque returned for "payment
     stopped" rather than "insufficient funds". Press **Skip this check**, or **Skip for
     all** when several cases have the same check.
4. **Sign**: choose the cases and a method. Fastest first: Mobile OTP, DSC, Aadhaar eSign
   (5 cases per OTP, so several OTPs; the note under it explains why and links to the
   rule), Upload signed copies. Any 6 digits work as the OTP or PIN.
5. **Pay**: one payment for all the chosen cases. Each case gets its own receipt and case
   number, and counts as filed at that moment.

Go back to Provakil and press **Refresh**: filed cases now show their case numbers.

### Walkthrough C: Upload an Excel file that follows the template

1. On SARAS 2.0, **Bulk filing**, click **Download Excel template** to see the format.
2. Easiest way to get a filled one: in Provakil, tick some cases that are not yet filed,
   click **Export**, choose **SARAS 2.0 bulk filing template**.
3. On SARAS 2.0, click **Upload Excel**. Pick the complainant and advocate, choose the file,
   click **Read file**.
4. Because it follows the template, it goes straight to **Review**. Click **Create batch**.
5. Excel cases arrive without documents, so the batch opens on **Documents**. Continue as in
   Walkthrough B.

### Walkthrough D: Upload an Excel file in a different layout

1. In Provakil, tick some cases, click **Export**, choose **Provakil case report**. This is
   Provakil's own layout, with its own column names.
2. On SARAS 2.0, **Upload Excel** this file.
3. A **Match your columns** screen appears. Most fields are matched already. Finish the rest:
   - Accused type: choose the **Constitution** column.
   - Accused institution type: choose **Not in my file**.
   - Nature of debt: choose **Every row: Loan / advance repayment**.
   - Deposited in complainant's own account: choose **Every row: Yes**.
   - Notice delivered: choose the **Notice Status** column.
   - Notice delivery date: choose the **Status Date** column.
4. A **Match your values** screen appears for values the court does not use, for example
   `01 - Funds Insufficient` to **Funds insufficient**, `Delivered` to **Yes**,
   `Sole Proprietorship` to **Individual**.
5. **Review**, then **Create batch**.

### Walkthrough E: Club batches

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
