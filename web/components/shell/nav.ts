/** The sidebar's structure. Pipeline is the only section with subtasks, because
 *  it is the only one with genuinely separate stages to walk through. */
export type NavItem = {
  href: string;
  label: string;
  icon: string;
  blurb: string;
  items?: { href: string; label: string }[];
};

export const NAV: NavItem[] = [
  {
    href: "/",
    label: "Introduction",
    icon: "BookOpen",
    blurb: "What this is and why it exists",
  },
  {
    href: "/overview",
    label: "Overview",
    icon: "LayoutDashboard",
    blurb: "The headline numbers and how they break down",
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: "Workflow",
    blurb: "Four stages, and the checks between them",
    /* Every entry must land on a section that answers to its name. Dropped
       "Ingest", which pointed at the stage-overview grid rather than a section
       of its own, and "Gold", whose anchor only ever hit a card in that grid. */
    items: [
      { href: "/pipeline#reconciliation", label: "Reconciliation" },
      { href: "/pipeline#validate", label: "The six checks" },
      { href: "/pipeline#floor", label: "The A1c floor" },
      { href: "/pipeline#quarantine", label: "Quarantine" },
      { href: "/pipeline#identity", label: "Identity review" },
      { href: "/pipeline#remediation", label: "Remediation" },
    ],
  },
  {
    href: "/patients",
    label: "Patients",
    icon: "Users",
    blurb: "The cohort, scoped by who is signed in",
  },
  {
    href: "/ask",
    label: "Ask the data",
    icon: "MessageSquare",
    blurb: "Questions answered with the SQL that ran",
  },
];
