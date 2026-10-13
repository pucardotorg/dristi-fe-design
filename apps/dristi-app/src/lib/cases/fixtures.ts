/**
 * Review fixtures for the Cases list — no backend yet.
 *
 * Shaped to exercise the states the brief requires: every case has a name,
 * stages with and without a substage, long-pending registry entries, long
 * labels that must wrap, both registered number formats, and enough rows to
 * page at 10 per page.
 */
import type { ActiveStage, CaseCounsel, CaseRecord } from "./types";

/**
 * The day this fixture set describes. Relative filters ("in the last 30 days")
 * resolve against it, so the list renders the same on every run — a real
 * backend supplies request time instead.
 */
export const FIXTURE_TODAY = "2026-08-11";

type FixtureRow = Omit<CaseRecord, "counsel"> & {
  assignedAdvocate?: string;
};

const FIXTURE_ROWS: FixtureRow[] = [
  {
    id: "c-1001",
    caseNumber: "CMP/1842/2026",
    parties: { complainant: "Sunil Varghese", accused: "Anand Traders" },
    court: "JMFC-I",
    filedOn: "2026-06-12",
    /* Newest in the register on purpose: this is the fully-populated demo
       case (documents, applications, parties pack, tasks), so the silent
       recently-updated-first order puts it at the top of Your Cases where a
       demo starts (Aug 31 round). */
    updatedOn: "2026-08-26",
    assignedAdvocate: "Adv. Suresh Menon",
    latestUpdate: "PW-1 examined in chief and partly cross-examined",
    nextHearing: {
      on: "2026-08-19",
      purpose: "Further cross-examination of PW-1 and evidence of PW-2",
    },
    previousHearingOn: "2026-07-29",
    stage: "evidence",
    substage: "Evidence of the complainant",
    longPending: false,
    bookmarked: true,
  },
  {
    id: "c-1002",
    caseNumber: "KL-KLKM-000342-2026",
    parties: {
      complainant: "Meenakshi Nair",
      accused: "Coastal Agro Exports Pvt Ltd",
    },
    court: "JMFC-II",
    filedOn: "2026-05-28",
    updatedOn: "2026-08-09",
    assignedAdvocate: "Adv. Anitha George",
    latestUpdate: "Accused entered appearance",
    nextHearing: {
      on: "2026-09-02",
      purpose: "Framing of charge",
    },
    previousHearingOn: "2026-07-27",
    stage: "appearance",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1003",
    caseNumber: "CMP/1903/2026",
    parties: { complainant: "Kiran Mathew", accused: "Harbour Line Shipping" },
    court: "JMFC-I, Ernakulam",
    filedOn: "2026-08-04",
    updatedOn: "2026-08-08",
    assignedAdvocate: "Adv. Farooq Ali",
    latestUpdate: "Scrutiny note recorded",
    stage: "scrutiny",
    substage: "Defects marked, court fee and condonation of delay",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1004",
    caseNumber: "KL-KLEK-001204-2026",
    parties: { complainant: "Rajeev Menon", accused: "Ferns Interiors" },
    court: "JMFC-I, Ernakulam",
    filedOn: "2026-04-02",
    updatedOn: "2026-08-07",
    assignedAdvocate: "Adv. Meera Krishnan",
    latestUpdate: "Complainant affidavit filed under §145",
    nextHearing: {
      on: "2026-08-13",
      purpose: "Interim application",
    },
    previousHearingOn: "2026-07-23",
    stage: "evidence",
    substage:
      "Recall application pending, complainant seeks to produce the bank's dishonour memo and the ledger extract for the disputed period",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1005",
    caseNumber: "CMP/0221/2023",
    parties: { complainant: "Ayesha Rahman", accused: "Sreekumar P" },
    court: "JMFC-I",
    filedOn: "2023-02-14",
    updatedOn: "2026-07-30",
    assignedAdvocate: "Adv. Jacob Thomas",
    latestUpdate: "Hearing adjourned, accused absent",
    /* Rolled forward off 6 August: a live case cannot hold a next date that
       has already passed, and the past one put "Before the hearing on 6
       August 2026" above a task that was five days past due. Six weeks off
       the 14 July sitting is the room a warrant needs to be executed. */
    nextHearing: {
      on: "2026-08-27",
      purpose: "Evidence",
    },
    previousHearingOn: "2026-07-14",
    stage: "evidence",
    substage: "Accused absent, non-bailable warrant issued",
    longPending: true,
    bookmarked: true,
  },
  {
    id: "c-1006",
    caseNumber: "KL-KLTV-000876-2026",
    parties: {
      complainant: "Thomas Kurian",
      accused: "Highland Rubber Works",
    },
    court: "JMFC-I, Thiruvananthapuram",
    filedOn: "2026-07-19",
    updatedOn: "2026-08-06",
    assignedAdvocate: "Adv. Harpreet Gill",
    latestUpdate: "Summons returned served by speed post",
    nextHearing: {
      on: "2026-08-14",
      purpose: "Cross-examination",
    },
    previousHearingOn: "2026-07-20",
    stage: "summons",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1007",
    caseNumber: "CMP/1755/2026",
    parties: { complainant: "Deepa Suresh", accused: "Vasanth Kumar S" },
    court: "JMFC-II",
    filedOn: "2026-03-11",
    updatedOn: "2026-08-05",
    assignedAdvocate: "Adv. K. Ramesh",
    latestUpdate: "Part-heard before predecessor magistrate",
    nextHearing: {
      on: "2026-08-14",
      purpose: "Appearance",
    },
    previousHearingOn: "2026-07-18",
    stage: "arguments",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1008",
    caseNumber: "HR-PKL-000455-2026",
    parties: {
      complainant: "Shubhreet Singh",
      accused: "Gill Steel Fabricators",
    },
    court: "JMFC-III, Panchkula",
    filedOn: "2026-06-30",
    updatedOn: "2026-08-05",
    assignedAdvocate: "Adv. Priya Nambiar",
    latestUpdate: "Accused entered appearance",
    nextHearing: {
      on: "2026-08-15",
      purpose: "Arguments",
    },
    previousHearingOn: "2026-07-17",
    stage: "appearance",
    substage: "Interim compensation under §143A directed",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1009",
    caseNumber: "CMP/1611/2025",
    parties: { complainant: "Fathima Beevi", accused: "Nithin Jose" },
    court: "JMFC-I",
    filedOn: "2025-11-08",
    updatedOn: "2026-08-04",
    assignedAdvocate: "Adv. Suresh Menon",
    latestUpdate: "Complainant affidavit filed under §145",
    nextHearing: {
      on: "2026-08-15",
      purpose: "For orders",
    },
    previousHearingOn: "2026-07-15",
    stage: "evidence",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1010",
    caseNumber: "KL-KLEK-000998-2025",
    parties: {
      complainant: "Standard Chit Funds Ltd",
      accused: "Prakash Chandran",
    },
    court: "JMFC-I, Ernakulam",
    filedOn: "2025-09-22",
    updatedOn: "2026-08-03",
    assignedAdvocate: "Adv. K. Ramesh",
    latestUpdate: "Written submissions filed",
    nextHearing: {
      on: "2026-08-16",
      purpose: "Interim application",
    },
    previousHearingOn: "2026-07-13",
    stage: "judgment",
    longPending: false,
    bookmarked: true,
  },
  {
    id: "c-1011",
    caseNumber: "CMP/0114/2022",
    parties: { complainant: "Ibrahim Kutty", accused: "Salim Traders" },
    court: "JMFC-II",
    filedOn: "2022-08-30",
    updatedOn: "2026-08-02",
    assignedAdvocate: "Adv. Priya Nambiar",
    latestUpdate: "Recall application listed",
    nextHearing: {
      on: "2026-08-16",
      purpose: "Evidence",
    },
    previousHearingOn: "2026-07-11",
    stage: "evidence",
    substage: "Part-heard, witness summons returned unserved twice",
    longPending: true,
    bookmarked: false,
  },
  {
    id: "c-1012",
    caseNumber: "KL-KLTV-000701-2026",
    parties: { complainant: "Reshma Pillai", accused: "Capitol Stationery" },
    court: "JMFC-I, Thiruvananthapuram",
    filedOn: "2026-08-01",
    updatedOn: "2026-08-02",
    latestUpdate: "Awaiting cognizance order",
    stage: "cognizance",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1013",
    caseNumber: "CMP/1690/2026",
    parties: { complainant: "Lakshmi Priya R", accused: "Orchid Builders" },
    court: "JMFC-I",
    filedOn: "2026-02-17",
    updatedOn: "2026-08-01",
    assignedAdvocate: "Adv. Anitha George",
    latestUpdate: "Complainant affidavit filed under §145",
    nextHearing: {
      on: "2026-08-17",
      purpose: "Appearance",
    },
    previousHearingOn: "2026-07-08",
    stage: "evidence",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1014",
    caseNumber: "HR-PKL-000318-2025",
    parties: { complainant: "Vinod Sharma", accused: "Aggarwal Motors" },
    court: "JMFC-III, Panchkula",
    filedOn: "2025-06-05",
    updatedOn: "2026-07-29",
    assignedAdvocate: "Adv. Farooq Ali",
    latestUpdate: "Final arguments partly heard",
    nextHearing: {
      on: "2026-08-15",
      purpose: "Arguments",
    },
    previousHearingOn: "2026-07-04",
    stage: "arguments",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1015",
    caseNumber: "CMP/0087/2023",
    parties: {
      complainant: "Kerala Spice Traders Association",
      accused: "Manoj Pillai",
    },
    court: "JMFC-I, Ernakulam",
    filedOn: "2023-01-19",
    updatedOn: "2026-07-28",
    assignedAdvocate: "Adv. Meera Krishnan",
    latestUpdate: "Plea recorded",
    nextHearing: {
      on: "2026-08-15",
      purpose: "For orders",
    },
    previousHearingOn: "2026-07-02",
    stage: "appearance",
    substage: "Accused untraced, proclamation ordered",
    longPending: true,
    bookmarked: false,
  },
  {
    id: "c-1016",
    caseNumber: "KL-KLKM-000455-2026",
    parties: { complainant: "Anil Kumar T", accused: "Seaside Marine Foods" },
    court: "JMFC-II",
    filedOn: "2026-07-08",
    updatedOn: "2026-07-27",
    assignedAdvocate: "Adv. Jacob Thomas",
    latestUpdate: "Summons returned unserved",
    nextHearing: {
      on: "2026-08-15",
      purpose: "Further evidence",
    },
    previousHearingOn: "2026-06-30",
    stage: "summons",
    substage: "Served by speed post",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1017",
    caseNumber: "CMP/1512/2025",
    parties: { complainant: "Geetha Mohan", accused: "Ravi Sankar" },
    court: "JMFC-I, Thiruvananthapuram",
    filedOn: "2025-08-14",
    updatedOn: "2026-07-25",
    assignedAdvocate: "Adv. Harpreet Gill",
    latestUpdate: "Order sheet updated after part-heard evidence",
    nextHearing: {
      on: "2026-08-14",
      purpose: "Framing of charge",
    },
    previousHearingOn: "2026-07-18",
    stage: "evidence",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1018",
    caseNumber: "KL-KLEK-001077-2026",
    parties: {
      complainant: "Backwater Logistics LLP",
      accused: "Jayaprakash Nambiar",
    },
    court: "JMFC-I, Ernakulam",
    filedOn: "2026-05-06",
    updatedOn: "2026-07-24",
    assignedAdvocate: "Adv. K. Ramesh",
    latestUpdate: "Plea recorded",
    nextHearing: {
      on: "2026-08-14",
      purpose: "Judgment",
    },
    previousHearingOn: "2026-07-16",
    stage: "appearance",
    substage: "Plea recorded",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1019",
    caseNumber: "CMP/0298/2023",
    parties: { complainant: "Noushad M", accused: "Crescent Hardware" },
    court: "JMFC-I",
    filedOn: "2023-05-24",
    updatedOn: "2026-07-22",
    assignedAdvocate: "Adv. Priya Nambiar",
    latestUpdate: "Hearing adjourned, accused absent",
    nextHearing: {
      on: "2026-08-13",
      purpose: "Interim application",
    },
    previousHearingOn: "2026-07-13",
    stage: "evidence",
    longPending: true,
    bookmarked: false,
  },
  {
    id: "c-1020",
    caseNumber: "HR-PKL-000512-2026",
    parties: { complainant: "Amit Khurana", accused: "Shivalik Agro Mart" },
    court: "JMFC-III, Panchkula",
    filedOn: "2026-07-28",
    updatedOn: "2026-07-21",
    latestUpdate: "Scrutiny cleared, file placed for registration",
    stage: "scrutiny",
    substage: "Cleared scrutiny, awaiting registration",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1021",
    caseNumber: "KL-KLTV-000644-2025",
    parties: { complainant: "Susan Jacob", accused: "Elite Tyres" },
    court: "JMFC-I, Thiruvananthapuram",
    filedOn: "2025-10-30",
    updatedOn: "2026-07-20",
    assignedAdvocate: "Adv. K. Ramesh",
    latestUpdate: "Order sheet updated after part-heard evidence",
    nextHearing: {
      on: "2026-07-25",
      purpose: "For orders",
    },
    previousHearingOn: "2026-07-09",
    stage: "evidence",
    substage: "Complainant's affidavit filed under §145",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1022",
    caseNumber: "CMP/1408/2025",
    parties: { complainant: "Hari Govind", accused: "Balan Nair" },
    court: "JMFC-II",
    filedOn: "2025-07-11",
    updatedOn: "2026-07-18",
    assignedAdvocate: "Adv. Priya Nambiar",
    latestUpdate: "Part-heard before predecessor magistrate",
    nextHearing: {
      on: "2026-07-24",
      purpose: "Further evidence",
    },
    previousHearingOn: "2026-07-06",
    stage: "arguments",
    longPending: false,
    bookmarked: true,
  },
  {
    id: "c-1023",
    caseNumber: "KL-KLKM-000201-2026",
    parties: {
      complainant: "Devi Enterprises",
      accused: "Muhammed Ashraf",
    },
    court: "JMFC-I",
    filedOn: "2026-01-23",
    updatedOn: "2026-07-16",
    assignedAdvocate: "Adv. Suresh Menon",
    latestUpdate: "Hearing adjourned, accused absent",
    nextHearing: {
      on: "2026-07-23",
      purpose: "Framing of charge",
    },
    previousHearingOn: "2026-07-03",
    stage: "evidence",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1024",
    caseNumber: "CMP/0166/2022",
    parties: { complainant: "Sajeev Kumar", accused: "Western Ghats Timber" },
    court: "JMFC-I, Ernakulam",
    filedOn: "2022-11-04",
    updatedOn: "2026-07-15",
    assignedAdvocate: "Adv. Anitha George",
    latestUpdate: "Arguments concluded, reserved",
    nextHearing: {
      on: "2026-07-23",
      purpose: "Judgment",
    },
    previousHearingOn: "2026-07-01",
    stage: "arguments",
    substage: "Part-heard before the predecessor magistrate",
    longPending: true,
    bookmarked: false,
  },
  {
    id: "c-1025",
    caseNumber: "KL-KLEK-001188-2026",
    parties: { complainant: "Bindu Rajan", accused: "Sunrise Tours" },
    court: "JMFC-I, Ernakulam",
    filedOn: "2026-06-25",
    updatedOn: "2026-07-14",
    assignedAdvocate: "Adv. Farooq Ali",
    latestUpdate: "Summons returned unserved",
    nextHearing: {
      on: "2026-07-23",
      purpose: "Interim application",
    },
    previousHearingOn: "2026-06-29",
    stage: "summons",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1026",
    caseNumber: "CMP/1799/2026",
    parties: { complainant: "Mathew Philip", accused: "Rithika Textiles" },
    court: "JMFC-I, Thiruvananthapuram",
    filedOn: "2026-04-17",
    updatedOn: "2026-07-12",
    assignedAdvocate: "Adv. Meera Krishnan",
    latestUpdate: "Accused entered appearance",
    nextHearing: {
      on: "2026-07-22",
      purpose: "Evidence",
    },
    previousHearingOn: "2026-06-26",
    stage: "appearance",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1027",
    caseNumber: "HR-PKL-000276-2025",
    parties: { complainant: "Karun Malhotra", accused: "Sethi Cold Storage" },
    court: "JMFC-III, Panchkula",
    filedOn: "2025-04-09",
    updatedOn: "2026-07-10",
    assignedAdvocate: "Adv. Jacob Thomas",
    latestUpdate: "Complainant affidavit filed under §145",
    nextHearing: {
      on: "2026-07-21",
      purpose: "Cross-examination",
    },
    previousHearingOn: "2026-06-23",
    stage: "evidence",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1028",
    caseNumber: "KL-KLKM-000512-2026",
    parties: { complainant: "Shanmugam V", accused: "Pearl Aqua Farms" },
    court: "JMFC-II",
    filedOn: "2026-07-31",
    updatedOn: "2026-07-09",
    assignedAdvocate: "Adv. Priya Nambiar",
    latestUpdate: "Cognizance taken, summons to issue",
    stage: "cognizance",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1029",
    caseNumber: "CMP/0342/2023",
    parties: { complainant: "Radhika Menon", accused: "Zenith Publishers" },
    court: "JMFC-I",
    filedOn: "2023-07-27",
    updatedOn: "2026-07-07",
    assignedAdvocate: "Adv. K. Ramesh",
    latestUpdate: "Non-bailable warrant issued",
    nextHearing: {
      on: "2026-07-20",
      purpose: "Arguments",
    },
    previousHearingOn: "2026-06-18",
    stage: "evidence",
    longPending: true,
    bookmarked: false,
  },
  {
    id: "c-1030",
    caseNumber: "KL-KLTV-000733-2026",
    parties: { complainant: "Joseph Antony", accused: "Greenfield Nurseries" },
    court: "JMFC-I, Thiruvananthapuram",
    filedOn: "2026-03-30",
    updatedOn: "2026-07-05",
    assignedAdvocate: "Adv. Jacob Thomas",
    latestUpdate: "Order sheet updated after part-heard evidence",
    nextHearing: {
      on: "2026-07-20",
      purpose: "Judgment",
    },
    previousHearingOn: "2026-06-15",
    stage: "evidence",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1031",
    caseNumber: "CMP/1633/2025",
    parties: { complainant: "Nazeer Hussain", accused: "Kiran Auto Works" },
    court: "JMFC-II",
    filedOn: "2025-12-02",
    updatedOn: "2026-07-03",
    assignedAdvocate: "Adv. Harpreet Gill",
    latestUpdate: "Interim compensation directed under §143A",
    nextHearing: {
      on: "2026-07-19",
      purpose: "Interim application",
    },
    previousHearingOn: "2026-06-12",
    stage: "appearance",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1032",
    caseNumber: "KL-KLEK-001255-2026",
    parties: { complainant: "Latha Krishnan", accused: "Aster Pharma Retail" },
    court: "JMFC-I, Ernakulam",
    filedOn: "2026-07-24",
    updatedOn: "2026-07-01",
    assignedAdvocate: "Adv. K. Ramesh",
    latestUpdate: "Summons issued",
    nextHearing: {
      on: "2026-07-18",
      purpose: "Evidence",
    },
    previousHearingOn: "2026-06-09",
    stage: "summons",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1033",
    caseNumber: "HR-PKL-000398-2026",
    parties: { complainant: "Mandeep Kaur", accused: "Tricity Constructions" },
    court: "JMFC-III, Panchkula",
    filedOn: "2026-02-05",
    updatedOn: "2026-06-28",
    assignedAdvocate: "Adv. Priya Nambiar",
    latestUpdate: "Judgment listed",
    nextHearing: {
      on: "2026-07-16",
      purpose: "Cross-examination",
    },
    previousHearingOn: "2026-06-05",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "c-1034",
    caseNumber: "CMP/1866/2026",
    parties: { complainant: "Vijayan Pillai", accused: "Sunlit Solar Systems" },
    court: "JMFC-I",
    filedOn: "2026-06-18",
    updatedOn: "2026-06-26",
    assignedAdvocate: "Adv. Suresh Menon",
    latestUpdate: "Interim compensation directed under §143A",
    nextHearing: {
      on: "2026-07-15",
      purpose: "Appearance",
    },
    previousHearingOn: "2026-06-02",
    stage: "appearance",
    longPending: false,
    bookmarked: false,
  },

  {
    id: "c-2001",
    caseNumber: "CMP/1120/2024",
    parties: { complainant: "Prasad Kumar", accused: "Nova Print House" },
    court: "JMFC-I",
    filedOn: "2024-03-15",
    updatedOn: "2026-06-20",
    assignedAdvocate: "Adv. Priya Nambiar",
    latestUpdate: "Compounding petition allowed",
    previousHearingOn: "2026-05-26",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "compounded", on: "2026-06-20" },
  },
  {
    id: "c-2002",
    caseNumber: "KL-KLEK-000765-2024",
    parties: { complainant: "Elsa Thomas", accused: "Cardamom Hills Estate" },
    court: "JMFC-I, Ernakulam",
    filedOn: "2024-05-02",
    updatedOn: "2026-05-29",
    assignedAdvocate: "Adv. Suresh Menon",
    latestUpdate: "Conviction recorded",
    previousHearingOn: "2026-05-03",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "convicted", on: "2026-05-29" },
  },
  {
    id: "c-2003",
    caseNumber: "CMP/0954/2024",
    parties: { complainant: "Ganesh Iyer", accused: "Rapid Freight Movers" },
    court: "JMFC-II",
    filedOn: "2024-01-26",
    updatedOn: "2026-05-11",
    assignedAdvocate: "Adv. Anitha George",
    latestUpdate: "Acquittal recorded",
    previousHearingOn: "2026-04-14",
    stage: "judgment",
    longPending: false,
    bookmarked: true,
    disposal: { outcome: "acquitted", on: "2026-05-11" },
  },
  {
    id: "c-2004",
    caseNumber: "HR-PKL-000141-2024",
    parties: { complainant: "Jaspreet Bedi", accused: "Kohli Electricals" },
    court: "JMFC-III, Panchkula",
    filedOn: "2024-07-18",
    updatedOn: "2026-04-30",
    assignedAdvocate: "Adv. Farooq Ali",
    latestUpdate: "Compounding petition allowed",
    previousHearingOn: "2026-04-23",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "compounded", on: "2026-04-30" },
  },
  {
    id: "c-2005",
    caseNumber: "KL-KLTV-000410-2023",
    parties: { complainant: "Remya S", accused: "Trivandrum Tile Works" },
    court: "JMFC-I, Thiruvananthapuram",
    filedOn: "2023-09-12",
    updatedOn: "2026-04-08",
    assignedAdvocate: "Adv. Meera Krishnan",
    latestUpdate: "Complaint dismissed",
    previousHearingOn: "2026-03-31",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "dismissed", on: "2026-04-08" },
  },
  {
    id: "c-2006",
    caseNumber: "CMP/1044/2024",
    parties: { complainant: "Abdul Salam", accused: "Metro Glass Works" },
    court: "JMFC-I",
    filedOn: "2024-02-20",
    updatedOn: "2026-03-19",
    assignedAdvocate: "Adv. Jacob Thomas",
    latestUpdate: "Conviction recorded",
    previousHearingOn: "2026-03-10",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "convicted", on: "2026-03-19" },
  },
  {
    id: "c-2007",
    caseNumber: "KL-KLEK-000822-2024",
    parties: { complainant: "Sheeba Varghese", accused: "Copper Leaf Cafe" },
    court: "JMFC-I, Ernakulam",
    filedOn: "2024-06-07",
    updatedOn: "2026-02-27",
    assignedAdvocate: "Adv. Harpreet Gill",
    latestUpdate: "Compounding petition allowed",
    previousHearingOn: "2026-02-17",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "compounded", on: "2026-02-27" },
  },
  {
    id: "c-2008",
    caseNumber: "CMP/0888/2023",
    parties: { complainant: "Unnikrishnan K", accused: "Sagar Fisheries" },
    court: "JMFC-II",
    filedOn: "2023-11-21",
    updatedOn: "2026-02-05",
    assignedAdvocate: "Adv. K. Ramesh",
    latestUpdate: "Acquittal recorded",
    previousHearingOn: "2026-01-25",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "acquitted", on: "2026-02-05" },
  },
  {
    id: "c-2009",
    caseNumber: "HR-PKL-000098-2023",
    parties: { complainant: "Ritu Bansal", accused: "Panchkula Print Hub" },
    court: "JMFC-III, Panchkula",
    filedOn: "2023-08-16",
    updatedOn: "2026-01-22",
    assignedAdvocate: "Adv. Priya Nambiar",
    latestUpdate: "Compounding petition allowed",
    previousHearingOn: "2026-01-10",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "compounded", on: "2026-01-22" },
  },
  {
    id: "c-2010",
    caseNumber: "KL-KLTV-000377-2023",
    parties: { complainant: "Bhaskaran Nair", accused: "Silverline Motors" },
    court: "JMFC-I, Thiruvananthapuram",
    filedOn: "2023-06-29",
    updatedOn: "2025-12-18",
    assignedAdvocate: "Adv. Harpreet Gill",
    latestUpdate: "Conviction recorded",
    previousHearingOn: "2025-12-05",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "convicted", on: "2025-12-18" },
  },
  {
    id: "c-2011",
    caseNumber: "CMP/0790/2023",
    parties: { complainant: "Jomon Sebastian", accused: "Palm Grove Resorts" },
    court: "JMFC-I, Ernakulam",
    filedOn: "2023-04-11",
    updatedOn: "2025-11-27",
    assignedAdvocate: "Adv. K. Ramesh",
    latestUpdate: "Complaint dismissed",
    previousHearingOn: "2025-11-13",
    stage: "judgment",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "dismissed", on: "2025-11-27" },
  },
  {
    id: "c-2012",
    caseNumber: "HR-PKL-000203-2024",
    parties: { complainant: "Gurpreet Ahuja", accused: "Ambala Paper Mills" },
    court: "JMFC-III, Panchkula",
    filedOn: "2023-12-06",
    updatedOn: "2025-10-15",
    assignedAdvocate: "Adv. Meera Krishnan",
    latestUpdate: "Complaint withdrawn",
    previousHearingOn: "2025-10-02",
    stage: "evidence",
    longPending: false,
    bookmarked: false,
    disposal: { outcome: "withdrawn", on: "2025-10-15" },
  },
];

const ACCUSED_POOL = [
  "Adv. P. Balachandran",
  "Adv. Latha Nambiar",
  "Adv. Arjun Pillai",
  "Adv. Nisha Varma",
] as const;

/** Review cases that exercise several advocates, or one side still without counsel. */
const COUNSEL_OVERRIDES: Partial<Record<string, CaseCounsel>> = {
  /**
   * Two advocates a side. The accused side is the §141 shape the Parties
   * section is built against: three accused sharing one senior between them,
   * and a second advocate briefed by only two of the three — which is what
   * makes "shared counsel" a fact worth deriving rather than a given.
   */
  /* The signed-in advocate holds Sunil Varghese's vakalatnama here — the
     case's whole party-actions story (the removal request against her, her
     Remove entries on the Representation wells) presumes it, and until
     Sept 2 the record contradicted the pack by leaving her off. */
  "c-1001": {
    complainant: ["Adv. Anjali Nair", "Adv. Ramesh Menon", "Adv. Suresh Menon"],
    accused: ["Adv. P. Balachandran", "Adv. Asha Nair"],
  },
  "c-1002": {
    complainant: [
      "Adv. Anitha George",
      "Adv. Nisha Varma",
      "Adv. Rekha Sharma",
    ],
    accused: ["Adv. Farooq Ali", "Adv. K. Ramesh"],
  },
  "c-1003": {
    complainant: ["Adv. Farooq Ali"],
  },
  "c-1004": {
    complainant: ["Adv. Meera Krishnan"],
    accused: ["Adv. Latha Nambiar", "Adv. Arjun Pillai"],
  },
  "c-1005": {
    complainant: ["Adv. Jacob Thomas"],
  },
  "c-1008": {
    complainant: ["Adv. Priya Nambiar", "Adv. Suresh Menon"],
    accused: ["Adv. Harpreet Gill", "Adv. P. Balachandran", "Adv. Nisha Varma"],
  },
};

function defaultAccused(
  complainant: string | undefined,
  index: number
): string[] | undefined {
  if (!complainant) return undefined;
  const pick = ACCUSED_POOL[index % ACCUSED_POOL.length];
  if (pick === complainant) {
    return [ACCUSED_POOL[(index + 1) % ACCUSED_POOL.length]];
  }
  return [pick];
}

function counselForFixture(
  row: FixtureRow,
  index: number
): CaseCounsel | undefined {
  const override = COUNSEL_OVERRIDES[row.id];
  if (override) return override;
  const complainant = row.assignedAdvocate ? [row.assignedAdvocate] : undefined;
  const accused = defaultAccused(row.assignedAdvocate, index);
  if (!complainant && !accused) return undefined;
  return { complainant, accused };
}

const FIXTURE_CASES: CaseRecord[] = FIXTURE_ROWS.map((row, index) => {
  const { assignedAdvocate, ...record } = row;
  return {
    ...record,
    counsel: counselForFixture({ ...record, assignedAdvocate }, index),
  };
});

/* ────────────────── matters bridged from the tasks sandbox ────────────────── */

/**
 * The tasks sandbox (`lib/tasks/sandbox.ts`) runs its own world of matters — the
 * advocate home's cause list and pending tasks. Until now none of them existed
 * here, so the home screen and Your Cases disagreed about what cases the person
 * has. These records are the bridge: one row per numbered sandbox case, id
 * `tw-<sandbox id>`, so the shared case peek and the case file open for them.
 * Pre-filing sandbox matters are deliberately absent — an unregistered complaint
 * is not yet a case this list can hold.
 *
 * Hearing dates here are placeholders: the sandbox lists hearings relative to
 * the real clock, and the home screen overrides `nextHearing` at runtime. This
 * static copy only has to be plausible for the /cases list.
 */
type TwSeed = {
  id: string;
  st: string;
  parties: string;
  court: string;
  stage: ActiveStage;
  substage?: string;
  counsel: string[];
  /**
   * Accused-side counsel, when authored. The default rotation put every
   * seeded advocate on the complainant side, which left the signed-in
   * advocate representing complainants on all 74 cases — flagged as
   * unrealistic (owner, Sept 2). Seeds that name it put her (or anyone)
   * on the defence.
   */
  accused?: string[];
  filedOn: string;
};

const TW_ACCUSED_COUNSEL = [
  "Adv. P. Balachandran",
  "Adv. K. Ramesh",
  "Adv. Latha Nambiar",
  "Adv. Farooq Ali",
];

function tw(seed: TwSeed, index: number): CaseRecord {
  const [complainant, accused] = seed.parties.split(" v. ");
  return {
    id: `tw-${seed.id}`,
    caseNumber: seed.st,
    parties: { complainant, accused },
    counsel: {
      complainant: seed.counsel,
      accused: seed.accused ?? [
        TW_ACCUSED_COUNSEL[index % TW_ACCUSED_COUNSEL.length],
      ],
    },
    court: seed.court,
    filedOn: seed.filedOn,
    updatedOn: "2026-08-25",
    latestUpdate: seed.substage
      ? `Listed for ${seed.substage.toLowerCase()}`
      : "Listed for the next posting",
    stage: seed.stage,
    substage: seed.substage,
    nextHearing: { on: "2026-09-02", purpose: seed.substage ?? "Hearing" },
    previousHearingOn: "2026-08-11",
    longPending: false,
    bookmarked: false,
  };
}

const AN = "Adv. Anjali Nair";
const SP = "Adv. S. Prakash";
const DV = "Adv. Deepa Varghese";
const RM = "Adv. R. Manoj";
const RI = "Adv. Rahul Iyer";
const ON_COURT = "24×7 ON Court";
const JMFC1 = "JMFC Court 1";
const JMFC2 = "JMFC Court 2";
const CJM = "CJM Court";

const TASKS_WORLD_CASES: CaseRecord[] = ([
  { id: "c-412", st: "ST 412/2025", parties: "Sreekumar N. v. Vismaya Traders", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN, RM], filedOn: "2025-02-14" },
  { id: "c-88", st: "ST 88/2026", parties: "Fathima Beevi v. Anil Kumar K.", court: ON_COURT, stage: "appearance", substage: "Plea", counsel: [RI], accused: [AN, "Adv. K. Ramesh"], filedOn: "2026-01-22" },
  { id: "c-941", st: "ST 941/2025", parties: "Anitha Joseph v. Latheef M.", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [DV], filedOn: "2025-06-03" },
  { id: "c-1102", st: "ST 1102/2026", parties: "Nirmala T. v. Ashique P.", court: ON_COURT, stage: "appearance", counsel: [RM], filedOn: "2026-03-18" },
  { id: "c-217", st: "ST 217/2025", parties: "Suresh Babu v. Kairali Motors", court: JMFC1, stage: "appearance", substage: "Plea", counsel: [RM, DV], filedOn: "2025-03-09" },
  { id: "c-509", st: "ST 509/2025", parties: "Lakshmi Menon v. P. J. Thomas", court: JMFC1, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN, SP], filedOn: "2025-04-27" },
  { id: "c-144", st: "ST 144/2025", parties: "K. Radhakrishnan v. Chandy & Sons", court: JMFC1, stage: "arguments", counsel: [AN, DV], filedOn: "2025-01-30" },
  { id: "c-71", st: "ST 71/2025", parties: "Joseph Mathew v. Star Traders", court: JMFC2, stage: "evidence", substage: "Evidence of the complainant", counsel: [DV], filedOn: "2025-02-02" },
  { id: "c-381", st: "ST 381/2025", parties: "Rukhiya Beevi v. N. Pillai", court: JMFC2, stage: "cognizance", counsel: [AN], filedOn: "2025-05-16" },
  { id: "c-52", st: "ST 52/2025", parties: "Shaji P. v. Lakeside Cashew Co.", court: CJM, stage: "evidence", substage: "Evidence of the complainant", counsel: [DV, AN], filedOn: "2025-01-12" },
  { id: "c-221", st: "ST 221/2025", parties: "Ramesh P. v. Coastal Traders", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [RM], filedOn: "2025-03-21" },
  { id: "c-377", st: "ST 377/2025", parties: "Sujatha R. v. M. Haneefa", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [RM], filedOn: "2025-04-08" },
  { id: "c-633", st: "ST 633/2025", parties: "Sheeba Rasheed v. Muhammed Ashraf", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [RM], filedOn: "2025-05-29" },
  { id: "c-702", st: "ST 702/2025", parties: "Manoj Kurian v. Highrange Estates", court: JMFC1, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN], filedOn: "2025-06-11" },
  { id: "c-815", st: "ST 815/2025", parties: "Vinod Chandran v. Sabari Traders", court: CJM, stage: "arguments", counsel: [DV], accused: [AN], filedOn: "2025-02-25" },
  { id: "c-1044", st: "ST 1044/2026", parties: "Beena Thomas v. A. Salim", court: JMFC2, stage: "appearance", counsel: [DV], filedOn: "2026-02-13" },
  { id: "c-hd1", st: "ST 268/2025", parties: "Prakash Kumar v. Malabar Traders", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN], filedOn: "2025-03-02" },
  { id: "c-hd2", st: "ST 743/2025", parties: "Divya Suresh v. K. Salim", court: ON_COURT, stage: "appearance", substage: "Plea", counsel: [RM], accused: [AN], filedOn: "2025-07-19" },
  { id: "c-hd3", st: "ST 512/2025", parties: "Gopinathan Nair v. Chaithanya Agencies", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN], filedOn: "2025-04-15" },
  { id: "c-hd4", st: "ST 391/2026", parties: "Mariyam Bee v. Anwar Sadath", court: ON_COURT, stage: "appearance", counsel: [DV], filedOn: "2026-02-06" },
  { id: "c-hd5", st: "ST 129/2026", parties: "Ravi Chandran v. Sea Pearl Exports", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN, DV], filedOn: "2026-01-08" },
  { id: "c-hd6", st: "ST 84/2026", parties: "Salini Mohan v. Grand Textiles", court: JMFC1, stage: "appearance", substage: "Plea", counsel: [AN], filedOn: "2026-01-27" },
  { id: "c-hd7", st: "ST 610/2025", parties: "Peter Varghese v. Nila Finance", court: JMFC1, stage: "arguments", counsel: [RM], filedOn: "2025-05-07" },
  { id: "c-hd8", st: "ST 233/2025", parties: "Asha Kumari v. Vel Murugan Stores", court: JMFC1, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN], filedOn: "2025-02-19" },
  { id: "c-hd9", st: "ST 47/2025", parties: "Krishnan Kutty v. Sree Devi Traders", court: CJM, stage: "arguments", counsel: [AN], filedOn: "2025-01-05" },
  { id: "c-hd10", st: "ST 902/2025", parties: "Noor Jahan v. Kadavil Motors", court: CJM, stage: "appearance", counsel: [DV, AN], filedOn: "2025-06-24" },
  { id: "c-hd11", st: "ST 318/2025", parties: "Vasanthi Amma v. Deepak Nambiar", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN, DV, SP, RI], filedOn: "2025-03-11" },
  { id: "c-hd12", st: "ST 655/2026", parties: "Faisal Rahman v. Ponnamma K.", court: ON_COURT, stage: "appearance", counsel: [RM, AN, SP], filedOn: "2026-02-24" },
  { id: "c-hd13", st: "ST 205/2026", parties: "Leelamma Joy v. Sunrise Plywoods", court: ON_COURT, stage: "evidence", substage: "Cross-examination", counsel: [AN, SP], filedOn: "2026-01-15" },
  { id: "c-hd14", st: "ST 471/2025", parties: "Abdul Latheef v. Thejas Marine", court: ON_COURT, stage: "appearance", substage: "Plea", counsel: [AN, RM, DV, SP], filedOn: "2025-05-29" },
  { id: "c-hd15", st: "ST 830/2025", parties: "Sarala Devi v. Kochu Varkey", court: ON_COURT, stage: "arguments", counsel: [DV, AN, RI], filedOn: "2025-06-12" },
  { id: "c-hd16", st: "ST 96/2026", parties: "Jaseela Beegum v. Anand Motors", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN, RI, SP], filedOn: "2026-01-30" },
  { id: "c-hd17", st: "ST 1190/2026", parties: "Rajeev Menon v. Padmini Traders", court: ON_COURT, stage: "appearance", counsel: [AN, SP], filedOn: "2026-04-02" },
  { id: "c-pa1", st: "ST 559/2025", parties: "Girija Kumari v. Elite Hardwares", court: ON_COURT, stage: "evidence", substage: "Cross-examination", counsel: [AN, DV, SP], filedOn: "2025-04-08" },
  { id: "c-pa2", st: "ST 1073/2026", parties: "Hariharan P. v. Blue Wave Foods", court: ON_COURT, stage: "arguments", counsel: [AN, RI], filedOn: "2026-02-17" },
  { id: "c-pa3", st: "ST 284/2026", parties: "Zainaba M. v. Crescent Steels", court: JMFC1, stage: "evidence", substage: "Evidence of the accused", counsel: [DV, AN, SP], filedOn: "2026-01-19" },
  { id: "c-up1", st: "ST 447/2025", parties: "Thankamani P. v. Vayalar Traders", court: ON_COURT, stage: "evidence", substage: "Cross-examination", counsel: [AN, SP], filedOn: "2025-03-24" },
  { id: "c-up2", st: "ST 918/2026", parties: "Basheer K. v. Malabar Gold Mart", court: JMFC1, stage: "appearance", counsel: [RM, AN], filedOn: "2026-03-05" },
  { id: "c-up3", st: "ST 122/2026", parties: "Susheela Devi v. Anand Cements", court: ON_COURT, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN, DV, RI], filedOn: "2026-01-12" },
  { id: "c-up4", st: "ST 736/2025", parties: "Ibrahim Kutty v. Sagara Fisheries", court: CJM, stage: "arguments", counsel: [DV, AN], filedOn: "2025-05-20" },
  { id: "c-up5", st: "ST 65/2026", parties: "Remani Amma v. Kuttan Pillai", court: ON_COURT, stage: "appearance", substage: "Plea", counsel: [AN, SP, RI], filedOn: "2026-01-09" },
  { id: "c-up6", st: "ST 1281/2026", parties: "Nazeer M. v. Kerala Spice Board", court: JMFC1, stage: "evidence", substage: "Cross-examination", counsel: [AN, RM, SP], filedOn: "2026-04-14" },
  { id: "c-up7", st: "ST 503/2025", parties: "Ammini George v. Padma Textiles", court: JMFC2, stage: "evidence", substage: "Evidence of the complainant", counsel: [AN, DV], filedOn: "2025-04-02" },
  { id: "c-up8", st: "ST 194/2026", parties: "Devassy Joseph v. Anchor Marine", court: ON_COURT, stage: "appearance", counsel: [RM, AN], filedOn: "2026-02-11" },
  { id: "c-up9", st: "ST 872/2025", parties: "Radhamani T. v. Sunlight Agro", court: ON_COURT, stage: "evidence", substage: "Evidence of the accused", counsel: [AN, DV, SP], filedOn: "2025-06-18" },
  { id: "c-up10", st: "ST 331/2026", parties: "Ouseph Varkey v. Nilgiri Rubbers", court: CJM, stage: "arguments", counsel: [AN, RI], filedOn: "2026-02-27" },
] as TwSeed[]).map(tw);

export const CASES: CaseRecord[] = [...FIXTURE_CASES, ...TASKS_WORLD_CASES];
