import { CalendarDays } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/empty-state";

/** Placeholder body for T-003; replaced by the real dashboard in T-006. */
export default function TodayPage() {
  return (
    <>
      <PageHeader title="Today" subtitle="Your day at a glance — real tasks, deadlines and focus." />
      <EmptyState
        icon={CalendarDays}
        title="Today — landing in T-006"
        description="The dashboard appears here once task management (T-004) and projects (T-005) are in place."
      />
    </>
  );
}
