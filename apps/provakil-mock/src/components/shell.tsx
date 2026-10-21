"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  BellIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  FileTextIcon,
  GavelIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
  WorkflowIcon,
} from "lucide-react";

const NAV = [
  { href: "/collections/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/collections/notices", label: "Legal Notices", icon: FileTextIcon },
  { href: "/collections/workflows", label: "Legal Action Workflows", icon: WorkflowIcon },
  { href: "/collections/litigation", label: "Litigation", icon: GavelIcon },
  { href: "/collections/causelist", label: "Causelist", icon: ListChecksIcon },
  { href: "/collections/hearings", label: "Hearings", icon: CalendarDaysIcon },
  { href: "/collections/advocates", label: "Advocates", icon: UsersIcon },
  { href: "/collections/spend", label: "Legal Spend", icon: WalletIcon },
  { href: "/collections/reports", label: "Reports", icon: BarChart3Icon },
];

/** The only places the demo goes; everything else is shown greyed and inert. */
const LIVE = ["/collections/litigation"];

/** Provakil's chrome: navy top bar with the suite switcher, a white rail on the left. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 bg-navy px-4 text-white">
        <Link href="/collections/litigation" className="flex items-baseline gap-0.5 pr-2" aria-label="Provakil home">
          <span className="text-[22px] font-bold tracking-tight lowercase">provakil</span>
          <span className="size-1.5 rounded-full bg-[#00c9a7]" aria-hidden />
        </Link>
        <button disabled title="Not part of this demo" className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium opacity-60">
          <BriefcaseIcon className="size-4" aria-hidden />
          Legal Collections
          <ChevronDownIcon className="size-4 opacity-70" aria-hidden />
        </button>
        <div className="mx-auto hidden w-full max-w-xl cursor-not-allowed items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 opacity-50 md:flex" title="Not part of this demo">
          <SearchIcon className="size-4 opacity-70" aria-hidden />
          <input
            disabled
            className="w-full cursor-not-allowed bg-transparent text-[13px] placeholder:text-white/60 focus:outline-none"
            placeholder="Search LAN, borrower, CNR, advocate…"
            aria-label="Search"
          />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button disabled className="cursor-not-allowed rounded-full p-2 opacity-50" aria-label="Help" title="Not part of this demo">
            <HelpCircleIcon className="size-5" />
          </button>
          <button disabled className="relative cursor-not-allowed rounded-full p-2 opacity-50" aria-label="Notifications" title="Not part of this demo">
            <BellIcon className="size-5" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#00c9a7]" />
          </button>
          <div className="ml-2 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-teal text-[13px] font-medium">PV</span>
            <div className="hidden whitespace-nowrap leading-tight xl:block">
              <div className="text-[13px] font-medium">Priya Vyas</div>
              <div className="text-[11px] text-white/60">Legal Manager · Tata Capital</div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col border-r border-line bg-white py-3 lg:flex">
          <ul className="flex flex-col gap-0.5 px-2">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              if (!LIVE.includes(item.href))
                return (
                  <li key={item.href}>
                    <span
                      aria-disabled="true"
                      title="Not part of this demo"
                      className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-[13px] text-slate opacity-35 select-none"
                    >
                      <Icon className="size-4" aria-hidden />
                      {item.label}
                    </span>
                  </li>
                );
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] ${
                      active ? "bg-blue-50 font-medium text-blue" : "text-slate hover:bg-ground"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto border-t border-line px-2 pt-2">
            <Link
              href="/settings/integrations/saras"
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-[13px] ${
                pathname.startsWith("/settings") ? "bg-blue-50 font-medium text-blue" : "text-slate hover:bg-ground"
              }`}
            >
              <SettingsIcon className="size-4" aria-hidden />
              Settings
            </Link>
          </div>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Pages this demo does not build: the rail still leads somewhere honest. */
export function NotInDemo({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-medium">{title}</h1>
      <p className="mt-2 text-muted">Not part of this demo. The demo covers Litigation and the DRISTI connector.</p>
    </div>
  );
}
