import { useId } from "react";
import type { ProjectWithProgress, TaskFilter } from "../../data/contracts";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { SelectField, type SelectOption } from "../../components/ui/select";
import {
  defaultTaskFilter,
  isDefaultFilter,
  priorityFilterFrom,
  projectFilterFrom,
  statusFilterFrom,
} from "./taskHelpers";

export interface TaskFiltersProps {
  value: TaskFilter;
  onChange: (next: TaskFilter) => void;
  projects: ProjectWithProgress[];
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Active" },
  { value: "completed", label: "Completed" },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/**
 * The filter bar: one search box plus status / priority / project selects.
 * It only edits the `TaskFilter` object — every query runs in the data layer
 * (`data.tasks.list(filter)`), so no filtering logic is duplicated here.
 */
export function TaskFilters({ value, onChange, projects }: TaskFiltersProps) {
  const searchId = useId();

  const projectOptions: SelectOption[] = [
    { value: "all", label: "All projects" },
    { value: "none", label: "No project" },
    ...projects.map((project) => ({ value: String(project.id), label: project.name })),
  ];

  return (
    <section aria-label="Task filters" className="flex flex-col">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={searchId} className="text-xs font-medium text-foreground">
            Search
          </label>
          <Input
            id={searchId}
            type="search"
            value={value.query ?? ""}
            onChange={(event) => onChange({ ...value, query: event.target.value })}
            placeholder="Title or description…"
            autoComplete="off"
          />
        </div>

        <SelectField
          label="Status"
          value={value.status ?? "all"}
          onValueChange={(next) => onChange({ ...value, status: statusFilterFrom(next) })}
          options={STATUS_OPTIONS}
        />

        <SelectField
          label="Priority"
          value={value.priority ?? "all"}
          onValueChange={(next) => onChange({ ...value, priority: priorityFilterFrom(next) })}
          options={PRIORITY_OPTIONS}
        />

        <SelectField
          label="Project"
          value={String(value.projectId ?? "all")}
          onValueChange={(next) => onChange({ ...value, projectId: projectFilterFrom(next) })}
          options={projectOptions}
        />
      </div>

      <div className="mt-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          disabled={isDefaultFilter(value)}
          onClick={() => onChange(defaultTaskFilter())}
        >
          Clear filters
        </Button>
      </div>
    </section>
  );
}
