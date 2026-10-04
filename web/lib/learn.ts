/**
 * The Learn area's modules, as data.
 *
 * Four modules are planned. None is written yet, so each says so and points at
 * whatever already covers part of it - most of the material exists, scattered
 * across the Introduction, the clinical concepts and the pipeline pages. When a
 * module is written it gets a route and `href`; the Learn page needs no change.
 */

export type LearnModule = {
  slug: string;
  title: string;
  summary: string;
  /** Set once the module exists as its own page. */
  href?: string;
  /** Existing pages that already cover part of it. */
  today: { href: string; label: string }[];
};

export const LEARN_MODULES: LearnModule[] = [
  {
    slug: "diabetes",
    title: "Learn about diabetes",
    summary:
      "What type 2 diabetes is, what an A1c measures, and why it is the test that defines a care gap rather than a single glucose reading.",
    today: [{ href: "/", label: "Clinical concepts, on the Introduction" }],
  },
  {
    slug: "why-gaps-matter",
    title: "Why A1c gaps matter",
    summary:
      "What happens when a diabetic patient goes a year without an A1c, and why a missed patient costs more than a wasted call.",
    today: [{ href: "/", label: "Introduction" }],
  },
  {
    slug: "using-the-app",
    title: "Learn how to use the app",
    summary:
      "Finding the patients who need attention, opening a patient, and reading what each page can and cannot tell you.",
    today: [{ href: "/help", label: "Help" }],
  },
  {
    slug: "the-data",
    title: "Understand the data",
    summary:
      "Where the data comes from, how it is checked before it reaches a list, and the questions it cannot answer at all.",
    today: [
      { href: "/data-quality", label: "Data & Quality" },
      { href: "/pipeline", label: "Pipeline" },
    ],
  },
];
