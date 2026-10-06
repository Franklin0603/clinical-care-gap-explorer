import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown, Clock, ImageIcon, MonitorPlay, Play } from "lucide-react";

import { LEARN_MODULES, ILLUSTRATIONS, LearnVideo, moduleBySlug } from "@/lib/learn";
import { cn } from "cn";
import { Page } from "@/components/shell/Page";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Building blocks for the Learn pages. The same cards, borders and type as the
 * rest of the app; a little more room and imagery, no marketing.
 */

/** A module page: its header, its content, and the way to the next module. */
export function LearnModulePage({ slug, children }: { slug: string; children: ReactNode }) {
  const i = LEARN_MODULES.findIndex((m) => m.slug === slug);
  const m = LEARN_MODULES[i];
  const prev = LEARN_MODULES[i - 1], next = LEARN_MODULES[i + 1];
  return (
    <Page
      title={m.title}
      description={m.summary}
      actions={
        <Link href="/learn" className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <ArrowLeft className="size-3.5" aria-hidden /> All modules
        </Link>
      }
    >
      {children}
      <nav aria-label="Learn modules" className="grid gap-3 border-t pt-6 sm:grid-cols-2">
        {prev ? <PagerLink href={prev.href} dir="Previous" title={prev.title} /> : <span />}
        {next ? <PagerLink href={next.href} dir="Next" title={next.title} /> : <PagerLink href="/learn" dir="Back to" title="All modules" />}
      </nav>
    </Page>
  );
}

function PagerLink({ href, dir, title }: { href: string; dir: string; title: string }) {
  const forward = dir !== "Previous";
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-0.5 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        forward && "sm:col-start-2 sm:text-right",
      )}
    >
      <span className="text-xs text-muted-foreground">{dir}</span>
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", forward && "sm:justify-end")}>
        {!forward && <ArrowLeft className="size-3.5" aria-hidden />}
        {title}
        {forward && <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />}
      </span>
    </Link>
  );
}

/** A titled section of a module, optionally beside an illustration, and
 *  optionally numbered as one step of a sequence. */
export function LearnSection({
  id, title, children, figure, flip = false, step,
}: {
  id?: string;
  title: string;
  children: ReactNode;
  figure?: string;
  flip?: boolean;
  step?: number;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      {/* The illustration always takes the narrow column, on whichever side. */}
      <div
        className={cn(
          "grid items-start gap-6",
          figure && !flip && "lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]",
          figure && flip && "lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]",
        )}
      >
        <div className={cn("flex min-w-0 flex-col gap-3", flip && figure && "lg:order-2")}>
          {step ? (
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary tabular-nums" aria-hidden>
                {step}
              </span>
              <h2 className="text-lg font-semibold tracking-tight">
                <span className="sr-only">Step {step}: </span>{title}
              </h2>
            </div>
          ) : (
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          )}
          <div className="flex max-w-prose flex-col gap-3 text-sm leading-relaxed text-foreground/90">{children}</div>
        </div>
        {figure && <IllustrationSlot id={figure} />}
      </div>
    </section>
  );
}

/** Plain language first; the deeper explanation is one click away. */
export function GoDeeper({ title = "Go deeper", children }: { title?: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border bg-muted/30 open:bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-2 px-3 pb-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}

/**
 * An illustration: the image once it exists, at its own shape, and until
 * then a container of the right shape that says what will go there. Not a
 * stock image, and not empty.
 */
export function IllustrationSlot({ id, className }: { id: string; className?: string }) {
  const ill = ILLUSTRATIONS[id];
  if (!ill) return null;
  return (
    <figure className={cn("flex min-w-0 flex-col gap-2", className)}>
      {ill.src ? (
        // The illustrations carry their own light frame; no second border.
        <div className="overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation */}
          <img
            src={`${BASE}${ill.src}`}
            alt={ill.alt}
            width={ill.size?.width}
            height={ill.size?.height}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full max-w-full"
          />
        </div>
      ) : (
        <div
          className="flex w-full max-w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/40 p-4 text-center"
          style={{ aspectRatio: ill.ratio }}
          role="img"
          aria-label={`Illustration to come: ${ill.alt}`}
        >
          <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-xs font-medium text-muted-foreground">Illustration to come</span>
          <span className="max-w-xs text-xs leading-relaxed text-muted-foreground/80">{ill.brief}</span>
        </div>
      )}
      <figcaption className="text-xs leading-relaxed text-muted-foreground">{ill.caption ?? ill.alt}</figcaption>
    </figure>
  );
}

/** Where a screenshot of the app will go, sized like the app. */
export function ScreenshotSlot({ label }: { label: string }) {
  return (
    <div className="flex aspect-video w-full max-w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/30 p-4 text-center" role="img" aria-label={`Screenshot to come: ${label}`}>
      <MonitorPlay className="size-5 text-muted-foreground" aria-hidden />
      <span className="text-xs font-medium text-muted-foreground">Screenshot to come</span>
      <span className="text-xs text-muted-foreground/80">{label}</span>
    </div>
  );
}


/**
 * A video card: the player above, title, duration and description below.
 *
 * A native HTML5 player, so play, pause, volume, seeking, fullscreen and
 * keyboard control come from the browser and work everywhere. It never
 * autoplays, and preload="none" with a poster means nothing is downloaded
 * until someone presses play - three videos on one page cost three small
 * images. The frame is 16:9 and the video is letterboxed, never cropped or
 * stretched. Captions are attached when the video has them.
 *
 * Without a file, the card keeps its honest "coming soon" state.
 */
export function VideoCard({ video, compact = false }: { video: LearnVideo; compact?: boolean }) {
  const ready = Boolean(video.src);
  return (
    <article className="flex w-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-video w-full bg-muted">
        {ready ? (
          <video
            controls
            preload="none"
            playsInline
            poster={video.poster ? `${BASE}${video.poster}` : undefined}
            className="size-full bg-black object-contain"
            aria-label={`Video: ${video.title}`}
          >
            <source src={`${BASE}${video.src}`} type="video/mp4" />
            {video.captions && <track kind="captions" src={`${BASE}${video.captions}`} srcLang="en" label="English" />}
            Your browser cannot play this video.
          </video>
        ) : (
          <>
            {video.poster ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export
              <img src={`${BASE}${video.poster}`} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center" aria-hidden>
                <MonitorPlay className="size-8 text-primary/40" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-background/90 shadow-sm ring-1 ring-border" aria-hidden>
                <Play className="ml-0.5 size-5 text-muted-foreground" />
              </span>
            </div>
          </>
        )}
      </div>
      <div className={cn("flex flex-1 flex-col gap-2", compact ? "p-3" : "p-4")}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold">{video.title}</h3>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            {video.duration ? <><span className="sr-only">Length </span><span className="num">{video.duration}</span></> : "Coming soon"}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{video.description}</p>
        {ready && video.captions && <p className="mt-auto text-[11px] text-muted-foreground">Captions available in the player.</p>}
        {!ready && (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-auto inline-flex w-fit cursor-not-allowed items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground"
          >
            <Play className="size-3" aria-hidden /> Video coming soon
          </button>
        )}
      </div>
    </article>
  );
}

/** A small, quiet card linking to another part of the app. */
export function AppLink({ href, label, about }: { href: string; label: string; about: string }) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{about}</span>
      </span>
      <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export { moduleBySlug };
