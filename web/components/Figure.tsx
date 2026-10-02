/**
 * A chart the pipeline drew, with its caption.
 *
 * These come from the notebooks, not from this app: they are rendered by
 * matplotlib against the warehouse and committed, so they carry the same
 * numbers as everything else and move when the pipeline is re-run. They sit
 * here because they make arguments the live Recharts panels do not - a cohort
 * funnel, a join that deletes patients - and those arguments are the point of
 * the project.
 *
 * The figures have light backgrounds baked in, so each one is contained on its
 * own near-white panel rather than let loose on a page that may be in dark mode.
 */
export function Figure({
  src, alt, caption, source,
}: {
  src: string;
  alt: string;
  caption: string;
  source?: string;
}) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border bg-[#fcfbf9] p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}/img/${src}`} alt={alt} className="w-full rounded-lg" />
      </div>
      <figcaption className="text-xs leading-relaxed text-muted-foreground">
        {caption}
        {source && <span className="ml-1 opacity-70">({source})</span>}
      </figcaption>
    </figure>
  );
}
