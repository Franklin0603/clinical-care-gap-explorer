"use client";

import { ComponentType, ReactNode, useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";

import { PatientRow } from "@/lib/data";
import { PatientDetail, insulinDoc, loadPatientDetail } from "@/lib/patientDetail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientHeader, PatientSummaryTiles, TitleProps } from "./PatientSummary";
import {
  A1cTab, MedicationsTab, OverviewTab, ProceduresTab, TabKey,
} from "./PatientTabs";

/**
 * The patient workspace: one implementation, hosted two ways.
 *
 * Review on Home, Care Gaps and Patients opens it in a wide sheet, which keeps
 * the list - and its filters - underneath. /patients/[id] renders the same
 * component as a page, for a link that can be bookmarked or shared. Neither
 * host knows anything about the record; this file does.
 *
 * The header and the four summary tiles come from the report row, which every
 * page already has, so they render at once and are never a skeleton pretending
 * to wait. The history behind the tabs is patient_detail.json, fetched once per
 * session on first use (lib/patientDetail.ts); until it arrives the tab content
 * is skeletons, and if it fails the workspace says so and offers a retry.
 *
 * Tabs unmount when hidden (Base UI's default), so a patient with 275 A1c
 * results only draws that chart when the A1c tab is open.
 */

type Load = { all: Record<string, PatientDetail> | null; failed: boolean };

function usePatientDetail() {
  const [state, setState] = useState<Load>({ all: null, failed: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    loadPatientDetail()
      .then((all) => { if (live) setState({ all, failed: false }); })
      // The raw error goes to the console for whoever is debugging; the
      // reader gets a sentence and a retry.
      .catch((e: unknown) => { console.warn("patient_detail.json", e); if (live) setState({ all: null, failed: true }); });
    return () => { live = false; };
  }, [attempt]);

  const retry = () => { setState({ all: null, failed: false }); setAttempt((a) => a + 1); };
  return { ...state, retry };
}


export function PatientWorkspace({
  patient: r, cohort, Title, actions, unavailable,
}: {
  patient: PatientRow;
  cohort: PatientRow[];
  /** The heading element. The sheet passes its dialog title so the dialog is named. */
  Title?: ComponentType<TitleProps>;
  /** Host controls beside the title: "Open full record", or a back link. */
  actions?: ReactNode;
  /** Where to send someone when the record cannot load. */
  unavailable?: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const { all, failed, retry } = usePatientDetail();
  const detail = all ? all[String(r.patient_id)] ?? null : null;
  const insulin = insulinDoc(Boolean(r.on_insulin), detail?.meds ?? null);


  return (
    <div className="flex flex-col gap-5">
      <PatientHeader patient={r} Title={Title} actions={actions} />
      <PatientSummaryTiles patient={r} insulin={insulin} />

      {/* -------------------------------------------------------------- tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="gap-4">
        {/* Scrolls sideways rather than wrapping on a phone. */}
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList variant="line" aria-label="Patient record sections" className="h-9 w-full justify-start border-b">
            <TabsTrigger value="overview" className="flex-none px-3">Overview</TabsTrigger>
            <TabsTrigger value="a1c" className="flex-none px-3">A1c</TabsTrigger>
            <TabsTrigger value="medications" className="flex-none px-3">Medications</TabsTrigger>
            <TabsTrigger value="procedures" className="flex-none px-3">Procedures</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          {failed
            ? <Unavailable retry={retry}>{unavailable}</Unavailable>
            : <OverviewTab patient={r} detail={detail} insulin={insulin} go={setTab} />}
        </TabsContent>
        <TabsContent value="a1c">
          <Loaded detail={detail} failed={failed} retry={retry} unavailable={unavailable}>
            {(d) => <A1cTab patient={r} detail={d} cohort={cohort} />}
          </Loaded>
        </TabsContent>
        <TabsContent value="medications">
          <Loaded detail={detail} failed={failed} retry={retry} unavailable={unavailable}>
            {(d) => <MedicationsTab detail={d} insulin={insulin} />}
          </Loaded>
        </TabsContent>
        <TabsContent value="procedures">
          <Loaded detail={detail} failed={failed} retry={retry} unavailable={unavailable}>
            {(d) => <ProceduresTab detail={d} />}
          </Loaded>
        </TabsContent>
      </Tabs>
    </div>
  );
}


function Loaded({ detail, failed, retry, unavailable, children }: {
  detail: PatientDetail | null;
  failed: boolean;
  retry: () => void;
  unavailable?: ReactNode;
  children: (d: PatientDetail) => ReactNode;
}) {
  if (failed) return <Unavailable retry={retry}>{unavailable}</Unavailable>;
  if (!detail) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading patient history">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return <>{children(detail)}</>;
}

function Unavailable({ retry, children }: { retry: () => void; children?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-10 text-center">
      <CircleAlert className="size-6 text-status-danger" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold">Patient record unavailable</p>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load this patient&apos;s available record. The summary above is
          still accurate; the history behind it did not arrive.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" onClick={retry}>Try again</Button>
        {children}
      </div>
    </div>
  );
}
