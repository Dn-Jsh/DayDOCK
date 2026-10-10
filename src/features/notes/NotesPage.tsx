import { FileText } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/empty-state";

/** Placeholder body for T-003; replaced by the real notes feature in T-007. */
export default function NotesPage() {
  return (
    <>
      <PageHeader title="Notes" subtitle="Quick plain-text notes with auto-save." />
      <EmptyState
        icon={FileText}
        title="Notes — landing in T-007"
        description="Note creation, search, the auto-saving editor and delete confirmation arrive with the notes ticket."
      />
    </>
  );
}
