import { Settings } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/empty-state";

/** Placeholder body for T-003; replaced by the real settings page in T-009. */
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Theme, focus duration and local data export." />
      <EmptyState
        icon={Settings}
        title="Settings — landing in T-009"
        description="Theme (already handled by the sidebar toggle), focus duration, JSON backup export and app information."
      />
    </>
  );
}
