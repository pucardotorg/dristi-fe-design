import type { Metadata } from "next";
import { Roboto } from "next/font/google";

import "./globals.css";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto" });

export const metadata: Metadata = {
  title: { default: "Provakil", template: "%s | Provakil" },
  description: "Demo stand-in for a Provakil Legal Collections workspace.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
