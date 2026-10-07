import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, HeartPulse, Info } from "lucide-react";

import { cn } from "cn";

/**
 * Building blocks for the public landing page. The application's own tokens,
 * type and radius; more room and bigger product shots, and nothing else new.
 */

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** A width that every section shares, so edges line up down the page. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <HeartPulse className="size-4" aria-hidden />
      </span>
      <span className="text-sm font-semibold tracking-tight">Care Gap Explorer</span>
    </Link>
  );
}

/** The synthetic-data notice, as text: the landing page has no tooltip layer
 *  and the badge has to say it on its own anyway. */
export function SyntheticNote({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md border border-status-warning/30 bg-status-warning/10 px-1.5 py-0.5 text-xs font-medium text-status-warning", className)}>
      <Info className="size-3" aria-hidden />
      Synthetic data
    </span>
  );
}

/** Oversized section heading, with an optional eyebrow and lede. */
export function SectionHeading({ eyebrow, title, lede, center = false, id }: {
  eyebrow?: string; title: ReactNode; lede?: ReactNode; center?: boolean; id?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", center && "items-center text-center")}>
      {eyebrow && <p className="text-sm font-medium text-primary">{eyebrow}</p>}
      <h2 id={id} className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">{title}</h2>
      {lede && <p className="max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">{lede}</p>}
    </div>
  );
}

/** A real screenshot of the application in a quiet window frame. */
export function ProductFrame({ src, alt, width, height, label, className, priority = false }: {
  src: string; alt: string; width: number; height: number; label?: string; className?: string; priority?: boolean;
}) {
  return (
    <figure className={cn("overflow-hidden rounded-xl border bg-card shadow-[0_24px_60px_-24px_rgb(15_36_64/0.35)]", className)}>
      <div className="flex h-8 items-center gap-1.5 border-b bg-muted/60 px-3" aria-hidden>
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        {label && <span className="ml-3 truncate text-xs text-muted-foreground">{label}</span>}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation */}
      <img
        src={`${BASE}${src}`}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="block h-auto w-full max-w-full"
      />
    </figure>
  );
}

/** A text link with an arrow, for going deeper. */
export function MoreLink({ href, children, external = false }: { href: string; children: ReactNode; external?: boolean }) {
  const cls = "group inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  const inner = <>{children} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden /></>;
  return external
    ? <a href={href} className={cls}>{inner}</a>
    : <Link href={href} className={cls}>{inner}</Link>;
}
