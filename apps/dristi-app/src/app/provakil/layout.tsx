import type { Metadata } from "next";
import { Roboto } from "next/font/google";

import "@/provakil/provakil.css";

/**
 * Demo only: a stand-in for Tata Capital's Provakil workspace, served from this app at
 * `/provakil` so one deployment holds both sides of the bulk filing demo. It is another
 * product, so it carries its own look and none of DRISTI's; it reaches SARAS 2.0 only
 * through the court's Bulk Filing API (`provakil/lib/saras-link.ts`).
 */

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });

export const metadata: Metadata = {
  title: { default: "Provakil", template: "%s | Provakil" },
  description: "Demo stand-in for a Provakil Legal Collections workspace.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  // `data-court-raw`: Provakil's words are its own, not the court's to re-voice.
  return (
    <div data-court-raw className={`provakil ${roboto.variable}`}>
      {children}
    </div>
  );
}
