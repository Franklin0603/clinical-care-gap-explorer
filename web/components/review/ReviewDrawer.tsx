"use client";

import { createContext, useCallback, useContext, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { CircleAlert, Copy, ShieldAlert } from "lucide-react";

import { cn } from "cn";
import {
  CLARITY_LABELS, EMPTY_ANSWERS, MAX_TEXT, REVIEW_ROLES, buildSubmission, reviewAsText, sanitizePage, sendReview,
  validateReview, type ReviewAnswers, type ReviewErrors, type ReviewSubmission, type SendResult,
} from "@/lib/review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/**
 * "Review this project", inside the application. It opens only when a visitor
 * chooses it from the sidebar - never on its own - and closing it leaves them
 * on the page they were using. Nothing in the app depends on it.
 *
 * The draft lives here, outside the drawer's content, so closing the drawer by
 * accident does not throw away what was typed.
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
      <ReviewDrawer open={open} onOpenChange={setOpen} page={page} returnFocus={opener} />
    </ReviewContext.Provider>
  );
}

type Phase =
  | { kind: "form" }
  | { kind: "sending" }
  | { kind: "result"; result: SendResult; submission: ReviewSubmission };

const TEXT_QUESTIONS: { key: "mostUseful" | "improve" | "healthcareUse"; n: number; label: string }[] = [
  { key: "mostUseful", n: 3, label: "Which part of the project was most useful or interesting?" },
  { key: "improve", n: 4, label: "What would you improve or add?" },
  { key: "healthcareUse", n: 5, label: "Could you see a tool like this being useful in a healthcare setting? Why or why not?" },
];

function ReviewDrawer({ open, onOpenChange, page, returnFocus }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: string;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const [answers, setAnswers] = useState<ReviewAnswers>(EMPTY_ANSWERS);
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const set = <K extends keyof ReviewAnswers>(k: K, v: ReviewAnswers[K]) => {
    setAnswers((a) => ({ ...a, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const ids = useId();
  const fid = (k: string) => `${ids}-${k}`;

  const close = (next: boolean) => {
    onOpenChange(next);
    // A finished review starts over next time; an unfinished one is kept.
    if (!next && phase.kind === "result" && phase.result.ok) { setAnswers(EMPTY_ANSWERS); setPhase({ kind: "form" }); }
    if (!next && phase.kind === "result" && !phase.result.ok) setPhase({ kind: "form" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateReview(answers);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(fid(first))?.focus();
      return;
    }
    const submission = buildSubmission(answers, page);
    setPhase({ kind: "sending" });
    setPhase({ kind: "result", result: await sendReview(submission), submission });
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        finalFocus={returnFocus}
        className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        <div className="border-b px-6 pt-6 pb-4 pr-12">
          <SheetTitle className="text-lg font-semibold tracking-tight">Review Care Gap Explorer</SheetTitle>
          <SheetDescription className="mt-1 leading-relaxed">
            Your feedback will help improve this healthcare data project. It takes about 2 minutes.
          </SheetDescription>
        </div>

        {phase.kind === "result" ? (
          <ResultPanel phase={phase} onBack={() => setPhase({ kind: "form" })} />
        ) : (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
              <p role="note" className="flex gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                Please do not include patient or other sensitive health information in your feedback.
              </p>

              {errorCount > 0 && (
                <p role="alert" className="flex gap-2 rounded-lg border border-status-danger/30 bg-status-danger/5 p-3 text-sm text-status-danger">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {errorCount === 1 ? "One answer needs attention before sending." : `${errorCount} answers need attention before sending.`}
                </p>
              )}

              <fieldset className="flex flex-col gap-2.5" aria-describedby={errors.role ? fid("role-error") : undefined}>
                <legend className="mb-2.5 text-sm font-medium">1. What best describes your role? <Required /></legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {REVIEW_ROLES.map((r, i) => (
                    <label
                      key={r}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        id={i === 0 ? fid("role") : undefined}
                        checked={answers.role === r}
                        onChange={() => set("role", r)}
                        className="size-4 accent-primary"
                      />
                      {r}
                    </label>
                  ))}
                </div>
                <FieldError id={fid("role-error")} message={errors.role} />
              </fieldset>

              <fieldset className="flex flex-col gap-2" aria-describedby={errors.clarity ? fid("clarity-error") : undefined}>
                <legend className="mb-2.5 text-sm font-medium">2. How clear was the purpose of Care Gap Explorer? <Required /></legend>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label
                      key={n}
                      className="flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                    >
                      <input
                        type="radio"
                        name="clarity"
                        value={n}
                        id={n === 1 ? fid("clarity") : undefined}
                        checked={answers.clarity === n}
                        onChange={() => set("clarity", n)}
                        className="sr-only"
                      />
                      {n}
                      {CLARITY_LABELS[n] && <span className="sr-only">, {CLARITY_LABELS[n].toLowerCase()}</span>}
                    </label>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
                  <span>1 = Not clear</span>
                  <span>5 = Very clear</span>
                </div>
                <FieldError id={fid("clarity-error")} message={errors.clarity} />
              </fieldset>

              {TEXT_QUESTIONS.map((q) => (
                <div key={q.key} className="flex flex-col gap-2">
                  <label htmlFor={fid(q.key)} className="text-sm font-medium leading-snug">
                    {q.n}. {q.label} <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Textarea
                    id={fid(q.key)}
                    rows={3}
                    maxLength={MAX_TEXT}
                    value={answers[q.key]}
                    onChange={(e) => set(q.key, e.target.value)}
                    aria-invalid={errors[q.key] ? true : undefined}
                    aria-describedby={errors[q.key] ? fid(`${q.key}-error`) : undefined}
                    className="min-h-20"
                  />
                  <FieldError id={fid(`${q.key}-error`)} message={errors[q.key]} />
                </div>
              ))}

              <fieldset className="flex flex-col gap-3 border-t pt-5">
                <legend className="sr-only">Optional contact details</legend>
                <div>
                  <p className="text-sm font-medium" aria-hidden>Optional contact</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Email is optional. Add it if you&apos;re open to being contacted about your feedback.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField id={fid("name")} label="Name" autoComplete="name" value={answers.name} onChange={(v) => set("name", v)} />
                  <TextField id={fid("organization")} label="Organization" autoComplete="organization" value={answers.organization} onChange={(v) => set("organization", v)} />
                </div>
                <TextField
                  id={fid("email")}
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={answers.email}
                  onChange={(v) => set("email", v)}
                  error={errors.email}
                  errorId={fid("email-error")}
                />
              </fieldset>

              <p className="text-xs leading-relaxed text-muted-foreground">
                With your answers, the review records the time and the page you opened it from
                (<span className="font-mono">{sanitizePage(page)}</span>), with any patient identifier removed.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
              <Button type="submit" disabled={phase.kind === "sending"}>
                {phase.kind === "sending" ? "Sending…" : "Submit review"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ResultPanel({ phase, onBack }: { phase: Extract<Phase, { kind: "result" }>; onBack: () => void }) {
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

  const [title, body] = result.ok
    ? ["Thank you", "Your review was sent."]
    : result.reason === "not-configured"
      ? ["Your review was not sent",
         "This demonstration does not have a feedback service connected yet, so nothing was sent or stored. You can copy your review and share it with the project owner directly."]
      : ["Your review could not be sent",
         "The feedback service did not accept it. Nothing was lost: your answers are still here. Try again, or copy your review."];

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-6" role="status">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="flex flex-wrap gap-2">
        {!result.ok && (
          <Button variant="outline" onClick={copy}>
            <Copy aria-hidden /> Copy review
          </Button>
        )}
        {result.ok
          ? <SheetClose render={<Button />}>Close</SheetClose>
          : <Button variant={result.reason === "failed" ? "default" : "ghost"} onClick={onBack}>{result.reason === "failed" ? "Try again" : "Back to the form"}</Button>}
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {copied === "done" && "Copied to the clipboard."}
        {copied === "failed" && "This browser did not allow copying. Select the text below instead."}
      </p>
      {copied === "failed" && (
        <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap">{reviewAsText(phase.submission)}</pre>
      )}
    </div>
  );
}

function Required() {
  return <span className="font-normal text-muted-foreground">(required)</span>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="text-xs text-status-danger">{message}</p>;
}

function TextField({ id, label, value, onChange, type = "text", autoComplete, error, errorId }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; autoComplete?: string; error?: string; errorId?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm">{label}</label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        maxLength={200}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn("h-9")}
      />
      {error && errorId && <FieldError id={errorId} message={error} />}
    </div>
  );
}
