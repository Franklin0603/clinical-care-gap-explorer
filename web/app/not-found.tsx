import Link from "next/link";
import { Button } from "@/components/ui/button";

/** G4: every failure path returns a plain sentence, never a stack trace. */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">That page does not exist</h1>
      <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
        Everything in the application is listed in the navigation. Nothing was
        lost and nothing went wrong.
      </p>
      <Button className="w-fit" render={<Link href="/home" />}>Go to Home</Button>
    </div>
  );
}
