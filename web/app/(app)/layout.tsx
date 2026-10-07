import { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { VisitMarker } from "@/components/VisitMarker";

/** Every application route: the sidebar, the global header, then the page. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <VisitMarker />
      {children}
    </AppShell>
  );
}
