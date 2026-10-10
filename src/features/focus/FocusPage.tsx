import { Timer } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { EmptyState } from "../../components/ui/empty-state";

/** Placeholder body for T-003; replaced by the real focus timer in T-008. */
export default function FocusPage() {
  return (
    <>
      <PageHeader title="Focus" subtitle="Pomodoro-style sessions with a history you can trust." />
      <EmptyState
        icon={Timer}
        title="Focus — landing in T-008"
        description="Start, pause, resume and reset sessions; completed sessions are saved to history."
      />
    </>
  );
}
