import { redirect } from "next/navigation";

/** Folded into Applications (2026-10-16): the old address opens its pill there. */
export default function Page() {
  redirect("/employee/applications?view=decide");
}
