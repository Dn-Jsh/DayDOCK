import { SquareCheckBig } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/empty-state";

/** Placeholder body for T-003; replaced by the real task list in T-004. */
export default function TasksPage() {
  return (
    <>
      <PageHeader title="Tasks" subtitle="Create, filter and finish your tasks." />
      <EmptyState
        icon={SquareCheckBig}
        title="Tasks — landing in T-004"
        description="CRUD, due dates, priorities, project assignment, filters and search arrive with the task ticket."
      />
    </>
  );
}
