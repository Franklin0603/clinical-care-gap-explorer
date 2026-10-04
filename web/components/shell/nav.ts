/**
 * The application's information architecture, as data.
 *
 * The sidebar, the breadcrumbs and the active-route state all read from here,
 * so a page moves in one place and all three follow. Organised around the care
 * workflow - what needs attention and what to do next - rather than around how
 * the pipeline was built. The engineering work is still reachable; it sits
 * under System, where it does not compete with the care work for attention.
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpen, ChartNoAxesCombined, CircleAlert, CircleHelp, Database, House,
  ListChecks, MessageSquareText, Settings, Users,
} from "lucide-react";

import { gold } from "@/lib/data";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** A small figure beside the label. Omitted when there is no real source -
   *  a made-up count on a clinical worklist is a claim, not a placeholder. */
  count?: number;
  /** What the count means, for screen readers and the tooltip. */
  countLabel?: string;
  /** Existing routes that belong under this item until they are rebuilt.
   *  Static export cannot redirect, so they stay where they are and the
   *  navigation adopts them instead. */
  legacy?: { href: string; label: string }[];
};

export type NavSection = {
  label: string;
  /** "quiet" is for System: present, findable, and visually out of the way. */
  emphasis?: "default" | "quiet";
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Care Operations",
    items: [
      { href: "/home", label: "Home", icon: House },
      {
        href: "/care-gaps",
        label: "Care Gaps",
        icon: CircleAlert,
        // Live from the build's gold report, so it moves with the data.
        count: gold.open_gaps,
        countLabel: `${gold.open_gaps} patients with an open A1c gap`,
      },
      { href: "/patients", label: "Patients", icon: Users },
      // No count: there is no task data yet, and a number here would say
      // there is work queued when there is not.
      { href: "/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        href: "/analytics",
        label: "Analytics",
        icon: ChartNoAxesCombined,
        legacy: [{ href: "/overview", label: "Overview" }],
      },
      {
        // "Ask the Data", not "Ask AI". The page is a query builder over preset
        // questions and says so in its own footer (ADR-0012); notebook 05 then
        // tested a model against it and found one silently wrong answer. A nav
        // label promising AI would contradict the page it opens. When a model
        // ships, this becomes "Ask AI" here and nowhere else needs to change.
        href: "/ask",
        label: "Ask the Data",
        icon: MessageSquareText,
      },
    ],
  },
  {
    label: "Resources",
    items: [
      {
        href: "/learn",
        label: "Learn",
        icon: BookOpen,
        legacy: [{ href: "/", label: "Introduction" }],
      },
    ],
  },
  {
    label: "System",
    emphasis: "quiet",
    items: [
      {
        href: "/data-quality",
        label: "Data & Quality",
        icon: Database,
        legacy: [{ href: "/pipeline", label: "Pipeline" }],
      },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { href: "/help", label: "Help", icon: CircleHelp },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * The sections of the existing Pipeline page. These were sidebar subtasks;
 * they now live on Data & Quality, which links into each one. Every entry
 * must land on a section that answers to its name.
 */
export const PIPELINE_SECTIONS = [
  { href: "/pipeline#reconciliation", label: "Reconciliation", about: "Bronze equals Silver plus quarantine, for every table, on every run." },
  { href: "/pipeline#validate", label: "The six checks", about: "What each data quality check catches, and the operational cause behind it." },
  { href: "/pipeline#floor", label: "The A1c floor", about: "Why the plausibility range nearly threw away 951 good results." },
  { href: "/pipeline#quarantine", label: "Quarantine", about: "Every row held back from the report, with the reason." },
  { href: "/pipeline#identity", label: "Identity review", about: "Records that look like the same person, waiting for a human decision." },
  { href: "/pipeline#remediation", label: "Remediation", about: "Values corrected rather than rejected, with the original kept." },
];

/* ------------------------------------------------------------------ routing */

/** trailingSlash is on, so the same page arrives as "/patients" or "/patients/". */
export function normalise(pathname: string) {
  const p = pathname.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

function within(path: string, href: string) {
  // "/" would contain every path, so it only ever matches itself.
  if (href === "/") return path === "/";
  return path === href || path.startsWith(href + "/");
}

export type Location = {
  section?: NavSection;
  item?: NavItem;
  /** Set when the path is an older route the item has adopted. */
  legacy?: { href: string; label: string };
};

/** Which section and item a path belongs to. Empty for an unknown path. */
export function locate(pathname: string): Location {
  const path = normalise(pathname);
  const all: [NavSection | undefined, NavItem][] = [
    ...NAV_SECTIONS.flatMap((s) => s.items.map((i) => [s, i] as [NavSection, NavItem])),
    ...NAV_FOOTER.map((i) => [undefined, i] as [undefined, NavItem]),
  ];

  // Adopted routes first: "/" is Learn's, and must not fall through to anything.
  for (const [section, item] of all) {
    const legacy = item.legacy?.find((l) => within(path, l.href));
    if (legacy) return { section, item, legacy };
  }
  for (const [section, item] of all) {
    if (within(path, item.href)) return { section, item };
  }
  return {};
}
