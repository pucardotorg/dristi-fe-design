import { redirect } from "next/navigation";

/** Case documents now go through the same upload as Excel. */
export default function DocumentsPage() {
  redirect("/filings/bulk/upload");
}
