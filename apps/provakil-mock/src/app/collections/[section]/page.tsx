import { NotInDemo } from "@/components/shell";

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  notices: "Legal Notices",
  workflows: "Legal Action Workflows",
  causelist: "Causelist",
  hearings: "Hearings",
  advocates: "Advocates",
  spend: "Legal Spend",
  reports: "Reports",
};

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <NotInDemo title={TITLES[section] ?? "Not found"} />;
}
