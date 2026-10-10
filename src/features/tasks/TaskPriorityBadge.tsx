import type { Priority } from "../../data/contracts";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../components/ui/cn";

export interface TaskPriorityBadgeProps {
  priority: Priority;
}

/**
 * Three neutral grey levels (outline → secondary → primary), no hue:
 * Low is quiet, Medium is mid-grey, High is inverted and reads loudest.
 * The visible word carries the meaning, with a screen-reader-only "Priority:"
 * prefix so the badge is unambiguous when a row is read out.
 */
const PRIORITY_STYLES: Record<Priority, { variant: "outline" | "default" | "strong"; label: string }> = {
  low: { variant: "outline", label: "Low" },
  medium: { variant: "default", label: "Medium" },
  high: { variant: "strong", label: "High" },
};

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const style = PRIORITY_STYLES[priority];
  return (
    <Badge variant={style.variant} className={cn(priority === "high" && "font-semibold")}>
      <span className="sr-only">Priority: </span>
      {style.label}
    </Badge>
  );
}
