import Link from "next/link";

/** G4: every failure path returns a plain sentence, never a stack trace (V5.10). */
export default function NotFound() {
  return (
    <div className="py-24">
      <h1 className="text-2xl font-semibold tracking-tight">That page does not exist</h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        There are two pages here: the overview, and the pipeline and data quality
        walkthrough. Nothing was lost and nothing went wrong.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm font-medium" style={{ color: "var(--blue)" }}>
        Go to the overview
      </Link>
    </div>
  );
}
