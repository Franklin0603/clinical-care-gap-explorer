"use client";

import { createContext, useCallback, useContext, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { CircleAlert, CircleCheck, Copy, ShieldAlert } from "lucide-react";

import {
  EMPTY_ANSWERS, MAX_TEXT, REVIEW_ROLES, SCALES, STANDOUT_AREAS, buildSubmission, reviewAsText, sendReview,
  validateReview, type ReviewAnswers, type ReviewErrors, type ReviewSubmission, type SendResult,
} from "@/lib/review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * "Review this project", inside the application: a centred modal over the
 * page the visitor was using. It opens only when they choose it from the
 * sidebar, never on its own, and nothing in the app depends on it.
 *
 * The modal (Base UI Dialog) moves focus in, traps it, locks the page's
 * scroll, closes on Escape or a backdrop click, and hands focus back to the
 * Review button. The draft lives here, outside the modal's content, so an
 * accidental close does not throw away what was typed.
 */

const ReviewContext = createContext<{ show: (from: HTMLElement | null) => void }>({ show: () => {} });
export const useReview = () => useContext(ReviewContext);

export function ReviewProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState("/");
  const opener = useRef<HTMLElement | null>(null);

  const show = useCallback((from: HTMLElement | null) => {
    opener.current = from;
    setPage(pathname);
    setOpen(true);
  }, [pathname]);

  return (
    <ReviewContext.Provider value={{ show }}>
      {children}
      <ReviewDialog open={open} onOpenChange={setOpen} page={page} returnFocus={opener} />
    </ReviewContext.Provider>
  );
}

type Phase =
  | { kind: "form" }
  | { kind: "sending" }
  | { kind: "result"; result: SendResult; submission: ReviewSubmission };

function ReviewDialog({ open, onOpenChange, page, returnFocus }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: string;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const [answers, setAnswers] = useState<ReviewAnswers>(EMPTY_ANSWERS);
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [trap, setTrap] = useState("");
  const set = <K extends keyof ReviewAnswers>(k: K, v: ReviewAnswers[K]) => {
    setAnswers((a) => ({ ...a, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const ids = useId();
  const fid = (k: string) => `${ids}-${k}`;

  // A review that reached its end (sent, or shown as not sent) starts over
  // next time; one that failed keeps its answers for another try.
  const finished = phase.kind === "result" && (phase.result.ok || phase.result.reason === "not-configured");
  const change = (next: boolean) => {
    onOpenChange(next);
    if (next) return;
    if (finished) { setAnswers(EMPTY_ANSWERS); setErrors({}); }
    if (phase.kind === "result") setPhase({ kind: "form" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateReview(answers);
    setErrors(found);
    const first = (Object.keys(found) as (keyof ReviewAnswers)[])[0];
    if (first) {
      document.getElementById(fid(first))?.focus();
      return;
    }
    const submission = buildSubmission(answers, page);
    setPhase({ kind: "sending" });
    setPhase({ kind: "result", result: await sendReview(submission, undefined, undefined, trap), submission });
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  const inResult = phase.kind === "result";

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        finalFocus={returnFocus}
        overlayClassName="bg-black/40 supports-backdrop-filter:backdrop-blur-[2px]"
        className="flex max-h-[85vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border bg-popover p-0 shadow-xl ring-0 sm:max-w-[40rem]"
      >
        {inResult ? (
          <ResultPanel phase={phase} onRetry={() => setPhase({ kind: "form" })} />
        ) : (
          <>
            <div className="border-b px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg leading-tight font-semibold tracking-tight">Review this project</DialogTitle>
              <DialogDescription className="mt-1.5 leading-relaxed">
                Your feedback will help improve Care Gap Explorer.
              </DialogDescription>
              <p className="mt-2 text-xs font-medium text-muted-foreground">5 short questions · about 2 minutes</p>
            </div>

            <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
              {/* Spam trap: hidden from people and from assistive technology. */}
              <input
                type="text"
                name="_gotcha"
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] size-px opacity-0"
              />
              <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto overscroll-contain px-6 py-5">
                {errorCount > 0 && (
                  <p role="alert" className="flex gap-2 rounded-lg border border-status-danger/30 bg-status-danger/5 p-3 text-sm text-status-danger">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {errorCount === 1 ? "One answer needs attention before sending." : `${errorCount} answers need attention before sending.`}
                  </p>
                )}

                <Choice
                  n={1} name="role" label="What best describes you?"
                  options={REVIEW_ROLES} value={answers.role} onChange={(v) => set("role", v)}
                  firstId={fid("role")} error={errors.role} errorId={fid("role-error")}
                />
                <Rating
                  n={2} name="clarity" label="How clear was the purpose of Care Gap Explorer?"
                  ends={SCALES.clarity} value={answers.clarity} onChange={(v) => set("clarity", v)}
                  firstId={fid("clarity")} error={errors.clarity} errorId={fid("clarity-error")}
                />
                <Rating
                  n={3} name="usefulness" label="How useful or relevant did you find the project?"
                  ends={SCALES.usefulness} value={answers.usefulness} onChange={(v) => set("usefulness", v)}
                  firstId={fid("usefulness")} error={errors.usefulness} errorId={fid("usefulness-error")}
                />
                <Choice
                  n={4} name="standout" label="What part of the project stood out to you most?"
                  options={STANDOUT_AREAS} value={answers.standout} onChange={(v) => set("standout", v)}
                  firstId={fid("standout")} error={errors.standout} errorId={fid("standout-error")}
                />

                <div className="flex flex-col gap-2">
                  <label htmlFor={fid("improve")} className="text-sm font-medium leading-snug">
                    5. What would you improve or add? <Optional />
                  </label>
                  <Textarea
                    id={fid("improve")}
                    rows={3}
                    maxLength={MAX_TEXT}
                    value={answers.improve}
                    onChange={(e) => set("improve", e.target.value)}
                    aria-invalid={errors.improve ? true : undefined}
                    aria-describedby={[fid("privacy"), errors.improve && fid("improve-error")].filter(Boolean).join(" ")}
                    className="min-h-24"
                  />
                  <FieldError id={fid("improve-error")} message={errors.improve} />
                  <p id={fid("privacy")} className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                    Please do not include patient or other sensitive health information.
                  </p>
                </div>

                <div className="flex flex-col gap-2 border-t pt-5">
                  <label htmlFor={fid("email")} className="text-sm font-medium">Email <Optional /></label>
                  <Input
                    id={fid("email")}
                    type="email"
                    autoComplete="email"
                    maxLength={200}
                    value={answers.email}
                    onChange={(e) => set("email", e.target.value)}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={[fid("email-help"), errors.email && fid("email-error")].filter(Boolean).join(" ")}
                    className="h-9"
                  />
                  <p id={fid("email-help")} className="text-xs text-muted-foreground">
                    Leave your email if you&apos;re open to a follow-up conversation.
                  </p>
                  <FieldError id={fid("email-error")} message={errors.email} />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t bg-muted/40 px-6 py-4 sm:flex-row sm:justify-end">
                <DialogClose render={<Button type="button" variant="outline" className="h-9 px-4" />}>Cancel</DialogClose>
                <Button type="submit" className="h-9 px-4" disabled={phase.kind === "sending"}>
                  {phase.kind === "sending" ? "Sending…" : "Submit review"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The end state, centred. "Received" is said only when the endpoint accepted
 * the review. With no feedback service connected the thanks still stands, but
 * the text says the review was not sent, and offers to copy it.
 */
function ResultPanel({ phase, onRetry }: { phase: Extract<Phase, { kind: "result" }>; onRetry: () => void }) {
  const [copied, setCopied] = useState<"" | "done" | "failed">("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reviewAsText(phase.submission));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  };
  const { result } = phase;
  const failed = !result.ok && result.reason === "failed";
  const notSent = !result.ok && result.reason === "not-configured";

  return (
    <div className="flex min-h-0 flex-col items-center gap-4 overflow-y-auto px-6 py-10 text-center sm:px-10" role="status">
      {failed
        ? <CircleAlert className="size-10 text-status-danger" aria-hidden />
        : <CircleCheck className="size-10 text-status-success" aria-hidden />}
      <DialogTitle className="text-lg leading-snug font-semibold tracking-tight text-balance">
        {failed ? "Your review could not be sent" : "Thank you for reviewing Care Gap Explorer."}
      </DialogTitle>
      <DialogDescription className="max-w-md leading-relaxed text-pretty">
        {result.ok && "Your feedback has been received and will help improve the project."}
        {notSent && "Feedback collection is not connected in this demo yet, so this review was not sent or stored. Copy it if you would like to share it directly."}
        {failed && "The feedback service did not accept it. Your answers are kept: try again, or copy your review."}
      </DialogDescription>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {!result.ok && (
          <Button variant="outline" className="h-9 px-4" onClick={copy}>
            <Copy aria-hidden /> Copy review
          </Button>
        )}
        {failed
          ? <Button className="h-9 px-4" onClick={onRetry}>Try again</Button>
          : <DialogClose render={<Button className="h-9 px-5" />}>Done</DialogClose>}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {copied === "done" && "Copied to the clipboard."}
        {copied === "failed" && "This browser did not allow copying. Select the text below instead."}
      </p>
      {copied === "failed" && (
        <pre className="max-h-48 w-full overflow-auto rounded-lg border bg-muted/40 p-3 text-left text-xs whitespace-pre-wrap">{reviewAsText(phase.submission)}</pre>
      )}
    </div>
  );
}

/** A single-choice question as a grid of selectable rows. */
function Choice<T extends string>({ n, name, label, options, value, onChange, firstId, error, errorId }: {
  n: number; name: string; label: string; options: readonly T[]; value: T | ""; onChange: (v: T) => void;
  firstId: string; error?: string; errorId: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2.5" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2.5 text-sm font-medium leading-snug">{n}. {label}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o, i) => (
          <label
            key={o}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
          >
            <input
              type="radio"
              name={name}
              value={o}
              id={i === 0 ? firstId : undefined}
              checked={value === o}
              onChange={() => onChange(o)}
              className="size-4 shrink-0 accent-primary"
            />
            {o}
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

/** A 1-5 rating as five radio buttons, labelled at both ends. */
function Rating({ n, name, label, ends, value, onChange, firstId, error, errorId }: {
  n: number; name: string; label: string; ends: { 1: string; 5: string }; value: number | null; onChange: (v: number) => void;
  firstId: string; error?: string; errorId: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2.5 text-sm font-medium leading-snug">{n}. {label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <label
            key={v}
            className="flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
          >
            <input
              type="radio"
              name={name}
              value={v}
              id={v === 1 ? firstId : undefined}
              checked={value === v}
              onChange={() => onChange(v)}
              className="sr-only"
            />
            {v}
            {(v === 1 || v === 5) && <span className="sr-only">, {ends[v].toLowerCase()}</span>}
          </label>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
        <span>1 = {ends[1]}</span>
        <span>5 = {ends[5]}</span>
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

function Optional() {
  return <span className="font-normal text-muted-foreground">(optional)</span>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="text-xs text-status-danger">{message}</p>;
}
