import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const SITE = "https://franklin0603.github.io/clinical-care-gap-explorer";
const DESCRIPTION =
  "Finds diabetic patients overdue for an A1c test, and shows the data quality work required before that list can be trusted. Synthetic data only.";

/**
 * Open Graph matters here because this link gets posted.
 *
 * Without an og:image a shared link renders as a bare URL with a line of grey
 * text, which is a poor showing for a project whose argument is that
 * presentation of numbers is part of the work. The card is built by
 * tools/build_og.py from the pipeline's own gold_report.json and dq_report.json,
 * so the figures on it cannot drift from the figures on the site.
 *
 * The URL is absolute: crawlers do not resolve relative paths, and this deploys
 * under a GitHub Pages basePath.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  // Pages set a bare title ("Patients") and the template adds the product, so
  // the product name is written once instead of in every page file.
  title: { default: "Care Gap Explorer", template: "%s · Care Gap Explorer" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Care Gap Explorer",
    title: "Which diabetic patients have not had an A1c in twelve months?",
    description: DESCRIPTION,
    images: [{
      url: `${SITE}/og.png`,
      width: 1200,
      height: 630,
      alt: "Clinical Care Gap Explorer — 25 of 116 diabetic patients with an open A1c gap, 21 never tested, 6 of 6 defect types caught.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Which diabetic patients have not had an A1c in twelve months?",
    description: DESCRIPTION,
    images: [`${SITE}/og.png`],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* FR7 still holds: the synthetic-data notice is on every route,
            including 404 and error. It moved from a full-width red band into
            the global header and the sidebar - see SyntheticDataBadge. */}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
