import { videoById } from "@/lib/learn";
import { Term } from "@/components/Term";
import { GoDeeper, LearnModulePage, LearnSection, VideoCard } from "@/components/learn/LearnBits";

export const metadata = { title: "Understanding Diabetes" };

/**
 * Plain-language background on diabetes and A1c. Educational only: general
 * facts, no advice for any person, and no single A1c goal presented as right
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

      <LearnSection title="What is glucose?" figure="bloodstream">
        <p>
          Glucose is the body&apos;s main fuel. Much of it comes from food: carbohydrates are broken down into
          glucose, which passes into the blood and is carried to the cells that need it.
        </p>
        <p>
          The amount of glucose in the blood rises after a meal and falls between meals. In people without
          diabetes, the body keeps it within a fairly narrow range.
        </p>
      </LearnSection>

      <LearnSection title="What does insulin do?" figure="insulin" flip>
        <p>
          Insulin is a hormone made by the pancreas. It works like a key: it helps glucose move out of the
          blood and into the body&apos;s cells, where it is used for energy or stored.
        </p>
        <p className="font-medium">Why can glucose stay in the bloodstream?</p>
        <p>
          If there is not enough insulin, or the cells do not respond to it well, glucose cannot get into the
          cells easily. It stays in the blood instead, and blood glucose remains high.
        </p>
      </LearnSection>

      <LearnSection title="What is A1c?" figure="red-cells">
        <p>
          <Term k="a1c">A1c</Term> (also called HbA1c, or glycated haemoglobin) is a blood test. It measures how
          much glucose has become attached to haemoglobin, the protein in red blood cells that carries oxygen.
          The result is a percentage.
        </p>
        <p className="font-medium">How does it relate to red blood cells?</p>
        <p>
          While glucose is in the blood, some of it sticks to the haemoglobin inside red blood cells, and stays
          stuck for the life of the cell. The more glucose there has been in the blood, the more haemoglobin
          carries it.
        </p>
        <GoDeeper title="Why about three months?">
          <p>
            A red blood cell lives for roughly 120 days. Because the blood holds cells of every age, an A1c
            reflects average glucose exposure over roughly the past two to three months, weighted towards the
            most recent weeks.
          </p>
        </GoDeeper>
      </LearnSection>

      <LearnSection title="Why is A1c useful over time?">
        <p>
          A single blood glucose reading is a snapshot: it changes with the last meal, exercise and time of
          day. A1c smooths those changes out into one number that describes the past few months, which is why
          it is the test used to monitor diabetes over time and the one this application tracks.
        </p>
        <p>
          It also has limits. It does not show daily highs and lows, and some conditions that affect red
          blood cells, such as certain anaemias or haemoglobin variants, can make the result less reliable.
        </p>
        <GoDeeper title="A1c goals are individual">
          <p>
            A goal around 7% is a common reference for many adults with diabetes, and the patient workspace
            draws a line there for context. But goals differ from person to person, and A1c is one piece of
            information among many. Diagnosis, goals and treatment are decisions for a clinician who knows the
            patient. Nothing in this application recommends any of them.
          </p>
        </GoDeeper>
      </LearnSection>

      {videoById("a1c") && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Watch</h2>
          <div className="max-w-md"><VideoCard video={videoById("a1c")!} /></div>
        </section>
      )}
    </LearnModulePage>
  );
}
