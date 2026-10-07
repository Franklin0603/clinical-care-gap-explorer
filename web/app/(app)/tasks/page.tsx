import { Suspense } from "react";

import { Page } from "@/components/shell/Page";
import { TasksFromUrl, TasksView } from "./TasksView";

export const metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <Page
      title="Tasks"
      description="Track follow-up work for patients with A1C monitoring gaps."
      width="wide"
    >
      {/* ?open= is read on the client; the prerendered page is the queue. */}
      <Suspense fallback={<TasksView />}>
        <TasksFromUrl />
      </Suspense>
    </Page>
  );
}
