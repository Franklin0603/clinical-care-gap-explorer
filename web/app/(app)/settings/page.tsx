import { Settings } from "lucide-react";

import { Page } from "@/components/shell/Page";
import { EmptyState } from "@/components/shell/EmptyState";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Page title="Settings" description="Preferences for how the application looks and behaves.">
      <EmptyState
        icon={Settings}
        title="Preferences"
        description="Display preferences and saved views, once there is an account to keep them on."
        // No toggles that do nothing. A switch that changes nothing is worse
        // than an empty page, because it looks like it worked.
        note="There is nothing to configure in this demonstration. There are no accounts, and nothing about you is stored."
        links={[{ href: "/help", label: "Help", about: "How to get around the application." }]}
      />
    </Page>
  );
}
