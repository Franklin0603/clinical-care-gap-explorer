"use client";

/** G4 again, for a client-side failure. No stack trace reaches the viewer. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-24">
      <h1 className="text-2xl font-semibold tracking-tight">This page could not be displayed</h1>
      <p className="mt-3 max-w-lg text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        Something went wrong while rendering it. The data behind this site is a
        static snapshot, so nothing has been changed or lost.
      </p>
      <button onClick={reset} className="mt-6 text-sm font-medium" style={{ color: "var(--blue)" }}>
        Try again
      </button>
    </div>
  );
}
