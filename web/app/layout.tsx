import type { Metadata } from "next";
import Banner from "@/components/Banner";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clinical Care Gap Explorer",
  description:
    "Finds diabetic patients overdue for an A1c test, and shows the data quality work required before that list can be trusted. Synthetic data only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* Banner sits above everything, so 404s and error states carry it too (FR7, V5.3) */}
        <Banner />
        <Nav />
        <main className="mx-auto max-w-5xl px-4 pb-24">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs leading-relaxed" style={{ color: "var(--faint)" }}>
          Synthea, Massachusetts, seed 20260823, simulation pinned to 2026-08-23. Portfolio
          project, not a production system and not HIPAA compliance.
        </footer>
      </body>
    </html>
  );
}
