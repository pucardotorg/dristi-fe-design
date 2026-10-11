import type { Ball, Filing } from "@/lib/employee/scrutiny/types";

/**
 * The scrutiny queue.
 *
 * Segmented by who holds the ball, because only one half of the list is the officer's
 * work. A clean resubmission does NOT bypass the officer: every refiling returns to
 * them, and they are the one who sends it to the judge — so there is no auto-register
 * state anywhere in this data.
 *
 * Fixture data, standing in for the registry service. It is the only thing here that a
 * real API replaces; the selectors in `queue.ts` and the screens above them are written
 * against the types, not against these rows.
 */
export const QUEUE: Filing[] = [
  {
    no: "F/AHM/2026/00341",
    parties: "Prateek Agrawal v. Deepak Choudhary",
    type: "S.138 NI Act",
    stage: "Under scrutiny",
    ball: "registry",
    reason: "1 item open",
    advocate: "Adv. Bijini Rejen",
    who: "Biju B",
    days: 2,
    self: true,
  },
  {
    no: "F/AHM/2026/00338",
    parties: "Meena Shah v. Kiran Patel",
    type: "S.138 NI Act",
    stage: "Awaiting re-scrutiny",
    ball: "registry",
    reason: "All items answered",
    advocate: "Adv. R. Mehta",
    who: "—",
    days: 1,
  },
  {
    no: "F/AHM/2026/00327",
    parties: "Sunil Trivedi v. Anand Motors",
    type: "S25 of PSA",
    stage: "Awaiting scrutiny",
    ball: "registry",
    reason: "Low AI confidence",
    advocate: "Adv. P. Joshi",
    who: "—",
    days: 9,
  },
  {
    no: "F/AHM/2026/00319",
    parties: "Nirmala Ben v. Girish Thakkar",
    type: "S.138 NI Act",
    stage: "Awaiting scrutiny",
    ball: "registry",
    reason: "Filer skipped an AI warning",
    advocate: "Adv. S. Dave",
    who: "—",
    days: 16,
  },
  {
    no: "F/AHM/2026/00344",
    parties: "Alkesh Rana v. Vishal Enterprises",
    type: "S.138 NI Act",
    stage: "Awaiting scrutiny",
    ball: "registry",
    reason: "Random check",
    advocate: "Adv. K. Nair",
    who: "—",
    days: 1,
  },
  {
    no: "F/AHM/2026/00335",
    parties: "Hetal Modi v. Jayesh Solanki",
    type: "S.138 NI Act",
    stage: "Under scrutiny",
    ball: "registry",
    reason: "Not AI-reviewed",
    advocate: "Adv. T. Bhatt",
    who: "Ramesh Iyer",
    days: 4,
  },
  {
    no: "F/AHM/2026/00311",
    parties: "Dinesh Raval v. Falgun Traders",
    type: "S.138 NI Act",
    stage: "Sent back",
    ball: "advocate",
    reason: "3 items open",
    advocate: "Adv. Bijini Rejen",
    who: "—",
    days: 23,
  },
  {
    no: "F/AHM/2026/00302",
    parties: "Kavita Sharma v. Rakesh Doshi",
    type: "S25 of PSA",
    stage: "Sent back",
    ball: "advocate",
    reason: "1 item open",
    advocate: "Adv. M. Qureshi",
    who: "—",
    days: 12,
  },
  {
    no: "F/AHM/2026/00298",
    parties: "Bhavna Desai v. Umesh Parmar",
    type: "S.138 NI Act",
    stage: "Sent back",
    ball: "advocate",
    reason: "2 items open",
    advocate: "Adv. P. Joshi",
    who: "—",
    days: 5,
  },
  {
    no: "F/AHM/2026/00276",
    parties: "Ashok Vyas v. Nilesh Chauhan",
    type: "S.138 NI Act",
    stage: "Registered",
    ball: "closed",
    reason: "CC/2026/00812",
    advocate: "Adv. S. Dave",
    who: "Biju B",
    days: 31,
  },
  {
    no: "F/AHM/2026/00265",
    parties: "Ila Pandya v. Mahendra Shah",
    type: "S.138 NI Act",
    stage: "Withdrawn",
    ball: "closed",
    reason: "—",
    advocate: "Adv. K. Nair",
    who: "—",
    days: 38,
  },
];

export const QUEUE_TABS: { id: Ball; label: string }[] = [
  { id: "registry", label: "With registry" },
  { id: "advocate", label: "With advocate" },
  { id: "closed", label: "Closed" },
];

/**
 * The signed-in officer.
 *
 * Stands in for the session until `/employee/login` authenticates for real; the rail's
 * footer and the queue's "Me" filter both read it from here, so there is one place to
 * change when it does.
 */
export const OFFICER = {
  name: "Biju B",
  role: "Scrutiny officer",
  initials: "BB",
  court: "Ahmedabad, Gujarat",
};
