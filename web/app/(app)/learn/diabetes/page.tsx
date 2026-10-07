import { ArrowRight } from "lucide-react";

import { videoById } from "@/lib/learn";
import { Term } from "@/components/Term";
import { GoDeeper, LearnModulePage, LearnSection, VideoCard } from "@/components/learn/LearnBits";

export const metadata = { title: "Understanding Diabetes" };

/** The four steps from a meal to an A1C result; each is a section below. */
const STEPS = [
  { id: "food", title: "Food becomes glucose" },
  { id: "blood", title: "Glucose travels in the blood" },
  { id: "insulin", title: "Insulin moves it into cells" },
  { id: "a1c", title: "Some sticks to red blood cells" },
];

/**
 * Plain-language background on diabetes and A1C, told as one sequence: from a
 * meal to the glucose that an A1C test measures. Educational only: general
 * facts, no advice for any person, and no single A1C goal presented as right
 * for everyone.
 */
export default function DiabetesModule() {
  return (
    <LearnModulePage slug="diabetes">
      <LearnSection title="What is diabetes?">
        <p>
          Diabetes is a long-term condition in which there is too much glucose (sugar) in the blood. It
          happens when the body does not make enough insulin, or cannot use the insulin it makes as well as
          it should.
        </p>
        <p>
          Over years, high blood glucose can damage blood vessels and nerves, which is why people with
          diabetes are monitored regularly.
        </p>
        <GoDeeper title="Type 1 and type 2">
          <p>
            In type 1 diabetes the body makes little or no insulin. In type 2, the most common form, the body
            still makes insulin but does not respond to it well, and over time may not make enough. The
            synthetic patients in this application were selected by recorded diabetes diagnosis codes.
          </p>
        </GoDeeper>
      </LearnSection>

      <section aria-labelledby="sequence" className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:p-5">
        <h2 id="sequence" className="text-sm font-semibold">From a meal to an A1C result</h2>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <a
                href={`#${s.id}`}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                  {i + 1}
                </span>
                {s.title}
              </a>
              {i < STEPS.length - 1 && <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground lg:block" aria-hidden />}
            </li>
          ))}
        </ol>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Diabetes changes step 3, so more glucose stays in the blood. An A1C test measures step 4.
        </p>
      </section>

      <LearnSection id="food" step={1} title="Food becomes glucose" figure="food">
        <p>
          Glucose is the body&apos;s main fuel. Much of it comes from food: carbohydrates, such as bread, rice
          and fruit, are broken down during digestion into glucose, which passes into the blood.
        </p>
      </LearnSection>

      <LearnSection id="blood" step={2} title="Glucose travels in the blood" figure="bloodstream" flip>
        <p>
          The blood carries glucose to the cells that need it. The amount in the blood rises after a meal and
          falls between meals.
        </p>
        <p>
          In people without diabetes, the body keeps it within a fairly narrow range. In diabetes, it stays
          high for longer.
        </p>
      </LearnSection>

      <LearnSection id="insulin" step={3} title="Insulin moves it into cells" figure="insulin">
        <p>
          Insulin is a hormone made by the pancreas. It works like a key: it binds to cells and lets glucose
          move out of the blood and into them, where it is used for energy or stored.
        </p>
        <p className="font-medium">Why can glucose stay in the bloodstream?</p>
        <p>
          If there is not enough insulin, or the cells do not respond to it well, glucose cannot get into the
          cells easily. It stays in the blood instead, and blood glucose remains high.
        </p>
      </LearnSection>

      <LearnSection id="a1c" step={4} title="Some sticks to red blood cells: the A1C test" figure="red-cells" flip>
        <p>
          While glucose is in the blood, some of it sticks to haemoglobin, the protein in red blood cells that
          carries oxygen, and stays stuck for the life of the cell. The more glucose there has been in the
          blood, the more haemoglobin carries it.
        </p>
        <p>
          <Term k="a1c">A1C</Term> (also called HbA1c, or glycated haemoglobin) is the blood test that measures
          this: the share of haemoglobin with glucose attached, given as a percentage.
        </p>
        <GoDeeper title="Why about three months?">
          <p>
            A red blood cell lives for roughly 120 days. Because the blood holds cells of every age, an A1C
            reflects average glucose exposure over roughly the past two to three months, weighted towards the
            most recent weeks.
          </p>
        </GoDeeper>
      </LearnSection>

      <LearnSection title="Why is A1C useful over time?">
        <p>
          A single blood glucose reading is a snapshot: it changes with the last meal, exercise and time of
          day. A1C smooths those changes out into one number that describes the past few months, which is why
          it is the test used to monitor diabetes over time and the one this application tracks.
        </p>
        <p>
          It also has limits. It does not show daily highs and lows, and some conditions that affect red
          blood cells, such as certain anaemias or haemoglobin variants, can make the result less reliable.
        </p>
        <GoDeeper title="A1C goals are individual">
          <p>
            A goal around 7% is a common reference for many adults with diabetes, and the patient workspace
            draws a line there for context. But goals differ from person to person, and A1C is one piece of
            information among many. Diagnosis, goals and treatment are decisions for a clinician who knows the
            patient. Nothing in this application recommends any of them.
          </p>
        </GoDeeper>
      </LearnSection>

      {videoById("a1c") && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Watch: a visual recap</h2>
          <p className="max-w-prose text-sm text-muted-foreground">All four steps, from a meal to the A1C test, in under a minute.</p>
          <div className="max-w-2xl"><VideoCard video={videoById("a1c")!} /></div>
        </section>
      )}
    </LearnModulePage>
  );
}
