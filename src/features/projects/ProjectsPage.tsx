import { FolderKanban } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/empty-state";

/** Placeholder body for T-003; replaced by the real projects view in T-005. */
export default function ProjectsPage() {
  return (
    <>
      <PageHeader title="Projects" subtitle="Group related tasks and track their progress." />
      <EmptyState
        icon={FolderKanban}
        title="Projects — landing in T-005"
        description="Create, rename and delete projects, assign tasks and see completion progress here."
      />
    </>
  );
}
