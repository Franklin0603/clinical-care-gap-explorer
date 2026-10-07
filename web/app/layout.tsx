import type { Metadata } from "next";
import { gold } from "@/lib/data";
import "./globals.css";

/**
 * The site's public origin, for share cards and canonical URLs. Set
 * NEXT_PUBLIC_SITE_URL for a custom domain; on Vercel the production URL is
 * known at build time; otherwise the GitHub Pages address.
 */
const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  "https://franklin0603.github.io/clinical-care-gap-explorer"
).replace(/\/+$/, "");
const DESCRIPTION =
  "An explainable healthcare data application for identifying and exploring A1C monitoring gaps in a synthetic diabetes cohort. A portfolio project; not for clinical use.";

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
    title: "Which diabetic patients have not had an A1C in twelve months?",
    description: DESCRIPTION,
    images: [{
      url: `${SITE}/og.png`,
      width: 1200,
      height: 630,
      alt: `Clinical Care Gap Explorer — ${gold.open_gaps} of ${gold.cohort} diabetic patients with an open A1C gap, ${gold.never_tested} never tested. Synthetic data.`,
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Which diabetic patients have not had an A1C in twelve months?",
    description: DESCRIPTION,
    images: [`${SITE}/og.png`],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* The shell is not here: the public landing page at / sits outside
            it, and the application routes get it from app/(app)/layout.tsx.
            FR7 still holds - the synthetic-data notice is on every route, in
            the app header and in the landing page's own header. */}
        {children}
      </body>
    </html>
  );
}
