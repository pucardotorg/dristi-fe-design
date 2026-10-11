"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDaysIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderClosedIcon,
  HouseIcon,
  ListChecksIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { TASKS_HOME } from "@/lib/tasks/routes";
import { summaryOf } from "@/lib/tasks/selectors";
import { useTasks } from "@/lib/tasks/store";
import { BrandGlyph } from "@/components/brand-lockup";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { YourDetailsItem } from "@/components/filing/your-details-item";
import { useAppSearch } from "@/components/shell/app-search";
import { useChrome } from "@/components/shell/chrome";
import { useProfile, type ProfileRole } from "@/components/shell/profile";
import { VIEWER_CLERK_NAME } from "@/lib/cases/viewer";
import { RAIL_THEMES, useRailTheme } from "@/components/shell/rail-theme";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** The court identity at the page origin. */
export const COURT = { brand: "DRISTI" };

/**
 * Re-exported so existing imports keep working. The value itself lives in
 * `lib/tasks/routes` — a route is data, and a Server Component cannot safely import one
 * out of a `"use client"` module (see the note there).
 */
export { TASKS_HOME };

/**
 * Nav row metrics.
 *
 * The control is 40×40 in both states — the primary navigation has to meet the 40×40
 * touch floor, and the DS default (32px, forced with `!`) left the collapsed rail
 * reading as unfinished. `size-10!` beats the primitive's own `!` through tailwind-merge
 * (same `size-*` key, ours last).
 *
 * The glyph goes to 20px against the DS's 16px: a 16px mark inside a 40px square fills
 * two-fifths of it and reads lost once the labels are gone.
 *
 * Every ink in the rail is a `--rail-*` / `--sidebar-*` variable set by the selected
 * rail theme (see `rail-theme.tsx`) — the rail no longer borrows the `dark` scope, so
 * plates from any ramp can coexist and none of them inverts under the app's own dark
 * mode. The selected row is always the white card with dark ink and the teal glyph;
 * those inks are constants of the card, not of the plate.
 */
const ROW = [
  // `pr-3` against `px-2`: the count rides `ml-auto` to the trailing edge, and at 8px it
  // sat on the fill's curve. `relative` so the collapsed count can ride the glyph's
  // corner.
  "relative h-10 gap-3 px-2 pr-3 group-data-[collapsible=icon]:size-10!",
  // Centring the square is not enough — the glyph has to be centred *within* it: the
  // label leaves the layout on collapse (see LABEL), the gap and padding go with it,
  // and flex centring puts the 20px mark at 10px a side.
  "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0!",
  // The DS clips the button so a label cannot spill during the collapse. Once collapsed
  // there is no label left to spill, and the clip only cuts the corner off the count.
  "group-data-[collapsible=icon]:overflow-visible",
  "[&_svg]:size-5",
  // Selection inverts: the row becomes the light card, which is the strongest signal
  // the rail has, so nothing stacks on it. The label only has to be read (card ink,
  // 17.4:1); the teal lives in the icon, a shape with no reading threshold (4.9:1,
  // against a 3:1 bar for marks). Weight stays the DS's own `font-medium`. On the
  // light plates the card also lifts (`--rail-active-shadow`) — a white card on a
  // near-white plate otherwise does not exist.
  "data-[active=true]:bg-(--rail-card) data-[active=true]:text-(--rail-card-ink)",
  "data-[active=true]:shadow-(--rail-active-shadow)",
  "data-[active=true]:[&_svg]:text-(--rail-card-icon)",
  "data-[active=true]:hover:bg-(--rail-card) data-[active=true]:hover:text-(--rail-card-ink)",
].join(" ");

type NavItem = { id: string; label: string; icon: LucideIcon; href?: string };

/**
 * The product's navigation, in three groups: where you go, what you start, and who you
 * work with. Only Pending Tasks is built in this round; the rest are shown because the
 * shape of the product is the point of a shell, and they say plainly that they do
 * nothing rather than looking available.
 */
/* Labels are sentence case (DS Law) and match the breadcrumb root for the same area,
   so the rail, the trail and the page title never call one place three things. */
const GO: NavItem[] = [
  { id: "search", label: "Search", icon: SearchIcon },
  { id: "home", label: "Home", icon: HouseIcon, href: "/home" },
  { id: "cases", label: "Cases", icon: FolderClosedIcon, href: "/cases" },
  {
    id: "tasks",
    label: "Pending tasks",
    icon: ListChecksIcon,
    href: TASKS_HOME,
  },
  { id: "calendar", label: "Calendar", icon: CalendarDaysIcon },
];

const START: NavItem[] = [
  // Join a case is not a destination: its whole journey (lookup → role questions →
  // vakalatnama) runs in a dialog, so it is the one strong action on the Cases page
  // rather than a rail item that led to a page holding a single button.
  {
    id: "file-case",
    label: "File a case",
    icon: FilePlusIcon,
    href: "/filings",
  },
  // Raised against a case, so the page behind this starts by asking which one;
  // from there it is the same flow a case's Make filings menu opens.
  {
    id: "raise-application",
    label: "Raise application",
    icon: FileTextIcon,
    href: "/raise-application",
  },
  {
    id: "vakalatnama",
    label: "Vakalatnama",
    icon: ScrollTextIcon,
    href: "/vakalatnama",
  },
];

const WITH: NavItem[] = [{ id: "people", label: "People", icon: UsersIcon, href: "/people" }];

/**
 * The row's label. It has to leave the layout on collapse, not merely be clipped by the
 * rail's overflow: a flex child of zero visible width is still a flex child, and it
 * held a centred glyph hard against the leading edge.
 */
const LABEL = "truncate group-data-[collapsible=icon]:hidden";

/** The rail's secondary ink, from the selected theme. */
const MUTED = "text-(--rail-muted)";

const UNBUILT_NOTE = "not available yet";

/**
 * How many tasks are waiting on you.
 *
 * Two registers, one meaning. Expanded, the count is a quiet tabular numeral with a
 * 6px red spark beside it — the red says "live obligation" without shouting a number
 * that is already legible as text; the earlier full red pill at 16px/600 read as an
 * alarm bolted to the nav. Collapsed, there is no text left to carry the number, so it
 * becomes a corner pill — ringed in whatever it overlaps: the plate under an idle row,
 * the card under the selected one.
 *
 * The pill's chunkiness was structural, not stylistic: caption numerals are 12px, so
 * two digits in a 14px pill ran wall-to-wall and the mark read as a red blob half the
 * size of the glyph it annotates. The numeral drops to 10px — below the DS's caption
 * floor, which is why it carries the reviewed-exception marker: this is a two-digit
 * annotation on a 20px icon, not screen copy, and the DS has no badge-numeral role yet
 * (upstream feedback). The ring thins to 1px for the same reason: the halo was a third
 * of the pill's own height.
 */
function TasksCount() {
  const { state, people, cases, tasks, user } = useTasks();
  const { profileRole } = useProfile();
  if (state !== "ready") return null;
  // A litigant's task list is their own (empty in this demo), so no advocate count.
  if (profileRole === "litigant") return null;
  const { action } = summaryOf({ people, cases, tasks, user, now: new Date() });
  if (!action) return null;
  return (
    <>
      {/* expanded: spark + numeral */}
      <span
        aria-hidden
        className={[
          "ml-auto flex items-center gap-1.5 group-data-[collapsible=icon]:hidden",
          "text-caption tabular-nums",
          MUTED,
          "group-data-[active=true]/menu-button:text-(--rail-card-muted)",
        ].join(" ")}
      >
        <span className="size-1.5 rounded-full bg-(--rail-badge)" />
        {action}
      </span>
      {/* collapsed: the corner pill */}
      <span
        aria-hidden
        className={[
          "absolute -top-0.5 -right-0.5 hidden h-3.5 min-w-3.5 items-center justify-center rounded-full px-1",
          // 10px badge numeral, reviewed: an annotation on an icon, not screen copy —
          // the caption size filled the pill and made it a blob. ds-typography-allow
          "bg-(--rail-badge) text-[10px] font-medium leading-none tabular-nums text-(--rail-badge-ink)",
          "ring-1 ring-(--sidebar) group-data-[active=true]/menu-button:ring-(--rail-card)",
          "group-data-[collapsible=icon]:flex",
        ].join(" ")}
      >
        {action}
      </span>
    </>
  );
}

/** What the count says out loud. The marks themselves are bare numerals. */
function TasksCountLabel() {
  const { state, people, cases, tasks, user } = useTasks();
  const { profileRole } = useProfile();
  if (state !== "ready") return null;
  if (profileRole === "litigant") return null;
  const { action } = summaryOf({ people, cases, tasks, user, now: new Date() });
  if (!action) return null;
  return <span className="sr-only">, {action} need action</span>;
}

/**
 * One nav row: a link when it goes somewhere, an action when it starts something in
 * place, and an explained dead control when it does neither.
 */
/** The keystroke that opens search, on the row that opens it. Muted — it is a reminder. */
function SearchShortcut() {
  const { shortcut } = useAppSearch();
  return (
    <span className={`${LABEL} ${MUTED} ml-auto text-caption tabular-nums`}>{shortcut}</span>
  );
}

function NavRow({ item, onAction }: { item: NavItem; onAction?: () => void }) {
  const pathname = usePathname();
  const { crumbRoot } = useChrome();
  // On a phone the rail is a sheet over the page. Choosing where to go is the
  // end of its job, so it puts itself away; left open, it sat over the screen
  // that had just loaded behind it (owner, Sept 21). A no-op on desktop.
  const { isMobile, setOpenMobile } = useSidebar();
  const closeSheet = () => {
    if (isMobile) setOpenMobile(false);
  };
  const { id, label, icon: Icon, href } = item;

  if (onAction) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip={label}
          className={ROW}
          onClick={() => {
            closeSheet();
            onAction();
          }}
        >
          <Icon aria-hidden />
          <span className={LABEL}>{label}</span>
          {id === "search" ? <SearchShortcut /> : null}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (!href) {
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              aria-disabled="true"
              /* Focusable and hoverable on purpose: a control that says why it does
                 nothing is more use than one that cannot be reached to ask. Full
                 contrast — dimming to 50% would make the label itself unreadable. */
              className={`${ROW} ${MUTED} aria-disabled:pointer-events-auto aria-disabled:opacity-100`}
            >
              <Icon aria-hidden />
              <span className={LABEL}>{label}</span>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">
            {`${label} — ${UNBUILT_NOTE}`}
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  // Highlighted for the whole area; `aria-current="page"` only on the list itself.
  // A screen reached through another area's door roots its trail there
  // (`lib/nav/origin.ts`), and the rail agrees with the trail: the types page
  // opened from Raise application lives under `/cases`, but Cases is not where
  // the person is.
  const inArea = (crumbRoot?.href ?? pathname).startsWith(href);
  const isPage = pathname === href;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={inArea}
        tooltip={label}
        className={ROW}
      >
        <Link
          href={href}
          aria-current={isPage ? "page" : undefined}
          onClick={closeSheet}
        >
          <Icon aria-hidden />
          <span className={LABEL}>{label}</span>
          {id === "tasks" ? (
            <>
              <TasksCountLabel />
              <TasksCount />
            </>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * One group of rows.
 *
 * `items-center` in the collapsed state is what keeps the 40px square honest: the rail
 * carries a hairline on its trailing edge, so padding-based centring leaves 8px on one
 * side and 7px on the other. Centring by flex is immune to the border.
 *
 * A group after the first is separated by the theme's seam — in both states. Hiding the
 * rules on collapse was a mistake worth recording: the header's seam survived, so the
 * strip was half-ruled — one line at the top and then nothing, which read as the rail
 * losing its structure rather than simplifying it. Collapsed, the rule stays but insets
 * to the width of the squares (12px a side), so it underlines the group instead of
 * cutting the whole strip.
 */
function NavGroup({
  items,
  label,
  separated,
  actions,
}: {
  items: NavItem[];
  label: string;
  separated?: boolean;
  /** In-place actions by item id — a row with one opens something rather than routing. */
  actions?: Record<string, () => void>;
}) {
  return (
    <SidebarGroup
      className={
        separated
          ? "border-t border-(--rail-seam) px-3 py-2 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:px-0"
          : "px-3 py-2 group-data-[collapsible=icon]:px-0"
      }
    >
      {/* The primitives are `div`s; the landmark has to be declared here. */}
      <SidebarGroupContent>
        <nav aria-label={label}>
          <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
            {items.map((item) => (
              <NavRow key={item.id} item={item} onAction={actions?.[item.id]} />
            ))}
          </SidebarMenu>
        </nav>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

/**
 * The rough rail-theme picker — swatches in the profile popover so the team can flip
 * plates and collect feedback. The popover portals to the page, so its own styling is
 * ordinary light-scope DS; only the swatches carry the plates.
 */
function RailThemePicker() {
  const { theme, setThemeId } = useRailTheme();
  return (
    <div className="mt-1 border-t border-hairline pt-1">
      <p className="px-2 py-1.5 text-caption font-semibold text-muted-foreground">
        Rail plate — experiment
      </p>
      <div role="radiogroup" aria-label="Rail plate">
        {RAIL_THEMES.map((t) => (
          <Button
            key={t.id}
            role="radio"
            aria-checked={t.id === theme.id}
            variant="ghost"
            className="w-full justify-start font-normal"
            onClick={() => setThemeId(t.id)}
          >
            <span
              aria-hidden
              className="size-4 rounded-full border border-hairline"
              style={{ background: t.swatch }}
            />
            <span className="flex-1 text-left">{t.label}</span>
            {t.id === theme.id ? <CheckIcon aria-hidden /> : null}
          </Button>
        ))}
      </div>
    </div>
  );
}

const PROFILE_LABEL: Record<ProfileRole, string> = {
  advocate: "Advocate",
  litigant: "Litigant",
  clerk: "Clerk",
};

const PROFILE_HOME: Record<ProfileRole, string> = {
  advocate: "/advocate",
  litigant: "/home",
  clerk: "/cases",
};

/**
 * The person, at the foot of the rail.
 *
 * The slot is unconditional: an account that cannot switch profiles still has a
 * settings menu, and the rail should not change shape between roles. Only the switching
 * itself is conditional. The avatar carries a saturated fill: at the foot of the chrome
 * it is an identity mark with nothing beside it to be distinguished from.
 */
function ProfileFooter() {
  const { state, people, user, setUser, resetSandbox } = useTasks();
  const { profileRole, advocateProfileAvailable, accountName, setProfileRole } =
    useProfile();
  const router = useRouter();
  const roleLabel = PROFILE_LABEL[profileRole];

  // The name is the account's, fixed — switching profile changes the role label, not the
  // person. So Anjali stays Anjali whether she is acting as advocate or litigant. The
  // demo clerk profile is the exception: a clerk is someone else in her office, so it
  // shows the clerk's own name (see `profile.tsx`).
  const displayName = profileRole === "clerk" ? VIEWER_CLERK_NAME : accountName;
  const nameParts = displayName.replace(/^Adv\.\s*/, "").trim().split(/\s+/);
  const displayInitials = (
    (nameParts[0]?.[0] ?? "") + (nameParts[nameParts.length - 1]?.[0] ?? "")
  ).toUpperCase();

  // Switching profile re-frames the whole product, so it lands on that profile's home.
  // The clerk lands on Cases: the advocate's home is her own day, not her office's.
  function switchTo(role: ProfileRole) {
    if (role === profileRole) return;
    setProfileRole(role);
    router.push(PROFILE_HOME[role]);
  }
  const [confirmReset, setConfirmReset] = React.useState(false);
  const onResetSandbox = React.useCallback(() => setConfirmReset(true), []);

  return (
    <SidebarFooter className="border-t border-(--rail-seam) p-3 group-data-[collapsible=icon]:px-0">
      <SidebarMenu className="group-data-[collapsible=icon]:items-center">
        <SidebarMenuItem className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <SidebarMenuButton
                  className={`${ROW} h-12 group-data-[collapsible=icon]:size-10!`}
                  tooltip={`${displayName} · ${roleLabel}`}
                  aria-label={`${displayName} · ${roleLabel} · Switch profile`}
                >
                  <span className="relative shrink-0">
                    <span
                      aria-hidden
                      className="flex size-8 items-center justify-center rounded-full bg-primary text-caption font-semibold text-primary-foreground"
                    >
                      {displayInitials}
                    </span>
                    {/* The chevron rides the avatar rather than the row's trailing edge,
                        so the affordance survives the collapse with the mark it belongs
                        to. */}
                    <span
                      aria-hidden
                      className="absolute top-1/2 -left-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-sidebar ring-1 ring-(--rail-seam)"
                    >
                      <ChevronsUpDownIcon className={`size-3! ${MUTED}`} />
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-body-compact font-medium">
                      {displayName}
                    </span>
                    <span className={`truncate text-caption ${MUTED}`}>
                      {roleLabel}
                    </span>
                  </span>
                </SidebarMenuButton>
              </PopoverTrigger>

              <PopoverContent
                side="top"
                align="start"
                collisionPadding={16}
                // Taller than a laptop screen once every sandbox person and the
                // rail plates are listed: held to the room Radix says is left,
                // and scrolled, so the top of the list is always reachable.
                className="max-h-(--radix-popover-content-available-height) w-64 overflow-y-auto overscroll-contain p-2"
              >
                <p className="px-2 py-1.5 text-caption font-semibold text-muted-foreground">
                  Switch profile
                </p>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => switchTo("litigant")}
                >
                  <span
                    aria-hidden
                    className="flex size-6 items-center justify-center rounded-full bg-surface-sunken text-caption font-semibold"
                  >
                    L
                  </span>
                  <span className="flex-1 text-left">Litigant</span>
                  {profileRole === "litigant" ? (
                    <CheckIcon aria-hidden />
                  ) : null}
                </Button>
                {advocateProfileAvailable ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => switchTo("advocate")}
                  >
                    <span
                      aria-hidden
                      className="flex size-6 items-center justify-center rounded-full bg-surface-sunken text-caption font-semibold"
                    >
                      A
                    </span>
                    <span className="flex-1 text-left">Advocate</span>
                    {profileRole === "advocate" ? (
                      <CheckIcon aria-hidden />
                    ) : null}
                  </Button>
                ) : null}

                {/* Only in an area that has a filing profile to edit. */}
                <YourDetailsItem />

                {/* The sandbox's own controls, kept with the identity they act on rather
                    than behind a second account avatar in the top bar. They are scaffolding
                    for a build with no session yet, so they read as a separate, quieter
                    register below the rule. */}
                <div className="mt-1 border-t border-hairline pt-1">
                  <p className="px-2 py-1.5 text-caption font-semibold text-muted-foreground">
                    Viewing as
                  </p>
                  {people.map((p, index) => (
                    <React.Fragment key={p.id}>
                      <Button
                        variant="ghost"
                        className="w-full justify-start font-normal"
                        disabled={state !== "ready"}
                        onClick={() => {
                          // Everyone in the sandbox is an advocate; picking one
                          // leaves the clerk's seat.
                          if (profileRole === "clerk") setProfileRole("advocate");
                          void setUser(p.id);
                        }}
                      >
                        <span className="flex-1 truncate text-left">
                          {p.name}
                        </span>
                        {profileRole !== "clerk" && p.id === user.id ? (
                          <CheckIcon aria-hidden />
                        ) : null}
                      </Button>
                      {/* The signed-in advocate's clerk, right under the
                          advocate: a different person, so here among the
                          people to view as, not among the account's own
                          profiles (owner, Sept 24). Acting as him shows the
                          clerk's side of Applications: drafts and pays,
                          never signs. */}
                      {index === 0 ? (
                        <Button
                          variant="ghost"
                          className="w-full justify-start font-normal"
                          onClick={() => setProfileRole("clerk")}
                        >
                          <span className="flex-1 truncate text-left">
                            {VIEWER_CLERK_NAME}
                          </span>
                          <span className="text-caption text-muted-foreground">
                            Clerk
                          </span>
                          {profileRole === "clerk" ? (
                            <CheckIcon aria-hidden />
                          ) : null}
                        </Button>
                      ) : null}
                    </React.Fragment>
                  ))}
                  <Button
                    variant="ghost"
                    className="w-full justify-start font-normal text-muted-foreground"
                    onClick={onResetSandbox}
                  >
                    <RotateCcwIcon aria-hidden />
                    <span className="flex-1 text-left">Reset sandbox data</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start font-normal text-muted-foreground"
                    onClick={() => router.push("/join/demo")}
                  >
                    <ScrollTextIcon aria-hidden />
                    <span className="flex-1 text-left">
                      Join a Case from Summons
                    </span>
                  </Button>
                </div>

                <RailThemePicker />
              </PopoverContent>
            </Popover>
          </div>

          {/* Settings is its own control, not an item inside the profile menu: it is a
              destination, and burying it under "switch profile" makes one of the two
              reasons to come here invisible. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label="Profile settings"
                className={`size-10 shrink-0 [&_svg]:size-5 group-data-[collapsible=icon]:hidden ${MUTED} hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`}
              >
                <Link href="/settings">
                  <SettingsIcon aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Settings</TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      </SidebarMenu>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset the sandbox?"
        description="Every task, upload and decision made in this browser is discarded and the seed data is loaded again. Other open tabs reload too."
        confirmLabel="Reset sandbox"
        onConfirm={() => {
          setConfirmReset(false);
          void resetSandbox();
        }}
      />
    </SidebarFooter>
  );
}

/**
 * On a phone the primitive renders the rail as a Sheet and keeps `style` and
 * `className` for the Sheet root, which has no DOM. The theme's vars never land, so
 * the sheet fell back to the DS default plate with the seams at `currentColor`: a
 * wireframe. This re-declares the theme on a wrapper inside the sheet, where it can
 * paint the whole panel. On desktop the vars already land, so it adds nothing.
 */
function RailPlate({ vars, children }: { vars: React.CSSProperties; children: React.ReactNode }) {
  const { isMobile } = useSidebar();
  if (!isMobile) return <>{children}</>;
  return (
    // A pixel wider than the sheet so the plate also covers the sheet's own light
    // 1px edge border, which otherwise shows as a beige line down the right side.
    <div style={vars} className="flex h-full w-[calc(100%+1px)] flex-col bg-sidebar text-(--sidebar-foreground)">
      {children}
    </div>
  );
}

/** Main navigation for the whole app. Icon rail from `md`, sheet below it. */
export function AppSidebar() {
  const { theme } = useRailTheme();
  const { profileRole } = useProfile();
  const { open: openSearch } = useAppSearch();

  // Home is role-aware: the advocate's home and the litigant's home are different
  // screens on the same shell. The rest of the nav is shared.
  const mainItems = GO.map((item) =>
    item.id === "home"
      ? { ...item, href: profileRole === "litigant" ? "/home" : "/advocate" }
      : item,
  );

  return (
    /*
     * The plate comes from the selected rail theme — six candidates, every value an
     * existing DS token, every ink pair AA-checked (see `rail-theme.tsx` for the
     * palette and the reasoning). The rail no longer wears the `dark` scope: each
     * theme names its inks outright, which is what lets a warm-beige plate and a
     * brand-teal plate use the same markup, and what keeps every plate identical
     * under the app's own dark mode.
     */
    <Sidebar
      collapsible="icon"
      // The primitive declares `text-sidebar-foreground` on its outer wrapper, one
      // element above where these vars land — so the colour computes against the DS
      // default, not the theme. Re-declaring it here, beside the vars, is what makes
      // the foreground actually the theme's.
      className="text-(--sidebar-foreground)"
      style={theme.vars as React.CSSProperties}
    >
      {/*
       * Logo left, collapse control right — the mark sits at the page origin, where a
       * mark belongs, and the control that owns the rail sits with the rail; it also
       * keeps the trigger out of the breadcrumb's row, where it read as the trail's
       * first item. The header is the top bar's own height so its rule and the
       * breadcrumb bar's rule are one continuous line across the whole chrome.
       */}
      <RailPlate vars={theme.vars as React.CSSProperties}>
      <SidebarHeader className="h-14 flex-row items-center justify-between border-b border-(--rail-seam) px-3 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        {/* The ON Courts glyph alone, in both states. The full lockup stacks its
            wordmark under the mark, and at the size a 56px bar can spare, "24×7 ON
            COURTS" cannot be read. Gujarat's SARAS 2.0 is one line of text, so it is named
            beside its mark until the rail folds. `onDark` follows the plate, not the
            app's mode. */}
        <BrandGlyph
          className="h-6"
          onDark={theme.darkPlate}
          named
          wordmarkClassName="group-data-[collapsible=icon]:hidden"
        />
        <SidebarTrigger
          aria-label="Collapse main navigation"
          className={`size-8 shrink-0 group-data-[collapsible=icon]:hidden [&_svg]:size-5 ${MUTED} hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`}
        />
      </SidebarHeader>

      <SidebarContent>
        <NavGroup items={mainItems} label="Main" actions={{ search: openSearch }} />
        <NavGroup items={START} label="Start something" separated />
        <NavGroup items={WITH} label="People" separated />
      </SidebarContent>

      <ProfileFooter />
      </RailPlate>
    </Sidebar>
  );
}
