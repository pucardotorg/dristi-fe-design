import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarIcon,
  CalendarXIcon,
  CopyIcon,
  EllipsisIcon,
  FileCheckIcon,
  FileClockIcon,
  FilePenIcon,
  FilePlusIcon,
  FileSearchIcon,
  FolderIcon,
  HourglassIcon,
  LayoutDashboardIcon,
  InboxIcon,
  ListChecksIcon,
  MessageSquareIcon,
  NotebookPenIcon,
  PaperclipIcon,
  RefreshCwIcon,
  ScanIcon,
  SendIcon,
  SettingsIcon,
  SignatureIcon,
  StampIcon,
  TableIcon,
  UserCheckIcon,
  UserPenIcon,
  type LucideIcon,
} from "lucide-react";

import { APPROVE_COPY_QUEUE_COUNT } from "./approve-copy-application";
import {
  COGNIZANCE_QUEUE_COUNT,
  cognizanceCaseById,
  cognizanceTabCount,
} from "./cognizance";
import { type CognizanceLayout, readCognizanceLayout } from "./cognizance-layout";
import { DELAY_CONDONATION_QUEUE_COUNT } from "./delay-condonation";
import { hearingById, TODAYS_HEARING_COUNT } from "./hearings";
import type { CourtNavLayout } from "./nav-layout";
import { findCaseRecord } from "../cases/party-cases";
import type { CourtId } from "../court/profiles";
import { scrutinyRegistersIn } from "./court-role";
import { OTHER_APPLICATIONS_QUEUE_COUNT } from "./other-applications";
import {
  APPROVE_REGISTRATIONS_TITLE,
  REGISTRATIONS_QUEUE_COUNT,
} from "./approve-registrations";
import { registerCaseById, REGISTER_QUEUE_COUNT } from "./register-cases";
import { readPendingOrders } from "./pending-orders";
import { registerById, registerCrumb, REGISTERS_PAGE } from "./registers";
import { findFiling, SCRUTINY_QUEUE_COUNT } from "./scrutiny/queue";
import { RESCHEDULING_QUEUE_COUNT } from "./rescheduling-request";
import { SCHEDULING_QUEUE_COUNT } from "./schedule";
import { A_DIARY_PENDING_COUNT } from "./sign-a-diary";
import { SIGN_BAIL_BOND_QUEUE_COUNT } from "./sign-bail-bonds";
import { SIGN_EVIDENCE_QUEUE_COUNT } from "./sign-evidence";
import { SIGN_FORM_QUEUE_COUNT } from "./sign-forms";
import { SIGN_ORDER_PENDING_COUNT } from "./sign-orders";
import { PROCESS_QUEUE_COUNT } from "./sign-process";
import { WITNESS_DEPOSITION_QUEUE_COUNT } from "./sign-witness-deposition";
import type { CourtRole } from "./content";

/**
 * What the bench navigates between, as data.
 *
 * The shape of the court-side rail — two standalone links, then four groups of work —
 * is transcribed from the magistrate's reference screens. It is deliberately data and
 * not markup: the rail renders whatever is here, so a row's destination, its count or
 * its position is a change to this file rather than to a component.
 *
 * **Most of it is not wired yet.** The three Hearings rows, all five Actions rows —
 * Scrutinise submitted cases, Register cases, Take cognizance, Approve copy application
 * and Register advocates — all three Review applications rows —
 * Rescheduling request, Delay condonation and Others — and all seven of the Sign rows —
 * Sign forms, Sign orders, Sign process, Sign bail bonds, Sign witness deposition, Sign
 * evidence and Sign A-Diary — have an `href`, and they point at the court-side routes
 * that exist. Every other row is a real, focusable control that says plainly it goes
 * nowhere — no stub routes, no hrefs that 404. Giving a row its destination later is the
 * one `href` line below.
 *
 * **The counts are demo data, with a few exceptions.** They are the reference's numbers,
 * kept so the rail can be judged at the widths it will really see (`1312` is the one that
 * decides how a row truncates). None of these labels describes an action this build
 * performs. The exceptions are the built rows whose counts are derived from the lists
 * they lead to (`lib/employee/hearings.ts`, `lib/employee/schedule.ts`,
 * `lib/employee/register-cases.ts`, `lib/employee/cognizance.ts`,
 * `lib/employee/approve-copy-application.ts`,
 * `lib/employee/approve-registrations.ts`,
 * `lib/employee/rescheduling-request.ts`,
 * `lib/employee/delay-condonation.ts`, `lib/employee/other-applications.ts`,
 * `lib/employee/sign-forms.ts`, `lib/employee/sign-orders.ts`,
 * `lib/employee/sign-process.ts`, `lib/employee/sign-bail-bonds.ts`,
 * `lib/employee/sign-witness-deposition.ts`, `lib/employee/sign-evidence.ts`,
 * `lib/employee/sign-a-diary.ts`) — still demo data
 * underneath, but a real count of it, so the rail cannot claim a different number from
 * the screen it opens. Sign orders counts only what is still pending, because that
 * screen also holds the orders this bench has signed; Sign process counts only the three
 * stages of its line that still need an act, for the same reason.
 *
 * The vocabulary is the court's, taken from the reference — a copy application, a delay
 * condonation, the A-Diary. `docs/product/` does not yet define these for §138, so this
 * module names them and claims nothing more about what they do.
 */

export type CourtNavItem = {
  id: string;
  /** Sentence case, per the DS Laws — the reference's Title Case does not survive them. */
  label: string;
  /**
   * Where the row goes. Absent means the destination is not built: the row still renders
   * and still takes focus, and says so rather than pretending. Wiring it is this line.
   */
  href?: string;
  /**
   * A leading mark. **Every row carries one** (owner, 2026-09-18).
   *
   * It used to be the two standalone links alone, on the argument that marking a group's
   * rows would flatten its header back into the list. That argument was sound while the
   * header was a 40px disclosure control wearing a glyph of its own; it is not sound now.
   * The header is a quiet caption label (`SidebarGroupLabel`) with no mark, so nothing is
   * left for a row's glyph to compete with — and eighteen same-size labels in one column
   * had to be *read* rather than scanned, which was the owner's complaint.
   *
   * It also makes the folded 4rem strip worth having: it used to show six squares, none
   * of which was a queue you could reach.
   *
   * **Five of these are not on the DS icon allowlist** (`{DS}/src/lib/icons.ts`, 146
   * names mirroring the Figma Icons page): `calendar-clock`, `file-pen`, `user-pen`,
   * `notebook-pen` here, and `folder-search` in `court-cases-screen.tsx`. The owner's own
   * picks, kept deliberately with an upstream request to add them — the allowlist's
   * nearest substitutes are less precise, and two of them collide with each other at
   * 20px (`pen-line` for Sign orders against `pencil` for the A-Diary). Every other mark
   * below is on the allowlist. Owner's call, 2026-09-23.
   */
  icon?: LucideIcon;
  /** The destination lives outside DRISTI. Spoken, not marked — see `RowContents`. */
  external?: boolean;
  /** How much of this kind of work is waiting on the bench. Demo data; see above. */
  count?: number;
  /**
   * Rows of their own under this one — today, only `cognizance-layout.ts`'s "split"
   * setting gives any row these (`courtNavGroupsFor`). Generic rather than named after
   * that one case, so a future row that wants the same shape does not need a second
   * mechanism.
   */
  children?: CourtNavItem[];
};

export type CourtNavGroup = {
  id: string;
  label: string;
  /**
   * The section's mark, beside its label in the disclosure header.
   *
   * An addition to the reference, which left the headers bare — asked for so the four
   * kinds of work are findable without reading.
   *
   * **It is the disclosure header's mark, and only the disclosure layouts have one.**
   * `"grouped"` renders this beside the section label; `"open"` does not — there the
   * label is a quiet caption and every row below it carries its own glyph, so a header
   * mark would read as a nineteenth row. See `CourtNavItem.icon`.
   */
  icon: LucideIcon;
  items: CourtNavItem[];
};

/**
 * The dashboard — this court's health check.
 *
 * It replaces `COURT_HOME`, which was an empty placeholder nothing linked to: it was not
 * a rail row and could not be one, so the top bar's trail was the only path to it, and
 * the trail no longer has a root (see `courtTrail`). The screen and the rail row both
 * take their label from here, so a row and the screen it opens cannot end up calling one
 * destination two things.
 *
 * **It is not where signing in lands.** The day's cause list is (`court-sign-in-block`),
 * on the owner's call that a dashboard is not the common thing court staff open the
 * product to see.
 */
export const COURT_DASHBOARD = { href: "/employee", label: "Dashboard" } as const;

/**
 * The register — every case on this court's file, searchable.
 *
 * **A separate screen from the dashboard, on the owner's second look** (2026-09-14).
 * The two were briefly one: the priority tiles filtered a register below them, which was
 * the owner's own first suggestion and which they rejected once built — *"the dashboard
 * is more of a health check, that is the intent of a dashboard, and it should look like
 * one; by mixing these two we are complicating things for ourselves."* Which is right.
 * A health check answers "how is this court doing"; a register answers "where is that
 * file". One screen answering both had to compromise on the form of each.
 *
 * The two are still joined, by a link rather than by a filter: a dashboard tile opens
 * this screen already narrowed to its category (`?priority=`). Navigation is also the
 * strongest feedback a press can give — the whole screen changes — which is the problem
 * the filtering version never solved.
 */
export const COURT_CASES_PAGE = {
  href: "/employee/cases",
  label: "All cases",
} as const;

/**
 * The rows that stand on their own, above the grouped work.
 *
 * Dashboard and All cases were transcribed from the reference as `Dashboards` and
 * `All cases`, both then marked `external`; both are built now and both are internal —
 * see `COURT_DASHBOARD` and `COURT_CASES_PAGE` above.
 *
 * **Configurations is no longer one of them** — see `COURT_NAV_TRAILING` below.
 *
 * **None carries a count.** Every other number in this rail is work waiting on the
 * bench, and the rail prints them in the destructive red its badge is painted in. Forty
 * cases on the file is not a backlog — a red 40 beside "All cases" reads as forty
 * problems — so these rows stay bare and each screen's own line says its number.
 */
export const COURT_NAV_LINKS: CourtNavItem[] = [
  {
    id: "dashboard",
    label: COURT_DASHBOARD.label,
    href: COURT_DASHBOARD.href,
    icon: LayoutDashboardIcon,
  },
  {
    id: "all-cases",
    label: COURT_CASES_PAGE.label,
    href: COURT_CASES_PAGE.href,
    icon: FolderIcon,
  },
  /* The court's registers (note, section B). A noun, beside the other two places to look
     at this court — kept apart from "Register cases", the Actions queue that registers a
     complaint, by its wording, its mark and its place in the rail. */
  {
    id: "registers",
    label: REGISTERS_PAGE.label,
    href: REGISTERS_PAGE.href,
    icon: TableIcon,
  },
];

/**
 * The rows that close the rail, under every layout (owner, 2026-09-23).
 *
 * Configurations opens the order-template configuration screen for the magistrate. It
 * sat at the head of `COURT_NAV_LINKS`, above Dashboard, and it is the one row in this
 * rail that is not a destination the bench works *in*: everything above it is either a
 * place to look at this court or a queue with work waiting, and a settings-shaped screen
 * read as the first of those by sitting first. Last is where it belongs, for the same
 * reason the person and the seat sit at the foot rather than the top.
 *
 * It is a list of its own rather than a flag on the item, because the rail renders the
 * leading links, then whatever the layout puts in the middle, then this — and a layout
 * must not be able to lose it by choosing a different middle.
 */
export const COURT_NAV_TRAILING: CourtNavItem[] = [
  /* Scheduling and bulk rescheduling, at the foot of the rail above Configurations
     (owner, 2026-10-14): the bench reaches for them less often than the day's work. */
  {
    id: "schedule-hearing",
    label: "Schedule hearing",
    icon: CalendarIcon,
    href: "/employee/hearings/schedule",
    count: SCHEDULING_QUEUE_COUNT,
  },
  {
    id: "bulk-reschedule",
    label: "Bulk reschedule hearings",
    icon: RefreshCwIcon,
    href: "/employee/hearings/bulk-reschedule",
  },
  {
    id: "configurations",
    label: "Configurations",
    icon: SettingsIcon,
    href: "/employee/configurations",
  },
];

/** The bench's work, in the four groups the reference names. The rail opens one. */
export const COURT_NAV_GROUPS: CourtNavGroup[] = [
  {
    id: "hearings",
    label: "Hearings",
    icon: CalendarDaysIcon,
    items: [
      /* The built destinations on the court side. Where a row carries a count it is one
         of the only numbers in this rail that is not demo data: it is the length of the
         list behind it, so the rail and the screen cannot disagree about the size of the
         work. Bulk reschedule carries none — what it opens on is a range the bench
         chooses, not a queue with a size. */
      {
        id: "todays-hearings",
        label: "Today’s hearings",
        icon: CalendarClockIcon,
        href: "/employee/hearings",
        count: TODAYS_HEARING_COUNT,
      },
      /* Every order not yet through — being typed, waiting for a signature, or signed
         with its workflows still to trigger — for the magistrate and the steno alike, so
         each sees where the other's step stands (owner, 2026-10-14). It replaces the
         Orders toggle on Today's hearings and the steno's workflow queue. No count: the
         orders live in this browser, so the rail cannot know the number before the
         screen loads. */
      {
        id: "pending-orders",
        label: "Pending orders",
        icon: FileClockIcon,
        href: "/employee/pending-orders",
      },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    icon: ListChecksIcon,
    items: [
      /* Scrutiny comes first because it comes first: a complaint an advocate files
         lands here, and only what survives scrutiny reaches the register below it.
         The row's count is the registry's own half of the queue — see
         `lib/employee/scrutiny/queue.ts`. */
      {
        id: "scrutiny",
        label: "Scrutinise submitted cases",
        icon: ScanIcon,
        href: "/employee/scrutiny",
        count: SCRUTINY_QUEUE_COUNT,
      },
      {
        id: "register-cases",
        label: "Register cases",
        icon: FilePlusIcon,
        href: "/employee/register-cases",
        count: REGISTER_QUEUE_COUNT,
      },
      /* Straight after the register, because that is the order a complaint meets them:
         the registry numbers it, and hours later the magistrate decides whether the case
         goes ahead. Registering is not taking cognizance — it puts the complaint on the
         register and nothing more, and this row is the act that follows.

         One row by default, not two. The reference split this queue into *With Delay*
         and *Without delay* as two counted children opening two screens that differed
         by three lines; the PRD (v6, §2) keeps the split — it decides which positive
         action the bench is offered — but keeps it inside the screen, as two tabs.
         That stands as the default. `cognizance-layout.ts` now also lets the bench
         choose the reference's own shape instead — two rows of their own, each its own
         screen (`/employee/cognizance/without-delay`, `/employee/cognizance/with-delay`)
         — as a preference rather than a replacement, from Court settings (owner,
         2026-09-26). `courtNavGroupsFor` attaches the two as this row's `children` only
         when that setting is live; see it and `isCourtNavGroupActive`/`courtTrail`
         below for how a child is matched and traced the same way a nested case record
         is. */
      {
        id: "cognizance",
        label: "Take cognizance",
        icon: StampIcon,
        href: "/employee/cognizance",
        count: COGNIZANCE_QUEUE_COUNT,
      },
      {
        id: "approve-copy",
        label: "Approve copy application",
        icon: CopyIcon,
        href: "/employee/approve-copy-application",
        count: APPROVE_COPY_QUEUE_COUNT,
      },
      /* Last in the group, and deliberately so. The three rows above it are a complaint's
         own progression — scrutiny, then the register, then what the office does for a
         party afterwards. An advocate's registration is not part of any case's life at
         all, so putting it at the head would break that reading for the three rows that
         share the group with it. */
      {
        id: "approve-registrations",
        label: APPROVE_REGISTRATIONS_TITLE,
        icon: UserCheckIcon,
        href: "/employee/approve-registrations",
        count: REGISTRATIONS_QUEUE_COUNT,
      },
    ],
  },
  {
    id: "review-applications",
    label: "Review applications",
    icon: FileSearchIcon,
    items: [
      /* First, and without a count: the lifecycle's own queue — onboarding and the order
         on each, one item since 2026-10-07 — read from the applications store in the
         browser, so the rail cannot know the number before the screen loads. The three
         fixture queues below predate it. */
      {
        id: "applications",
        label: "Applications",
        icon: InboxIcon,
        href: "/employee/applications",
      },
      {
        id: "rescheduling-request",
        label: "Rescheduling request",
        icon: CalendarXIcon,
        href: "/employee/rescheduling-request",
        count: RESCHEDULING_QUEUE_COUNT,
      },
      {
        id: "delay-condonation",
        label: "Delay condonation",
        icon: HourglassIcon,
        href: "/employee/delay-condonation",
        count: DELAY_CONDONATION_QUEUE_COUNT,
      },
      {
        id: "other-applications",
        label: "Others",
        icon: EllipsisIcon,
        href: "/employee/other-applications",
        count: OTHER_APPLICATIONS_QUEUE_COUNT,
      },
    ],
  },
  {
    id: "sign",
    label: "Sign",
    icon: SignatureIcon,
    items: [
      {
        id: "sign-forms",
        label: "Sign forms",
        icon: FileCheckIcon,
        href: "/employee/sign-forms",
        count: SIGN_FORM_QUEUE_COUNT,
      },
      {
        id: "sign-orders",
        label: "Sign orders",
        icon: FilePenIcon,
        href: "/employee/sign-orders",
        /* The pending rows, not the whole queue: the screen also holds the orders
           this bench has already signed, and a badge that counted those would send
           the magistrate to less work than the number promised. */
        count: SIGN_ORDER_PENDING_COUNT,
      },
      {
        id: "sign-process",
        label: "Sign process",
        icon: SendIcon,
        href: "/employee/sign-process",
        /* The three stages of the line that still need an act, not its whole length:
           that screen also holds what has been sent and what has come back, and a badge
           counting those would send the bench to less work than the number promised. */
        count: PROCESS_QUEUE_COUNT,
      },
      {
        id: "sign-bail-bonds",
        label: "Sign bail bonds",
        icon: UserPenIcon,
        href: "/employee/sign-bail-bonds",
        count: SIGN_BAIL_BOND_QUEUE_COUNT,
      },
      {
        id: "sign-deposition",
        label: "Sign witness deposition",
        icon: MessageSquareIcon,
        href: "/employee/sign-witness-deposition",
        count: WITNESS_DEPOSITION_QUEUE_COUNT,
      },
      {
        id: "sign-evidence",
        label: "Sign evidence",
        icon: PaperclipIcon,
        href: "/employee/sign-evidence",
        count: SIGN_EVIDENCE_QUEUE_COUNT,
      },
      {
        // The A-Diary is the court's own register — a proper name, so it keeps its case.
        id: "sign-a-diary",
        label: "Sign A-Diary",
        icon: NotebookPenIcon,
        href: "/employee/sign-a-diary",
        /* Days waiting to be signed, not entries: a day is what gets signed, and only
           once it is over (`a-diary.md` `ADY-12`, `ADY-12b`). The page's own count line
           agrees with this number. */
        count: A_DIARY_PENDING_COUNT,
      },
    ],
  },
];

/** The two rows `cognizance-layout.ts`'s "split" setting gives Take cognizance. */
function cognizanceChildren(): CourtNavItem[] {
  return [
    {
      id: "cognizance-without-delay",
      label: "Without delay",
      href: "/employee/cognizance/without-delay",
      count: cognizanceTabCount("without-delay"),
    },
    {
      id: "cognizance-with-delay",
      label: "With delay",
      href: "/employee/cognizance/with-delay",
      count: cognizanceTabCount("with-delay"),
    },
  ];
}

/**
 * The rows a seat sees, by id, where a seat sees fewer than all of them (owner,
 * 2026-10-08: the scrutiny officer keeps Dashboard, Scrutinise submitted cases, Approve
 * registrations and Configurations). A seat with no entry sees every row.
 *
 * **A view rule, not a permission** — the same footing as `seatHasBenchControls`. The
 * other screens stay reachable by URL; this decides what the rail offers.
 */
const SEAT_ROWS: Partial<Record<CourtRole, ReadonlySet<string>>> = {
  "scrutiny-officer": new Set(["dashboard", "scrutiny", "approve-registrations", "configurations"]),
};

/**
 * Rows hidden from a seat that otherwise sees everything (owner, 2026-10-13: the
 * magistrate and the bench clerk — Punjab & Haryana's Reader — do not see Scrutinise
 * submitted cases, Approve copy application or Approve registrations).
 *
 * Hidden, not removed: the queues and their screens are untouched and still open by URL,
 * and the scrutiny officer's rail still carries the two that are theirs. Unlike
 * `SEAT_ROWS` this does not narrow the rail, so the saved layout still applies.
 */
const HIDDEN_FROM_BENCH: ReadonlySet<string> = new Set([
  "scrutiny",
  "approve-copy",
  "approve-registrations",
]);
/**
 * What the steno does not see (owner, 2026-10-14): the registry's queues, three of the
 * review queues, and every Sign row — signing is the bench's act, not the steno's.
 */
const HIDDEN_FROM_STENO: ReadonlySet<string> = new Set([
  "scrutiny",
  "cognizance",
  "approve-copy",
  "approve-registrations",
  "rescheduling-request",
  "delay-condonation",
  "other-applications",
  "sign-forms",
  "sign-orders",
  "sign-process",
  "sign-bail-bonds",
  "sign-deposition",
  "sign-evidence",
  "sign-a-diary",
]);
const SEAT_HIDDEN_ROWS: Partial<Record<CourtRole, ReadonlySet<string>>> = {
  magistrate: HIDDEN_FROM_BENCH,
  "bench-clerk": HIDDEN_FROM_BENCH,
  typist: HIDDEN_FROM_STENO,
};

/** Whether this seat is offered this row — the one test every seat filter below shares. */
export function seatHasNavRow(
  role: CourtRole,
  id: string,
): boolean {
  /* Pending orders is where the magistrate signs (owner, 2026-10-14). */
  if (role === "magistrate" && id === "sign-orders") return false;
  const keep = SEAT_ROWS[role];
  if (keep && !keep.has(id)) return false;
  return !SEAT_HIDDEN_ROWS[role]?.has(id);
}

/** Whether this seat's rail is cut down to a named set of rows. */
export function seatHasNarrowRail(role: CourtRole): boolean {
  return SEAT_ROWS[role] !== undefined;
}

/** A list of rows, less the ones this seat does not see. */
export function courtNavItemsForSeat(
  items: CourtNavItem[],
  role: CourtRole,
): CourtNavItem[] {
  return items.filter((item) => seatHasNavRow(role, item.id));
}

/** Groups, less the rows this seat does not see — and less any group left empty. */
export function courtNavGroupsForSeat(
  groups: CourtNavGroup[],
  role: CourtRole,
): CourtNavGroup[] {
  return groups
    .map((group) => ({ ...group, items: courtNavItemsForSeat(group.items, role) }))
    .filter((group) => group.items.length > 0);
}

/**
 * Whether a deployment has this row at all. Where the Scrutiny officer also holds Case
 * registerer (`scrutinyRegistersIn`), they register the case and it goes straight to Take
 * cognizance, so nothing is forwarded and there is no Register cases queue (`SCR-11`).
 *
 * Unlike the seat rule above, this is not a view of something that exists: the queue is
 * not there in that state, so every list of rows drops it — the rail, the combined
 * screens, the dashboard and search.
 */
export function courtHasNavRow(court: CourtId, id: string): boolean {
  return !(id === "register-cases" && scrutinyRegistersIn(court));
}

/** A list of rows, less the ones this deployment does not have. */
export function courtNavItemsForCourt(items: CourtNavItem[], court: CourtId): CourtNavItem[] {
  return items.filter((item) => courtHasNavRow(court, item.id));
}

/** Groups, less the rows this deployment does not have — and less any group left empty. */
export function courtNavGroupsForCourt(groups: CourtNavGroup[], court: CourtId): CourtNavGroup[] {
  return groups
    .map((group) => ({ ...group, items: courtNavItemsForCourt(group.items, court) }))
    .filter((group) => group.items.length > 0);
}

/**
 * `COURT_NAV_GROUPS`, with Take cognizance's two rows attached when the "split" setting
 * is live. Read fresh rather than cached: the setting can change without a reload, and
 * the counts are the queue's own and can move with it. Every other row and group is
 * returned exactly as `COURT_NAV_GROUPS` holds it — `"tabs"` returns that same array,
 * unchanged and uncopied.
 */
export function courtNavGroupsFor(
  cognizanceLayout: CognizanceLayout,
): CourtNavGroup[] {
  const groups = COURT_NAV_GROUPS;
  if (cognizanceLayout !== "split") return groups;
  return groups.map((group) =>
    group.id !== "actions"
      ? group
      : {
          ...group,
          items: group.items.map((item) =>
            item.id !== "cognizance"
              ? item
              : { ...item, children: cognizanceChildren() },
          ),
        },
  );
}

/**
 * The rows each combined layout keeps standing apart from its one folded row, leading
 * it or trailing it — the owner's two passes, 2026-09-21. `"actions"` keeps hearings a
 * tab of its own next to actions, the way `COURT_NAV_GROUPS` already keeps Hearings a
 * group of its own; `"schedule"` folds hearings in with everything else instead and
 * gives them a prominent block inside that one screen (`TodaysScheduleScreen`), not a
 * row of their own. Both keep Bulk reschedule hearings and Sign process apart either
 * way — a hearing put off to a range the bench chooses is not a due item, and a process
 * line has its own three-stage count already (`sign-process`'s own count comment).
 */
const COURT_NAV_KEPT_APART: Record<
  CombinedCourtNavLayout,
  { leading: string[]; trailing: string[] }
> = {
  actions: {
    leading: ["todays-hearings", "pending-orders"],
    trailing: ["sign-process"],
  },
  /* Today's hearings fold into the combined row here, so Pending orders follows it. */
  schedule: { leading: [], trailing: ["pending-orders", "sign-process"] },
};

/**
 * Every group's rows the deployment has, in the rail's own order — the one pass every
 * function below shares. Given a seat, less the rows that seat is not offered.
 */
function courtNavAllItems(
  court: CourtId,
  role?: CourtRole,
): CourtNavItem[] {
  const items = courtNavItemsForCourt(
    COURT_NAV_GROUPS.flatMap((group) => group.items),
    court,
  );
  return role ? courtNavItemsForSeat(items, role) : items;
}

/** The rows named by a list of ids, in the order the ids were given — not the source's. */
function courtNavItemsByIds(
  ids: string[],
  court: CourtId,
  role?: CourtRole,
): CourtNavItem[] {
  const all = courtNavAllItems(court, role);
  return ids
    .map((id) => all.find((item) => item.id === id))
    .filter((item): item is CourtNavItem => item !== undefined);
}

/**
 * The rows a layout keeps standing on their own, leading rows before trailing rows —
 * `"actions"`: Today's hearings, then Bulk reschedule hearings, then Sign process.
 * `"schedule"`: Bulk reschedule hearings, then Sign process.
 */
export function courtNavKeptApart(
  layout: CombinedCourtNavLayout,
  court: CourtId,
  role?: CourtRole,
): CourtNavItem[] {
  const spec = COURT_NAV_KEPT_APART[layout];
  return courtNavItemsByIds([...spec.leading, ...spec.trailing], court, role);
}

/**
 * Everything a layout folds into its one row — every `COURT_NAV_GROUPS` item except
 * what that layout keeps apart, still in the source's own order.
 */
export function courtNavClubbed(
  layout: CombinedCourtNavLayout,
  court: CourtId,
  role?: CourtRole,
): CourtNavItem[] {
  const apart = new Set(
    courtNavKeptApart(layout, court, undefined).map((item) => item.id),
  );
  return courtNavAllItems(court, role).filter((item) => !apart.has(item.id));
}

/** The combined row's own count — every clubbed item's, summed, never restated by hand. */
export function courtNavClubbedTotal(
  layout: CombinedCourtNavLayout,
  court: CourtId,
  role?: CourtRole,
): number {
  return courtNavClubbed(layout, court, role).reduce(
    (total, item) => total + (item.count ?? 0),
    0,
  );
}

/** A layout that folds work into one row, rather than the rail's default four groups. */
type CombinedCourtNavLayout = Exclude<CourtNavLayout, "grouped" | "open">;

/** The one row `"actions"` and `"schedule"` differ on — same destination shape, two names. */
const COURT_NAV_COMBINED_ROW: Record<CombinedCourtNavLayout, CourtNavItem> = {
  actions: {
    id: "todays-actions",
    label: "Today’s actions",
    href: "/employee/todays-actions",
  },
  schedule: {
    id: "todays-schedule",
    label: "Today’s schedule",
    href: "/employee/todays-schedule",
  },
};

/**
 * The rail's rows under a combined layout: the leading kept-apart rows, then the one
 * row everything else folds into (its count derived rather than restated), then the
 * trailing kept-apart rows. `"grouped"` has no use for this — it renders
 * `COURT_NAV_LINKS` and `COURT_NAV_GROUPS` as it always has.
 */
export function courtNavRowsFor(
  layout: CombinedCourtNavLayout,
  court: CourtId,
  role?: CourtRole,
): CourtNavItem[] {
  const spec = COURT_NAV_KEPT_APART[layout];
  /* A promoted row keeps the mark it already carries in its group. It used to be given a
     different one here, because a group's rows were bare and a standalone row could not
     be — now that every row is marked, overriding would draw one destination two ways
     depending on which layout the rail is in. */
  const combined: CourtNavItem = {
    ...COURT_NAV_COMBINED_ROW[layout],
    icon: CalendarDaysIcon,
    count: courtNavClubbedTotal(layout, court, role),
  };
  return [
    ...courtNavItemsByIds(spec.leading, court, role),
    combined,
    ...courtNavItemsByIds(spec.trailing, court, role),
  ];
}

/**
 * Whether a row is the one `courtNavRowsFor` builds rather than one it passed through —
 * the row whose active state has to ask `isCourtNavCombinedActive` about the
 * destinations folded into it, instead of matching its own href the ordinary way.
 */
export function isCourtNavCombinedRow(item: CourtNavItem): boolean {
  return (
    item.id === COURT_NAV_COMBINED_ROW.actions.id ||
    item.id === COURT_NAV_COMBINED_ROW.schedule.id
  );
}

/**
 * The queues that own routes nested under them, and how each one tells a real child
 * from a sibling that merely looks like one.
 *
 * Today's hearings owns a listing's case overview (`/employee/hearings/<id>`) and the
 * order composer under it (`/employee/hearings/<id>/order`). Scrutiny owns one filing's
 * workbench (`/employee/scrutiny/<filing no.>`). Register cases owns one waiting
 * complaint's file (`/employee/register-cases/<id>`). None of them is a new destination
 * — each is its queue seen closer up.
 *
 * The nested segment is resolved against the queue's own data rather than matched as a
 * bare `[^/]+`, which would steal `/employee/hearings/schedule` and
 * `/employee/hearings/bulk-reschedule` — siblings, not children. Asking the queue is
 * the one test that cannot go stale on the next route: a sibling added tomorrow will
 * not be a listing id or a complaint id either, so it will not be captured either, and
 * nobody has to remember to add it to a list of exceptions here. An id no queue holds
 * gets no section, which is the truth about it and the same answer the screens behind
 * these routes give.
 *
 * It sits with the data rather than in the rail because the rail is no longer the only
 * thing that asks. The top bar's trail works out which section it is standing in from
 * the same answer, and two implementations of "which row is this page" would eventually
 * disagree — about these routes first, since they are the ones whose answer is not
 * simply their own href.
 */
/**
 * What the scrutiny queue calls the filing a path names, or nothing.
 *
 * A filing number carries slashes (`F/AHM/2026/00341`), so the segment is percent-encoded
 * in the path and has to be decoded before the queue is asked about it. Every other
 * nested segment is an id that survives a path intact, which is why this is the one row
 * below that names a function rather than asking its queue in a line.
 */
function scrutinyFilingNumber(segment: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // A malformed escape is not a filing number.
    return undefined;
  }
  return findFiling(decoded)?.no;
}

/**
 * `identify` answers both questions this file asks about a nested segment, and it has to
 * be one function to answer them consistently: *is this a real child of that queue* (the
 * rail's active row) and *what is the record called* (the last crumb). Two functions
 * would eventually disagree — a route the rail lit up and the trail could not name, or
 * the reverse.
 *
 * It returns the record's **identifier**, never its cause title. The title is the page's
 * own `h1`, several sizes down and a few pixels below; a crumb repeating it would restate
 * the loudest type on the screen in the quietest, which is the defect the old
 * omit-the-page convention was written to avoid. A case number does not restate anything.
 */
/*
 * **There is no `leaf` any more** (`register-cases` brief D25). Register cases was the
 * one queue with a step *past* the record: its complaint split in two, the glance at
 * `/<id>` and the whole file at `/<id>/file`, and a trail ending at the case number on
 * both could not say which of the two a magistrate was on. The file is now a disclosure
 * of the complaint's own route rather than a second page, so there is one view again and
 * the trail ends at the case number. The field's own comment said *a leaf is added when a
 * route earns one*; the route stopped earning it, so it goes rather than sitting here
 * with nobody to answer for it.
 */
/**
 * Names a nested record the server cannot see — the applications queue reads a store that
 * lives in this browser (`lib/applications/store.ts`), so its number is known only after
 * the store has been read on the client. `EmployeeTopBar` passes one once it is ready;
 * until then, and for a record that is not found, the trail stops at the queue.
 */
export type CourtRecordResolver = (
  queue: string,
  segment: string,
) => string | undefined;

const NESTED_ROUTES: {
  queue: string;
  pattern: RegExp;
  identify: (segment: string) => string | undefined;
  /**
   * The record is read on the client, so the route is nested — and its row active —
   * whether or not `identify` or a resolver can name it yet.
   */
  clientRecord?: boolean;
  /**
   * The record has an order drawn up under it at `<record>/order`, and the record's own
   * route is a page: the order's trail goes one step past the record, `… › ST/241/2026 ›
   * Order`, and the record becomes the way back to it. The pattern's second group is the
   * `/order` segment.
   */
  order?: boolean;
  /**
   * The queue is worked as one of several lists (`?view=`), so the way back carries the
   * list the page was opened from.
   */
  keepsView?: boolean;
}[] = [
  {
    queue: "/employee/hearings",
    pattern: /^\/employee\/hearings\/([^/]+)(\/order)?\/?$/,
    identify: (id) => hearingById(id)?.caseNumber,
    order: true,
  },
  {
    queue: "/employee/scrutiny",
    pattern: /^\/employee\/scrutiny\/([^/]+)\/?$/,
    identify: scrutinyFilingNumber,
  },
  {
    queue: "/employee/register-cases",
    pattern: /^\/employee\/register-cases\/([^/]+)\/?$/,
    identify: (id) => registerCaseById(id)?.filingNumber,
  },
  /* One pending order — named by its case, as the list recorded it (any order, not only
     a hearing's). */
  {
    queue: "/employee/pending-orders",
    pattern: /^\/employee\/pending-orders\/([^/]+)\/?$/,
    identify: (segment) => {
      let key: string;
      try {
        key = decodeURIComponent(segment);
      } catch {
        return undefined;
      }
      return readPendingOrders()[key]?.caseNumber ?? hearingById(key)?.caseNumber;
    },
  },
  /* One register under the Registers index, named by its number ("Register 3"). */
  {
    queue: REGISTERS_PAGE.href,
    pattern: /^\/employee\/registers\/([^/]+)\/?$/,
    identify: (id) => {
      const register = registerById(id);
      return register ? registerCrumb(register) : undefined;
    },
  },
  {
    queue: "/employee/cognizance",
    /* The complaint, and the order one of its acts draws up — traced alike, as a
       hearing's order is (owner, 2026-10-13). */
    pattern: /^\/employee\/cognizance\/([^/]+)(\/order)?\/?$/,
    identify: (id) => cognizanceCaseById(id)?.caseNumber,
    order: true,
  },
  /* One case, in the case view the court shares with the advocate
     (`components/cases/case-detail.tsx`). A cognizance complaint first, as that route
     resolves it. */
  {
    queue: COURT_CASES_PAGE.href,
    pattern: /^\/employee\/cases\/([^/]+)\/?$/,
    identify: (id) =>
      cognizanceCaseById(id)?.caseNumber ?? findCaseRecord(id)?.caseNumber,
  },
  {
    queue: "/employee/applications",
    /* The application, and the order drawn up on it — traced alike. */
    pattern: /^\/employee\/applications\/([^/]+)(\/order)?\/?$/,
    identify: () => undefined,
    clientRecord: true,
    order: true,
    keepsView: true,
  },
];

/**
 * What this path is a nested view *of*, when it is one: `undefined` when it is not
 * nested, `{ record }` when it is — `record` itself absent while a client-side record is
 * still unnamed. `segment` is the record's path segment as written, `order` whether this
 * is the order drawn up under it, `keepsView` whether the queue keeps its list.
 */
function nestedRecordOf(
  pathname: string,
  queue: string,
  resolve?: CourtRecordResolver,
):
  | { record: string | undefined; segment: string; order: boolean; keepsView: boolean }
  | undefined {
  const nested = NESTED_ROUTES.find((entry) => entry.queue === queue);
  if (!nested) return undefined;
  const match = nested.pattern.exec(pathname);
  if (!match) return undefined;
  let segment = match[1];
  try {
    segment = decodeURIComponent(segment);
  } catch {
    /* A malformed escape stays as typed. */
  }
  const record = nested.identify(match[1]) ?? resolve?.(queue, segment);
  if (record === undefined && !nested.clientRecord) return undefined;
  return {
    record,
    segment: match[1],
    order: Boolean(nested.order && match[2]),
    keepsView: Boolean(nested.keepsView),
  };
}

/** The list a page was opened from, off its query (`view=onboard`), when it names one. */
function viewOf(query: string | undefined): string | undefined {
  if (!query) return undefined;
  const view = new URLSearchParams(query).get("view");
  return view && /^[a-z-]+$/.test(view) ? view : undefined;
}

export function isCourtNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return nestedRecordOf(pathname, href) !== undefined;
}

/**
 * Whether the page open is one of the rows this layout folded together — so the one
 * row it renders can still say "you are here" for the destinations behind it, the way
 * each of those destinations already answers for itself and its own nested records via
 * `isCourtNavActive`.
 */
export function isCourtNavCombinedActive(
  pathname: string,
  layout: CombinedCourtNavLayout,
  court: CourtId,
): boolean {
  return courtNavClubbed(layout, court, undefined).some(
    (item) => item.href !== undefined && isCourtNavActive(pathname, item.href),
  );
}

/** One step of the trail. */
export type CourtCrumb = {
  label: string;
  /**
   * Where the crumb goes. Absent on three kinds of step, all of which are a place you
   * cannot navigate to: the **current page**, which is where you already are; a
   * **section** when this page is one of its queues, because a section is a disclosure
   * in the rail and there is no page called "Sign"; and nothing else. Present on that
   * same section when the page is nested under a queue — the section then borrows the
   * queue's href, because that is the way back and a trail step that cannot be taken is
   * a crumb that does not work.
   */
  href?: string;
  /**
   * Set on a step whose label *is* a record's number, so the bar gives it the same
   * monospaced face the record wears on the page. Every nested route names its record
   * by its number (`NESTED_ROUTES`), so that last step always carries this.
   */
  mono?: boolean;
};

/**
 * Where this page sits, as the steps above it — and, last, the page itself.
 *
 * **Every trail ends with the current page** (owner, 2026-09-11), rendered through the
 * DS `BreadcrumbPage` slot: a non-link step, `aria-current="page"`, in full ink. The
 * convention until then was the opposite — the page was never a step — on the argument
 * that each queue screen opens with a heading that is its rail label word for word, so a
 * last crumb would restate the loudest type on the screen in the quietest. That argument
 * is still true of the *queue* screens and is now overruled for the whole area, because
 * it was never true of the nested ones and because a trail whose last step is somewhere
 * else is a trail that reads as unfinished. The nested pages are where it earns itself:
 * their heading is a cause title, and the crumb carries the case number instead — an
 * identifier no heading on the page repeats.
 *
 * It reads the rail's own data, so a section renamed in `COURT_NAV_GROUPS` is renamed in
 * the trail by the same edit. Nothing below names a section, a queue or a record.
 *
 * **There is no root crumb** (owner, 2026-09-14). Every trail used to open with
 * `Court home`, which was a placeholder screen nothing else linked to; when that screen
 * became the dashboard, rooting every trail at it would have put a page nobody routinely
 * opens at the head of every other page, and rooting them at the landing — the day's
 * cause list — would have read as if signing orders happened underneath today's hearings.
 * Neither is true, so the trail starts where the work is. The rail is what gets you
 * anywhere; the trail says where you are and lets you climb one step.
 *
 * Three shapes come out of it:
 *
 * - `/employee` and any other route with no section — no trail at all. The bar keeps its
 *   fill and its seam and carries nothing, which is what chrome looks like at a
 *   destination with nothing above it. A route this file does not know gets the same
 *   answer: the current step is omitted rather than guessed, because a crumb naming a
 *   page this file cannot identify would be an invented label.
 * - `/employee/sign-orders` — `Sign`, then **`Sign orders`** as the current page. The
 *   section is still text: it has no page of its own.
 * - `/employee/hearings/<id>`, `/employee/scrutiny/<filing no.>`,
 *   `/employee/register-cases/<id>` — the section, the
 *   queue, then the record: `ST/241/2026`, `F/AHM/2026/00341`, `CMP/1840/2025`. Both of
 *   the middle steps link back to the queue, which is where the record came from and, on
 *   a complaint's file, the whole of the way back — which is why that screen carries no
 *   back control of its own.
 * - An order drawn up under a record — `/employee/hearings/<id>/order`, a cognizance
 *   act's, an application's — goes one step further: `… › ST/241/2026 › Order`, the
 *   record now a link back to it (owner, 2026-10-15). On Applications both the queue and
 *   the record carry the list it was opened from (`?view=`).
 *
 * The standalone Dashboard row is absent from every trail because nothing nests under it.
 */
export function courtTrail(
  pathname: string,
  resolve?: CourtRecordResolver,
  /** The page's query, without `?` — read only for a queue that keeps its list. */
  query?: string,
): CourtCrumb[] {
  const groups = courtNavGroupsFor(readCognizanceLayout());
  for (const group of groups) {
    for (const item of group.items) {
      // A row's child (only Take cognizance's two, while "split" is live) is itself a
      // screen, not a nested record — traced the same three steps as one, but the last
      // is the child's own label rather than an identifier read off the page.
      const child = item.children?.find(
        (entry) => entry.href !== undefined && isCourtNavActive(pathname, entry.href),
      );
      if (child) {
        return [
          { label: group.label, href: item.href },
          { label: item.label, href: item.href },
          { label: child.label },
        ];
      }

      if (!item.href || !isCourtNavActive(pathname, item.href)) continue;
      // Nested exactly when the path is not the row's own href — which is also when the
      // row is above this page rather than being it, and so becomes a link.
      const nested = nestedRecordOf(pathname, item.href, resolve);
      if (nested === undefined) {
        return [{ label: group.label }, { label: item.label }];
      }
      const record = nested.record;
      /* The way back to a queue worked as several lists lands on the same list. */
      const view = nested.keepsView ? viewOf(query) : undefined;
      const suffix = view ? `?view=${view}` : "";
      const queueHref = `${item.href}${suffix}`;
      if (record === undefined) {
        /* A record only the browser can name, not named yet (first paint) or not found:
           the trail stops at the queue, both steps still the way back. */
        return [
          { label: group.label, href: queueHref },
          { label: item.label, href: queueHref },
        ];
      }
      if (nested.order) {
        /* The order drawn up under a record: one step past it, the record the way back. */
        return [
          { label: group.label, href: queueHref },
          { label: item.label, href: queueHref },
          { label: record, mono: true, href: `${item.href}/${nested.segment}${suffix}` },
          { label: "Order" },
        ];
      }
      return [
        { label: group.label, href: queueHref },
        { label: item.label, href: queueHref },
        { label: record, mono: true },
      ];
    }
  }

  /* A standalone row has no section, so its own page carries no trail — but a record
     nested under one does: today only a register under Registers. The row is the way
     back; the register is named by its number, not an identifier, so it is not mono. */
  for (const item of COURT_NAV_LINKS) {
    if (!item.href) continue;
    const record = nestedRecordOf(pathname, item.href)?.record;
    if (record !== undefined) {
      return [{ label: item.label, href: item.href }, { label: record }];
    }
  }

  return [];
}


/** One queue with work waiting in it. */
export type CourtWaitingItem = {
  id: string;
  label: string;
  href: string;
  count: number;
};

/** A rail group and the built, non-empty queues under it. */
export type CourtWaitingGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Everything waiting in this group, so the dashboard can print a sub-total. */
  total: number;
  items: CourtWaitingItem[];
};

/**
 * What is waiting on this court, kept in the rail's own four groups.
 *
 * The dashboard's "Waiting on this court" panel reads this rather than importing sixteen
 * count constants of its own, so the panel and the rail can never disagree about how much
 * is in a queue. It keeps the grouping — Hearings, Actions, Review, Sign — because that
 * is how the bench already thinks about its work, and because the rail's groups are
 * collapsed by default, so laying the four out at once is the whole reason the panel earns
 * its place. The group's mark rides along so the panel and the rail wear the same icon.
 *
 * Only rows that are **built and populated** survive: a row with no `href` goes nowhere,
 * a row at zero is waiting on nobody, and a group with nothing left in it is dropped
 * whole rather than printed as an empty heading.
 */
export function courtWaitingGroups(
  court: CourtId,
): CourtWaitingGroup[] {
  return courtNavGroupsForCourt(COURT_NAV_GROUPS, court).map((group) => {
    const items = group.items
      .filter(
        (item): item is CourtNavItem & { href: string; count: number } =>
          Boolean(item.href) && typeof item.count === "number" && item.count > 0,
      )
      .map((item) => ({
        id: item.id,
        label: item.label,
        href: item.href,
        count: item.count,
      }));
    return {
      id: group.id,
      label: group.label,
      icon: group.icon,
      total: items.reduce((sum, item) => sum + item.count, 0),
      items,
    };
  }).filter((group) => group.items.length > 0);
}
