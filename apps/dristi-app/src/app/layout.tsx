import type { Metadata } from "next";

import { CourtProvider } from "@/components/court/court-provider";
import { DesignModeLoader } from "@/components/design-mode-loader";
import { FeedbackProvider } from "@/components/feedback-provider";
import { LocaleProvider } from "@/components/shell/locale";
import { ThemeProvider } from "@/components/theme-provider";
import { serverBrandHue, serverCourt, serverCourtText } from "@/lib/court/server";

import "./globals.css";
/* App-owned rules on chrome we do not author; globals.css is synced from the DS. */
import "./chrome.css";
/* A state's own brand colour (Gujarat's navy), keyed off `data-brand-hue` below. */
import "./court-palette.css";

/** The tab title names the product the state runs — SARAS 2.0 in Gujarat, never DRISTI. */
export async function generateMetadata(): Promise<Metadata> {
  const courtText = await serverCourtText();
  const product = courtText("DRISTI");
  return {
    title: { default: product, template: `%s · ${product}` },
    description:
      "PUCAR's platform for NI Act §138 (cheque-dishonour) cases through Indian courts.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Which state's court the app runs as (Settings). Read here so the server renders that
  // state's names and numbers from the first paint; see `CourtProvider`.
  const court = await serverCourt();
  const hue = await serverBrandHue(court);

  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      // Another state's court is drawn hidden until its text layer has run once
      // (`CourtTextLayer`, `chrome.css`), so Kerala's words never flash first.
      data-court-pending={court === "kerala" ? undefined : ""}
      // Gujarat's brand colour (`court-palette.css`); absent everywhere else.
      data-brand-hue={hue ?? undefined}
      className="h-full antialiased"
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            <CourtProvider initialCourt={court}>
              <FeedbackProvider>{children}</FeedbackProvider>
              <DesignModeLoader />
            </CourtProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
