"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, FileText, LayoutDashboard, Pause, Play, PlayCircle } from "lucide-react";

import { cn } from "cn";
import { gold } from "@/lib/data";
import { longDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GapStatusBadge } from "@/components/GapStatusBadge";
import { BASE } from "./LandingParts";

/**
 * "Take a tour": a six-slide orientation in a centred modal, opened only from
 * the landing-page hero. Quick orientation, not a replacement for Learn or the
 * case study: each slide links to where the subject is covered properly.
 *
 * Slides advance every seven seconds. Any manual move (previous, next, a
 * progress marker, a workflow step) pauses that, so the visitor has time to
 * read; Play resumes it. It stops on the last slide rather than looping. With
 * reduced motion requested, the tour opens paused, slides change without
 * animation and numbers appear at their value.
 *
 * Every figure comes from the pipeline's gold report.
 */

const INTERVAL = 7000;
const TICK = 100;
const CASE_STUDY = `${BASE}/case-study/Care-Gap-Explorer-Case-Study.pdf`;

const current = gold.cohort - gold.open_gaps;
const overdue = gold.open_gaps - gold.never_tested;
const asof = longDate(gold.asof);

/* ------------------------------------------------------------ reduced motion */

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const m = window.matchMedia(MOTION_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia(MOTION_QUERY).matches, () => false);
}

/** Counts up to `value` once when shown; the value itself under reduced motion. */
function CountUp({ value, reduced }: { value: number; reduced: boolean }) {
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <span className="num tabular-nums">{reduced ? value : shown}</span>;
}

/* ------------------------------------------------------------------ slides */

type SlideProps = { reduced: boolean; playing: boolean; pause: () => void };
type Slide = { id: string; eyebrow: string; title: string; render: (p: SlideProps) => ReactNode };

function Shot({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation
    <img src={`${BASE}${src}`} alt={alt} className={cn("block h-auto w-full rounded-lg border bg-card shadow-md", className)} />
  );
}

function TourLink({ href, children, external = false }: { href: string; children: ReactNode; external?: boolean }) {
  const cls = "group inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const body = <>{children} <ArrowRight className="size-3.5" aria-hidden /></>;
  return external ? <a href={href} className={cls}>{body}</a> : <Link href={href} className={cls}>{body}</Link>;
}

function TextBlock({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">{eyebrow}</p>
      <h3 className="text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">{title}</h3>
      <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed text-foreground/85">{children}</div>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    id: "intro", eyebrow: "Care Gap Explorer", title: "Find the patients behind the care gap.",
    render: ({ reduced }) => (
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <TextBlock eyebrow="Care Gap Explorer" title="Find the patients behind the care gap.">
          <p>
            Care Gap Explorer turns healthcare data into an explainable A1C monitoring workflow, from population-level gaps
            to the evidence behind each patient.
          </p>
          <dl className="grid grid-cols-2 gap-2.5">
            {[
              [gold.cohort, "patients"], [gold.open_gaps, "open A1C gaps"],
              [gold.never_tested, "never tested"], [current, "current"],
            ].map(([n, l]) => (
              <div key={l} className="flex flex-col rounded-lg border bg-muted/40 px-3 py-2.5">
                <dt className="order-2 text-xs text-muted-foreground">{l}</dt>
                <dd className="order-1 text-2xl font-semibold"><CountUp value={n as number} reduced={reduced} /></dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">Synthetic healthcare data · Data through {asof}</p>
        </TextBlock>
        <Shot
          src="/img/landing/app-home-full.webp"
          alt={`Care Gap Explorer Home: ${gold.cohort} patients, ${gold.open_gaps} open A1C gaps, ${gold.never_tested} never tested and ${current} current, above the first patients needing attention.`}
        />
      </div>
    ),
  },
  {
    id: "diabetes", eyebrow: "Diabetes basics", title: "Glucose, insulin and diabetes.",
    render: () => (
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <TextBlock eyebrow="Diabetes basics" title="Glucose, insulin and diabetes.">
          <p>
            Glucose travels through the bloodstream and provides energy for the body&apos;s cells. Insulin helps glucose
            move from the bloodstream into those cells.
          </p>
          <p>Diabetes affects how the body regulates glucose.</p>
          <TourLink href="/learn/diabetes">Learn about diabetes</TourLink>
        </TextBlock>
        <figure className="flex flex-col gap-2">
          <Shot
            src="/img/learn/insulin.webp"
            alt="Two panels: insulin approaching a receptor on a cell surface, then the receptor open and glucose moving into the cell."
            className="border-0 shadow-none"
          />
          <figcaption className="text-xs text-muted-foreground">
            Before: glucose waits outside the cell. After: insulin binds to its receptor and glucose moves in.
          </figcaption>
        </figure>
      </div>
    ),
  },
  {
    id: "a1c", eyebrow: "Understanding A1C", title: "A1C helps show glucose exposure over time.",
    render: () => (
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <TextBlock eyebrow="Understanding A1C" title="A1C helps show glucose exposure over time.">
          <p>
            Some glucose attaches to hemoglobin inside red blood cells. An A1C test measures the percentage of hemoglobin
            with glucose attached, providing information about glucose exposure over roughly the previous two to three months.
          </p>
          <TourLink href="/learn/diabetes#a1c">Learn how A1C works</TourLink>
        </TextBlock>
        <figure className="flex flex-col gap-2">
          <Shot
            src="/img/learn/red-cells.webp"
            alt="Red blood cells along a timeline, collecting more glucose on their hemoglobin, with one cell magnified."
            className="border-0 shadow-none"
          />
          <figcaption className="text-xs text-muted-foreground">
            Over a red cell&apos;s life, about 120 days, more glucose attaches to its hemoglobin.
          </figcaption>
        </figure>
      </div>
    ),
  },
  {
    id: "gap", eyebrow: "A1C monitoring", title: "Who may be missing current monitoring?",
    render: ({ reduced }) => (
      <div className="flex flex-col gap-6">
        <TextBlock eyebrow="A1C monitoring" title="Who may be missing current monitoring?">
          <p>Every patient is checked against the same 365-day window, ending on the fixed data date, {asof}.</p>
        </TextBlock>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { s: "current" as const, n: current, d: "A qualifying A1C result exists within the 365 days before the fixed data date." },
            { s: "overdue" as const, n: overdue, d: "An earlier A1C exists, but none within the previous 365 days." },
            { s: "never" as const, n: gold.never_tested, d: "No A1C result appears anywhere in the available data." },
          ].map((x) => (
            <div key={x.s} className={cn("flex flex-col gap-2 rounded-xl border p-4", x.s === "current" ? "bg-status-success/5" : "bg-status-danger/5")}>
              <GapStatusBadge status={x.s} className="w-fit" />
              <p className="text-3xl font-semibold"><CountUp value={x.n} reduced={reduced} /> <span className="text-sm font-normal text-muted-foreground">patients</span></p>
              <p className="text-sm leading-relaxed text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-status-danger/25 bg-status-danger/5 px-4 py-3 text-center">
          <span className="text-lg font-semibold"><CountUp value={gold.open_gaps} reduced={reduced} /> open gaps</span>
          <span className="text-lg text-muted-foreground" aria-hidden>=</span>
          <span className="text-lg font-semibold">{gold.never_tested} never tested</span>
          <span className="text-lg text-muted-foreground" aria-hidden>+</span>
          <span className="text-lg font-semibold">{overdue} overdue</span>
          <span className="sr-only">: {gold.open_gaps} open gaps equals {gold.never_tested} never tested plus {overdue} overdue.</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted-foreground">
            These are monitoring statuses under this application&apos;s measure definition. They are not diagnoses and do not determine treatment.
          </p>
          <TourLink href="/learn/care-gaps">Understand A1C care gaps</TourLink>
        </div>
      </div>
    ),
  },
  {
    id: "workflow", eyebrow: "From population to patient", title: "One measure. Multiple ways to work with it.",
    render: (p) => <WorkflowSlide {...p} />,
  },
  {
    id: "explore", eyebrow: "Your turn", title: "Explore Care Gap Explorer.",
    render: () => (
      <div className="flex flex-col gap-6">
        <TextBlock eyebrow="Your turn" title="Explore Care Gap Explorer.">
          <p>
            Follow a monitoring gap from the population level to the evidence behind an individual patient, or explore the
            healthcare and engineering decisions behind the project.
          </p>
        </TextBlock>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button size="lg" className="h-10 px-4" render={<Link href="/home" />}>
            Open Care Gap Explorer <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
          <TourLink href="/learn/diabetes#a1c">Learn about A1C</TourLink>
          <TourLink href={CASE_STUDY} external>View Technical Case Study</TourLink>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: LayoutDashboard, t: "Explore the app", d: "Care gaps, patients, tasks and analytics", href: "/home", ext: false },
            { icon: BookOpen, t: "Learn", d: "Diabetes, A1C and monitoring gaps", href: "/learn", ext: false },
            { icon: FileText, t: "Technical case study", d: "Data pipeline, measure design and engineering decisions", href: CASE_STUDY, ext: true },
          ].map((c) => {
            const inner = (
              <>
                <c.icon className="size-5 text-primary" aria-hidden />
                <span className="text-xs font-semibold tracking-[0.1em] uppercase">{c.t}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{c.d}</span>
              </>
            );
            const cls = "flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
            return <li key={c.t}>{c.ext ? <a href={c.href} className={cls}>{inner}</a> : <Link href={c.href} className={cls}>{inner}</Link>}</li>;
          })}
        </ul>
        <p className="text-xs text-muted-foreground">Portfolio demonstration · Synthetic healthcare data · Not clinical decision support</p>
      </div>
    ),
  },
];

const STEPS = [
  { name: "Care Gaps", what: "Identify patients with open monitoring gaps.", img: "/img/learn/app-care-gaps.webp",
    alt: "Care Gaps: the list of patients with an open A1C gap, with filters and a Review button on each row." },
  { name: "Patient Workspace", what: "Review the evidence behind an individual patient's status.", img: "/img/learn/app-patient.webp",
    alt: "A patient workspace: status, latest A1C, last seen, diabetes therapy and the A1C monitoring status." },
  { name: "Tasks", what: "Demonstrate how review and follow-up could be coordinated.", img: "/img/learn/app-tasks.webp",
    alt: "A follow-up task beside its clinical evidence, with status, assignee, due date and activity." },
  { name: "Analytics", what: "Explore monitoring patterns across the population.", img: "/img/learn/app-analytics.webp",
    alt: "Analytics: A1C testing over time, monitoring coverage and the make-up of open gaps." },
  { name: "Ask AI", what: "Ask questions about the synthetic cohort and inspect how answers were calculated.", img: "/img/learn/app-ask.webp",
    alt: "Ask AI listing never-tested patients, with how the answer was calculated." },
];

/** The workflow as a list of steps beside the matching real screen. While the
 *  tour plays, the screen crossfades through the first steps; choosing a
 *  step shows its screen and pauses the tour. */
function WorkflowSlide({ reduced, playing, pause }: SlideProps) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!playing || reduced) return;
    const t = setInterval(() => setActive((a) => (a + 1) % 3), 2400);
    return () => clearInterval(t);
  }, [playing, reduced]);

  return (
    <div className="grid items-start gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
      <div className="flex flex-col gap-5">
        <TextBlock eyebrow="From population to patient" title="One measure. Multiple ways to work with it.">
          <span className="sr-only">Five areas of the application, in the order a review moves through them.</span>
        </TextBlock>
        <ol className="flex flex-col">
          {STEPS.map((s, i) => (
            <li key={s.name} className="flex gap-3">
              <div className="flex flex-col items-center" aria-hidden>
                <span className={cn("mt-2.5 size-2.5 shrink-0 rounded-full border-2", i === active ? "border-primary bg-primary" : "border-border bg-background")} />
                {i < STEPS.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <button
                type="button"
                onClick={() => { setActive(i); pause(); }}
                aria-pressed={i === active}
                className={cn(
                  "mb-1 flex flex-1 flex-col rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
                  i === active && "bg-accent",
                )}
              >
                <span className="text-sm font-semibold">{s.name}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{s.what}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="relative grid">
        {STEPS.map((s, i) => (
          <Shot
            key={s.name}
            src={s.img}
            alt={i === active ? s.alt : ""}
            className={cn(
              "col-start-1 row-start-1",
              !reduced && "transition-opacity duration-500",
              i === active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- dialog */

export function TourButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" variant="outline" className={cn("h-11 bg-card px-5 text-base", className)} />}>
        <PlayCircle data-icon="inline-start" aria-hidden /> Take a tour
      </DialogTrigger>
      {/* Mounted only while open, so every opening starts at slide one. */}
      {open && <Tour />}
    </Dialog>
  );
}

function Tour() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [elapsed, setElapsed] = useState(0);
  const last = SLIDES.length - 1;

  // The clock lives in refs so one tick makes exactly one change, even when
  // React runs an updater twice in development.
  const indexRef = useRef(0);
  const elapsedRef = useRef(0);

  const go = useCallback((i: number, manual: boolean) => {
    const next = Math.max(0, Math.min(last, i));
    indexRef.current = next;
    elapsedRef.current = 0;
    setIndex(next);
    setElapsed(0);
    if (manual) setPlaying(false);
  }, [last]);

  // Advance every INTERVAL while playing; stop on the last slide.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      elapsedRef.current += TICK;
      if (elapsedRef.current >= INTERVAL) {
        if (indexRef.current >= last) {
          elapsedRef.current = INTERVAL;
          setPlaying(false);
        } else {
          indexRef.current += 1;
          elapsedRef.current = 0;
          setIndex(indexRef.current);
        }
      }
      setElapsed(elapsedRef.current);
    }, TICK);
    return () => clearInterval(t);
  }, [playing, last]);

  const toggle = () => {
    // Play at the end of the tour starts it again from the beginning.
    if (!playing && index === last && elapsed >= INTERVAL) { go(0, false); setPlaying(true); return; }
    setPlaying((p) => !p);
  };

  const slide = SLIDES[index];

  return (
    <DialogContent
      aria-modal="true"
      overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[2px]"
      className="flex max-h-[85vh] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border bg-popover p-0 shadow-2xl ring-0 sm:max-w-[min(64rem,calc(100%-3rem))]"
      onKeyDown={(e) => {
        // Arrow keys move between slides, unless a text field has focus.
        if ((e.target as HTMLElement).closest("input, textarea")) return;
        if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1, true); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1, true); }
      }}
    >
      <div className="flex flex-col gap-3 border-b px-5 pt-4 pb-3 pr-12 sm:px-7">
        <div className="flex items-baseline gap-3">
          <DialogTitle className="text-base font-semibold">Take a tour</DialogTitle>
          <span className="num text-sm text-muted-foreground" aria-hidden>{index + 1} of {SLIDES.length}</span>
        </div>
        <DialogDescription className="sr-only">
          A six-slide introduction to Care Gap Explorer. Slides advance every seven seconds; use Pause to stop, and Previous or Next to move.
        </DialogDescription>
        <nav aria-label="Tour slides">
          <ol className="flex gap-1.5">
            {SLIDES.map((s, i) => {
              const fill = i < index ? 100 : i > index ? 0 : playing || elapsed > 0 ? (elapsed / INTERVAL) * 100 : 100;
              return (
                <li key={s.id} className="flex-1">
                  <button
                    type="button"
                    onClick={() => go(i, true)}
                    aria-label={`Slide ${i + 1} of ${SLIDES.length}: ${s.eyebrow}`}
                    aria-current={i === index ? "step" : undefined}
                    className="group flex h-6 w-full items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  >
                    <span className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-border", i === index && "h-2")}>
                      {/* Seen slides in a lighter blue, so the current one stands out. */}
                      <span
                        className={cn("absolute inset-y-0 left-0 rounded-full", i < index ? "bg-primary/35" : "bg-primary", !reduced && "transition-[width] duration-100 ease-linear")}
                        style={{ width: `${fill}%` }}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8"
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${SLIDES.length}: ${slide.title}`}
        aria-live={playing ? "off" : "polite"}
      >
        <div
          key={slide.id}
          className={cn(!reduced && "animate-in fade-in slide-in-from-bottom-2 duration-[400ms] ease-out")}
        >
          {slide.render({ reduced, playing, pause: () => setPlaying(false) })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-4 py-3 sm:px-7">
        <Button variant="ghost" className="h-9" onClick={() => go(index - 1, true)} disabled={index === 0}>
          <ArrowLeft data-icon="inline-start" aria-hidden /> Previous
        </Button>
        <Button variant="outline" className="h-9 min-w-24" onClick={toggle} aria-label={playing ? "Pause the tour" : "Play the tour"}>
          {playing ? <Pause data-icon="inline-start" aria-hidden /> : <Play data-icon="inline-start" aria-hidden />}
          {playing ? "Pause" : "Play"}
        </Button>
        <Button className="h-9" onClick={() => go(index + 1, true)} disabled={index === last}>
          Next <ArrowRight data-icon="inline-end" aria-hidden />
        </Button>
      </div>
    </DialogContent>
  );
}
