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
    blurb: "Five stages, and the checks between them",
    items: [
      { href: "/pipeline#ingest", label: "Ingest" },
      { href: "/pipeline#corrupt", label: "Inject defects" },
      { href: "/pipeline#validate", label: "Validate" },
      { href: "/pipeline#quarantine", label: "Quarantine" },
      { href: "/pipeline#identity", label: "Identity review" },
      { href: "/pipeline#remediation", label: "Remediation" },
      { href: "/pipeline#gold", label: "Gold" },
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
