"use client";

import { Button } from "@/components/ui/button";

/** G4 again, for a client-side failure. No stack trace reaches the viewer. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">This page could not be displayed</h1>
      <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
        Something went wrong while rendering it. The data behind this site is a
        static snapshot, so nothing has been changed or lost.
      </p>
      <Button variant="outline" className="w-fit" onClick={reset}>Try again</Button>
    </div>
  );
}
