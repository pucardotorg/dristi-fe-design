import { redirect } from "next/navigation";

/** Folded into Applications (owner, 2026-10-07); kept so old links still land. */
export default function Page() {
  redirect("/employee/applications?view=onboard");
}
