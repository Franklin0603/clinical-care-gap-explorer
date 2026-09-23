"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
  { href: "/", label: "Overview" },
  { href: "/pipeline", label: "Pipeline & Data Quality" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav
      className="sticky top-0 z-10 border-b backdrop-blur"
      style={{ borderColor: "var(--rule)", background: "color-mix(in srgb, var(--ground) 88%, transparent)" }}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3">
        <Link href="/" className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Clinical Care Gap Explorer
        </Link>
        <div className="flex gap-5">
          {PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="text-sm"
              style={{
                color: path === p.href ? "var(--blue)" : "var(--muted)",
                fontWeight: path === p.href ? 600 : 400,
              }}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
