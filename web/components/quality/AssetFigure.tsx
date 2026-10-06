import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ReactNode } from "react";

/**
 * A supplied image, if it exists, read at build time.
 *
 * The page looks for the file under public/img/ (beside the project's other
 * images) with any of the usual
 * extensions. When it is there, it renders at its natural aspect ratio -
 * width 100%, height auto, never stretched - with its intrinsic size read
 * from the file so the page does not jump as it loads. When it is not there,
 * the figure renders `fallback` (or nothing), so a missing asset is never a
 * broken image on the public page.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const EXTS = ["png", "webp", "jpg", "jpeg"];

function find(name: string) {
  for (const ext of EXTS) {
    const file = `${name}.${ext}`;
    const path = join(process.cwd(), "public", "img", file);
    if (existsSync(path)) return { file, path, ext };
  }
  return null;
}

/** Width and height from a PNG's header; other formats size from CSS alone. */
function pngSize(path: string): { width: number; height: number } | null {
  const b = readFileSync(path);
  if (b.length < 24 || b.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

export function AssetFigure({
  name, alt, caption, fallback = null, className,
}: {
  name: string;
  alt: string;
  caption?: ReactNode;
  fallback?: ReactNode;
  className?: string;
}) {
  const asset = find(name);
  if (!asset) return <>{fallback}</>;
  const size = asset.ext === "png" ? pngSize(asset.path) : null;
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-xl border bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation */}
        <img
          src={`${BASE}/img/${asset.file}`}
          alt={alt}
          width={size?.width}
          height={size?.height}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full max-w-full"
        />
      </div>
      {caption && <figcaption className="mt-2 text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}
