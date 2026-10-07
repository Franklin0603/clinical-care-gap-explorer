import Link from "next/link";
import {
  ArrowRight, BadgeCheck, CalendarClock, CircleSlash, Database, FileText, FlaskConical, Layers, ListChecks, MonitorSmartphone,
  Rows3, Scale, ShieldCheck, Sigma, Stethoscope, UserRoundSearch, Users,
} from "lucide-react";

import { fmt, gold, recon } from "@/lib/data";
import { longDate } from "@/lib/dates";
import { LEARN_MODULES, videoById } from "@/lib/learn";
import { Button } from "@/components/ui/button";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { BASE, Container, Logo, MoreLink, ProductFrame, SectionHeading, SyntheticNote } from "@/components/landing/LandingParts";
import { TourButton, TourProvider } from "@/components/landing/TourDialog";

export const metadata = {
  title: { absolute: "Care Gap Explorer · Find the patients behind the care gap" },
  description:
    "An explainable A1C monitoring workflow on synthetic healthcare data: from population-level gaps to the evidence behind each patient. A portfolio project.",
};

/**
 * The public landing page. It introduces the product and sends the visitor
 * into it; it is not the application, so it sits outside the app shell, and
 * the project review lives inside the app, after the visitor has used it.
 *
 * Every figure is read from the pipeline's exports, like every other page.
 */

const asof = longDate(gold.asof);
const current = gold.cohort - gold.open_gaps;
const overdue = gold.open_gaps - gold.never_tested;
const sourcePatients = recon.find((r) => r.name === "patients")?.bronze ?? 0;
const quarantined = recon.reduce((n, r) => n + r.quarantined, 0);

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#learn", label: "Learn" },
  { href: "#case-study", label: "Case study" },
];

type Feature = { eyebrow: string; title: string; body: string; points: string[]; href: string; cta: string; img: string; w: number; h: number; alt: string };
const FEATURES: Feature[] = [
  {
    eyebrow: "Care Gaps", title: "Identify monitoring gaps",
    body: "Every patient with an open A1C gap, in one work queue: never tested first, then the longest overdue.",
    points: ["Filter by status, care setting, age and insulin", "Review any patient's evidence without leaving the list"],
    href: "/care-gaps", cta: "Open Care Gaps",
    img: "/img/learn/app-care-gaps.webp", w: 1600, h: 1099,
    alt: "Care Gaps: tabs for all, never tested and overdue, filters, and the list of open gaps with a Review button on each row.",
  },
  {
    eyebrow: "Patient workspace", title: "Understand the patient",
    body: "Why a patient has their status, with the evidence beside it: the latest A1C, every result on file, medications and procedures.",
    points: ["The care-gap assessment in plain words", "A1C history, testing per year, therapy"],
    href: "/patients", cta: "Open Patients",
    img: "/img/learn/app-patient.webp", w: 1578, h: 955,
    alt: "A patient workspace showing status, latest A1C, last seen and diabetes therapy, and the A1C monitoring status.",
  },
  {
    eyebrow: "Tasks", title: "Coordinate follow-up",
    body: "A follow-up task for each open gap: status, assignee, due date, notes and every change. Completing a task never changes the clinical status.",
    points: ["Review, outreach, scheduling, completion", "Demo workflow data, kept in your browser"],
    href: "/tasks", cta: "Open Tasks",
    img: "/img/learn/app-tasks.webp", w: 1397, h: 956,
    alt: "A follow-up task beside its clinical evidence, with status, assignee, due date, a workflow note and activity history.",
  },
  {
    eyebrow: "Analytics", title: "Explore the population",
    body: "How monitoring is going across the whole cohort, always with the denominator in view.",
    points: ["Coverage and the make-up of the gaps", "Gap rates by age band and care setting", "Testing over time and the spread of results"],
    href: "/analytics", cta: "Open Analytics",
    img: "/img/learn/app-analytics.webp", w: 1573, h: 959,
    alt: "Analytics: four figures, A1C testing over time, and donut charts for monitoring coverage and the make-up of open gaps.",
  },
  {
    eyebrow: "Ask AI", title: "Ask questions of the data",
    body: "Ask in plain words and get counts, patient lists and comparisons, then ask how the answer was calculated. Rule-based and computed in your browser, not a language model.",
    points: ["Follow-up questions on the last answer", "The population, filters and denominator behind every answer"],
    href: "/ask", cta: "Open Ask AI",
    img: "/img/learn/app-ask.webp", w: 1576, h: 963,
    alt: "Ask AI listing never-tested patients, follow-up suggestions, and how the answer was calculated.",
  },
  {
    eyebrow: "Data & Quality", title: "See how the numbers were produced",
    body: "The pipeline, the checks and the reconciliation behind every figure, computed from the same patient rows every page uses.",
    points: [`${gold.cohort} = ${current} + ${gold.open_gaps}, and ${gold.open_gaps} = ${gold.never_tested} + ${overdue}, checked on every build`, "Every data-quality check, with its result"],
    href: "/data-quality", cta: "Open Data & Quality",
    img: "/img/learn/app-data-quality.webp", w: 1600, h: 1216,
    alt: `Data & Quality: the reconciliation of ${gold.cohort} = ${current} + ${gold.open_gaps} and ${gold.open_gaps} = ${gold.never_tested} + ${overdue}, and the A1C monitoring measure.`,
  },
];

/** One picture per Learn module: what the module is about, not its video's
 *  title card, which is mostly empty at this size. */
const LEARN_IMAGES: Record<string, string> = {
  diabetes: "/img/learn/bloodstream.webp",
  "care-gaps": "/img/landing/learn-care-gaps.webp",
  "using-the-app": "/img/learn/app-care-gaps.webp",
  "care-teams": "/img/learn/app-patient.webp",
};

const PIPELINE = [
  { icon: Database, title: "Synthetic source", body: `Health records for ${fmt(sourcePatients)} synthetic patients.` },
  { icon: Layers, title: "Raw / Bronze", body: "A faithful copy, kept exactly as received." },
  { icon: FlaskConical, title: "Clean / Silver", body: `Checked and typed. ${fmt(quarantined)} problem rows set aside, each with a reason.` },
  { icon: Users, title: "Diabetes cohort", body: `${gold.cohort} patients with a recorded diabetes diagnosis, alive on the data date.` },
  { icon: Rows3, title: "A1C measure", body: "One row per patient: the latest A1C and the monitoring status." },
  { icon: MonitorSmartphone, title: "Care Gap Explorer", body: "The pages you use to find, review and follow up." },
];

const PRINCIPLES = [
  { icon: Rows3, title: "Patient-level measure", body: "One row per patient, so every count is a count of people." },
  { icon: Sigma, title: "Explicit denominator", body: `${gold.cohort} patients with diabetes, alive on the data date. Every rate divides by it.` },
  { icon: CalendarClock, title: "Fixed reporting date", body: `Measured on ${asof}, the day the data ends, so the answer does not drift.` },
  { icon: Scale, title: "Written definitions", body: "Current, overdue and never tested, with the 365-day boundary stated: 365 days old is current, 366 is overdue." },
  { icon: CircleSlash, title: "No patient dropped", body: `Patients without an A1C are kept. An inner join would silently remove all ${gold.never_tested}.` },
  { icon: ShieldCheck, title: "Data-quality checks", body: "Problem rows are quarantined with a reason, never quietly deleted." },
  { icon: BadgeCheck, title: "Reconciliation", body: "Every source table balances: source rows = clean rows + quarantined rows." },
];

export default function LandingPage() {
  return (
    <TourProvider>
      <Landing />
    </TourProvider>
  );
}

function Landing() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-2 focus:outline-ring">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
        <Container className="flex h-14 items-center gap-4">
          <Logo />
          <nav aria-label="Page sections" className="ml-4 hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <SyntheticNote className="hidden sm:inline-flex" />
            <Button render={<Link href="/home" />}>Open the app</Button>
          </div>
        </Container>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {/* 1 · Hero */}
        <section aria-labelledby="hero-title" className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[36rem] bg-[radial-gradient(60%_60%_at_50%_0%,var(--accent),transparent)]" />
          <Container className="relative flex flex-col items-center pt-16 pb-12 text-center sm:pt-24 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Stethoscope className="size-3.5 text-primary" aria-hidden />
              A1C monitoring for a diabetes population
            </p>
            <h1 id="hero-title" className="max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Find the patients behind the care gap.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
              Care Gap Explorer turns healthcare data into an explainable A1C monitoring workflow, from population-level
              gaps to the evidence behind each patient.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" className="h-11 px-5 text-base" render={<Link href="/home" />}>
                Explore Care Gap Explorer <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
              <TourButton />
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              <span className="num font-medium text-foreground">{gold.cohort}</span> patients ·{" "}
              <span className="num font-medium text-foreground">{gold.open_gaps}</span> open gaps · data through {asof} · synthetic data
            </p>
          </Container>

          {/* 2 · The product, large */}
          <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28">
            <ProductFrame
              src="/img/landing/app-home-full.webp"
              width={2400}
              height={1500}
              priority
              label="Care Gap Explorer · Home"
              alt={`Care Gap Explorer Home: ${gold.cohort} patients in the cohort, ${gold.open_gaps} open A1C gaps, ${gold.never_tested} never tested and ${current} current, above the first five patients needing attention.`}
            />
          </div>
        </section>

        {/* 3 · Why this matters */}
        <section id="why" aria-labelledby="why-title" className="scroll-mt-20 border-t bg-muted/30 py-20 sm:py-28">
          <Container className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
            <div className="flex flex-col gap-5">
              <SectionHeading id="why-title" eyebrow="Why this matters" title="A1C is how diabetes is followed over time. A missing one is easy to miss." />
              <div className="flex max-w-2xl flex-col gap-4 text-base leading-relaxed text-foreground/90">
                <p>
                  A1C is a blood test that reflects average blood glucose over roughly the past two to three months. Repeating
                  it is how a care team follows a patient&apos;s diabetes from one visit to the next.
                </p>
                <p>
                  When no recent result is on file, that monitoring has lapsed: a care gap. Across a whole population, finding
                  those patients means reading records one at a time, or a measure you can trust and explain.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <MoreLink href="/learn/diabetes">How A1C works</MoreLink>
                <MoreLink href="/learn/care-gaps">What counts as a care gap</MoreLink>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {[
                { s: "current" as const, n: current, d: "An A1C in the 365 days before the data date." },
                { s: "overdue" as const, n: overdue, d: "An earlier A1C, but none in the last 365 days." },
                { s: "never" as const, n: gold.never_tested, d: "No A1C anywhere in the available data." },
              ].map((x) => (
                <div key={x.s} className="flex items-center gap-4 rounded-xl border bg-card p-4">
                  <span className="num w-12 text-right text-3xl font-semibold tabular-nums">{x.n}</span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <GapStatusBadge status={x.s} className="w-fit" />
                    <span className="text-sm text-muted-foreground">{x.d}</span>
                  </div>
                </div>
              ))}
              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                {gold.cohort} patients, measured on {asof}. A monitoring status is not a diagnosis and does not determine treatment.
              </p>
            </div>
          </Container>
        </section>

        {/* 4 · Product capabilities */}
        <section id="product" aria-labelledby="product-title" className="scroll-mt-20 py-20 sm:py-28">
          <Container className="flex flex-col gap-12">
            <SectionHeading id="product-title" eyebrow="The product" title="One measure, six ways to work with it." lede="From the population to one patient and back, every page reads the same patient-level measure." />
            <div className="grid gap-6 lg:grid-cols-2">
              {FEATURES.map((f, i) => <FeaturePanel key={f.title} f={f} wide={i === 0 || i === 3} flip={i === 3} />)}
            </div>
          </Container>
        </section>

        {/* 5 · From data to decision */}
        <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 border-t bg-muted/30 py-20 sm:py-28">
          <Container className="flex flex-col gap-12">
            <SectionHeading id="how-title" eyebrow="How it works" title="From data to decision" lede="Six steps, each with one job. Each hands the next a smaller, cleaner set, until one row describes one patient." />
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {PIPELINE.map((p, i) => (
                <li key={p.title} className="relative flex flex-col gap-3 rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <p.icon className="size-4" aria-hidden />
                    </span>
                    <span className="num text-xs text-muted-foreground">Step {i + 1}</span>
                  </div>
                  <h3 className="text-base font-semibold leading-snug">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <MoreLink href="/data-quality">See the pipeline on Data &amp; Quality</MoreLink>
              <MoreLink href="/pipeline">Technical detail: checks, quarantine and remediation</MoreLink>
            </div>
          </Container>
        </section>

        {/* 6 · Built to be explainable */}
        <section id="explainable" aria-labelledby="explainable-title" className="scroll-mt-20 py-20 sm:py-28">
          <Container className="flex flex-col gap-12">
            <SectionHeading id="explainable-title" eyebrow="Built to be explainable" title="Every number can be traced back to patients." lede="The decisions that make a care-gap count trustworthy, written down and checked." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="flex flex-col gap-2.5 rounded-xl border bg-card p-5">
                  <p.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="text-base font-semibold">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              ))}
              <div className="flex flex-col justify-center gap-3 rounded-xl border border-primary/20 bg-accent p-5">
                <p className="text-xs font-medium tracking-wide text-accent-foreground uppercase">Checked on every build</p>
                <p className="num text-2xl font-semibold tabular-nums">{gold.cohort} = {current} + {gold.open_gaps}</p>
                <p className="num text-2xl font-semibold tabular-nums">{gold.open_gaps} = {gold.never_tested} + {overdue}</p>
                <p className="text-xs text-accent-foreground">cohort = current + open gaps; open gaps = never tested + overdue</p>
              </div>
            </div>
          </Container>
        </section>

        {/* 7 · Learn */}
        <section id="learn" aria-labelledby="learn-title" className="scroll-mt-20 border-t bg-muted/30 py-20 sm:py-28">
          <Container className="flex flex-col gap-12">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading id="learn-title" eyebrow="Learn" title="The clinical side, in plain language." lede="Four short modules and three one-minute videos, for healthcare professionals and engineers alike." />
              <MoreLink href="/learn">All of Learn</MoreLink>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {LEARN_MODULES.map((m) => {
                const v = m.video ? videoById(m.video) : undefined;
                const img = LEARN_IMAGES[m.slug];
                return (
                  <li key={m.slug} className="flex">
                    <Link href={m.href} className="group flex w-full flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none">
                      {/* eslint-disable-next-line @next/next/no-img-element -- static export, decorative */}
                      <img src={`${BASE}${img}`} alt="" loading="lazy" className="aspect-video w-full border-b object-cover object-top" />
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <h3 className="text-base font-semibold leading-snug">{m.title}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">{m.summary}</p>
                        <span className="mt-auto pt-2 text-xs font-medium text-muted-foreground">
                          {v?.duration ? `Module + ${v.duration} video` : "Module"}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Container>
        </section>

        {/* 8 · Technical case study */}
        <section id="case-study" aria-labelledby="case-title" className="scroll-mt-20 py-20 sm:py-28">
          <Container>
            <div className="grid items-center gap-10 overflow-hidden rounded-3xl bg-[oklch(0.24_0.05_255)] p-6 text-[oklch(0.96_0.01_240)] sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:p-14">
              <div className="flex flex-col gap-5">
                <p className="text-sm font-medium text-[oklch(0.82_0.09_190)]">Technical case study</p>
                <h2 id="case-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">The engineering behind the measure.</h2>
                <p className="text-base leading-relaxed text-[oklch(0.84_0.02_245)]">
                  Fourteen slides for data and analytics engineering teams: building the cohort, the join that keeps
                  never-tested patients, patient-level grain, the fixed reporting date, and the checks that reconcile every number.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="lg" className="h-11 bg-[oklch(0.96_0.01_240)] px-5 text-base text-[oklch(0.24_0.05_255)] hover:bg-white" render={<a href={`${BASE}/case-study/Care-Gap-Explorer-Case-Study.pdf`} />}>
                    <FileText aria-hidden /> View Technical Case Study
                  </Button>
                  <span className="text-sm text-[oklch(0.78_0.02_245)]">PDF · 14 slides</span>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
              <img
                src={`${BASE}/img/landing/case-study-cover.webp`}
                width={1600}
                height={900}
                loading="lazy"
                alt={`Cover slide: Care Gap Explorer, from healthcare data to actionable A1C monitoring gaps, with one dot per patient: ${current} current, ${overdue} overdue, ${gold.never_tested} never tested.`}
                className="h-auto w-full rounded-xl shadow-2xl ring-1 ring-white/10"
              />
            </div>
          </Container>
        </section>

        {/* 9 · Project context */}
        <section id="about" aria-labelledby="about-title" className="scroll-mt-20 border-t py-16 sm:py-20">
          <Container className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <h2 id="about-title" className="text-2xl font-semibold tracking-tight">About this project</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">What Care Gap Explorer is, and what it is not.</p>
            </div>
            <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {[
                { icon: UserRoundSearch, t: "A portfolio demonstration", d: "Built to show healthcare data engineering and product work end to end." },
                { icon: Database, t: "Synthetic healthcare data", d: `Generated records (Synthea). No real patient appears anywhere; data through ${asof}.` },
                { icon: Stethoscope, t: "Not clinical decision support", d: "Not intended for diagnosis or treatment, and makes no recommendation for any person." },
                { icon: ListChecks, t: "Workflow is a demonstration", d: "Tasks, notes and assignments are demo data, saved only in your browser." },
              ].map((x) => (
                <li key={x.t} className="flex gap-3">
                  <x.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold">{x.t}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{x.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* 10 · Final CTA */}
        <section aria-labelledby="cta-title" className="border-t bg-muted/40 py-24 sm:py-32">
          <Container className="flex flex-col items-center gap-6 text-center">
            <h2 id="cta-title" className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">Explore Care Gap Explorer</h2>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty">
              See how healthcare data moves from population-level monitoring gaps to patient-level evidence, workflow and analytics.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" className="h-11 px-5 text-base" render={<Link href="/home" />}>
                Open Care Gap Explorer <ArrowRight data-icon="inline-end" aria-hidden />
              </Button>
              <Button size="lg" variant="outline" className="h-11 bg-card px-5 text-base" render={<Link href="/learn" />}>
                Learn about the project
              </Button>
            </div>
          </Container>
        </section>
      </main>

      <footer className="border-t py-10">
        <Container className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              A portfolio project on synthetic healthcare data. Not for clinical use.
            </p>
            <SyntheticNote className="w-fit" />
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
            {[
              ["/home", "Open the app"], ["/care-gaps", "Care Gaps"], ["/analytics", "Analytics"],
              ["/learn", "Learn"], ["/data-quality", "Data & Quality"], ["/help", "Help"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="rounded-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">{label}</Link>
            ))}
          </nav>
        </Container>
      </footer>
    </div>
  );
}

/** A large product panel: words, a link, and the real screen. Wide panels sit
 *  side by side with their screenshot; half-width ones stack it underneath. */
function FeaturePanel({ f, wide, flip }: { f: Feature; wide: boolean; flip: boolean }) {
  return (
    <article
      className={
        wide
          ? "grid items-center gap-8 overflow-hidden rounded-3xl border bg-muted/40 p-6 sm:p-10 lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
          : "flex flex-col gap-8 overflow-hidden rounded-3xl border bg-muted/40 p-6 sm:p-10"
      }
    >
      <div className={wide && flip ? "flex flex-col gap-4 lg:order-2" : "flex flex-col gap-4"}>
        <p className="text-sm font-medium text-primary">{f.eyebrow}</p>
        <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{f.title}</h3>
        <p className="text-base leading-relaxed text-muted-foreground">{f.body}</p>
        <ul className="flex flex-col gap-1.5 text-sm text-foreground/90">
          {f.points.map((p) => (
            <li key={p} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{p}</li>
          ))}
        </ul>
        <MoreLink href={f.href}>{f.cta}</MoreLink>
      </div>
      <ProductFrame src={f.img} width={f.w} height={f.h} alt={f.alt} label={`Care Gap Explorer · ${f.eyebrow}`} className={wide ? "" : "mt-auto"} />
    </article>
  );
}
