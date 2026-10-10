/**
 * Pure input validation shared by every repository write path.
 *
 * Each `validate*` function normalizes the value (trimming titles, defaulting
 * optionals) and throws `ValidationError` with per-field, user-safe messages
 * when anything is invalid. No I/O happens here, so everything is unit tested.
 */
import {
  type FocusSessionInput,
  type FocusState,
  type LocalDate,
  type Priority,
  type TaskInput,
  ValidationError,
} from "./contracts";

/** Field limits, kept in sync with the UI copy in the feature tickets. */
export const LIMITS = {
  taskTitle: 200,
  taskDescription: 5000,
  projectName: 60,
  noteTitle: 200,
  noteContent: 100_000,
  focusMinutesMin: 1,
  focusMinutesMax: 180,
} as const;

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_MINUTE = 60_000;

/** Normalized, fully validated task fields ready for persistence. */
export interface NormalizedTask {
  title: string;
  description: string;
  priority: Priority;
  dueDate: LocalDate | null;
  projectId: number | null;
}

/** Normalized, fully validated note fields ready for persistence. */
export interface NormalizedNote {
  title: string;
  content: string;
}

function isPriority(value: unknown): value is Priority {
  return value === "low" || value === "medium" || value === "high";
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** True when `value` parses as a real point in time. */
function isValidInstant(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, monthIndex: number): number {
  switch (monthIndex) {
    case 1:
      return isLeapYear(year) ? 29 : 28;
    case 3:
    case 5:
    case 8:
    case 10:
      return 30;
    default:
      return 31;
  }
}

/**
 * Validates a local date string: exactly `YYYY-MM-DD` with a real calendar
 * date (month 01–12, day within the month, leap years respected). Returns the
 * value unchanged; throws `ValidationError` keyed on `field`.
 */
export function parseLocalDate(value: unknown, field = "dueDate"): LocalDate {
  const invalid = new ValidationError({
    [field]: "Due date must be a valid date in YYYY-MM-DD format",
  });
  if (typeof value !== "string") {
    throw invalid;
  }
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (match === null) {
    throw invalid;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > daysInMonth(year, monthIndex)) {
    throw invalid;
  }
  return value;
}

/**
 * Validates and normalizes a task input. `description`, `priority`,
 * `dueDate` and `projectId` default to empty/medium/none when omitted.
 * Throws `ValidationError` listing every invalid field at once.
 */
export function validateTaskInput(input: TaskInput): NormalizedTask {
  const errors: Record<string, string> = {};

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length === 0) {
    errors.title = "Title is required";
  } else if (title.length > LIMITS.taskTitle) {
    errors.title = `Title must be ${LIMITS.taskTitle} characters or fewer`;
  }

  const description = typeof input.description === "string" ? input.description : "";
  if (description.length > LIMITS.taskDescription) {
    errors.description = `Description must be ${LIMITS.taskDescription} characters or fewer`;
  }

  let priority: Priority = "medium";
  if (input.priority !== undefined) {
    if (isPriority(input.priority)) {
      priority = input.priority;
    } else {
      errors.priority = "Priority must be low, medium or high";
    }
  }

  let dueDate: LocalDate | null = null;
  if (input.dueDate !== undefined && input.dueDate !== null) {
    try {
      dueDate = parseLocalDate(input.dueDate);
    } catch (error) {
      if (error instanceof ValidationError) {
        Object.assign(errors, error.fieldErrors);
      } else {
        throw error;
      }
    }
  }

  let projectId: number | null = null;
  if (input.projectId !== undefined && input.projectId !== null) {
    if (isPositiveId(input.projectId)) {
      projectId = input.projectId;
    } else {
      errors.projectId = "Selected project is invalid";
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
  return { title, description, priority, dueDate, projectId };
}

/** Validates a project name: trimmed, 1–60 characters. Returns the trimmed name. */
export function validateProjectName(name: unknown): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (trimmed.length === 0) {
    throw new ValidationError({ name: "Project name is required" });
  }
  if (trimmed.length > LIMITS.projectName) {
    throw new ValidationError({
      name: `Project name must be ${LIMITS.projectName} characters or fewer`,
    });
  }
  return trimmed;
}

/**
 * Validates and normalizes a note input. `content` defaults to empty.
 * Note content is stored as typed — only the title is trimmed.
 */
export function validateNoteInput(input: { title: string; content?: string }): NormalizedNote {
  const errors: Record<string, string> = {};

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length === 0) {
    errors.title = "Note title is required";
  } else if (title.length > LIMITS.noteTitle) {
    errors.title = `Note title must be ${LIMITS.noteTitle} characters or fewer`;
  }

  const content = typeof input.content === "string" ? input.content : "";
  if (content.length > LIMITS.noteContent) {
    errors.content = `Note content must be ${LIMITS.noteContent} characters or fewer`;
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
  return { title, content };
}

/** Validates the configured focus duration: a whole number of minutes, 1–180. */
export function validateFocusDurationMinutes(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < LIMITS.focusMinutesMin ||
    value > LIMITS.focusMinutesMax
  ) {
    throw new ValidationError({
      focusDurationMinutes: `Focus duration must be a whole number of minutes between ${LIMITS.focusMinutesMin} and ${LIMITS.focusMinutesMax}`,
    });
  }
  return value;
}

/**
 * Validates a focus session before it is written to history. Returns the
 * normalized input (`taskId` defaults to `null`).
 */
export function validateFocusSessionInput(input: FocusSessionInput): FocusSessionInput {
  const errors: Record<string, string> = {};

  if (!isValidInstant(input.startedAt)) {
    errors.startedAt = "Start time is invalid";
  }
  if (input.endedAt !== null && input.endedAt !== undefined && !isValidInstant(input.endedAt)) {
    errors.endedAt = "End time is invalid";
  }

  const maxDurationMs = LIMITS.focusMinutesMax * MILLISECONDS_PER_MINUTE;
  if (
    typeof input.plannedDurationMs !== "number" ||
    !Number.isSafeInteger(input.plannedDurationMs) ||
    input.plannedDurationMs < MILLISECONDS_PER_MINUTE ||
    input.plannedDurationMs > maxDurationMs
  ) {
    errors.plannedDurationMs = `Planned duration must be between ${LIMITS.focusMinutesMin} and ${LIMITS.focusMinutesMax} minutes`;
  }
  if (
    typeof input.actualDurationMs !== "number" ||
    !Number.isSafeInteger(input.actualDurationMs) ||
    input.actualDurationMs < 0
  ) {
    errors.actualDurationMs = "Actual duration is invalid";
  }
  if (typeof input.completed !== "boolean") {
    errors.completed = "Completed must be true or false";
  }
  if (input.taskId !== null && input.taskId !== undefined && !isPositiveId(input.taskId)) {
    errors.taskId = "Selected task is invalid";
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
  return { ...input, endedAt: input.endedAt ?? null, taskId: input.taskId ?? null };
}

/** Validates the persisted focus-timer state before it is saved. */
export function validateFocusState(state: FocusState): FocusState {
  const errors: Record<string, string> = {};

  if (state.status !== "running" && state.status !== "paused") {
    errors.status = "Focus timer status must be running or paused";
  }
  if (!isValidInstant(state.startedAt)) {
    errors.startedAt = "Start time is invalid";
  }
  if (
    typeof state.elapsedBeforeMs !== "number" ||
    !Number.isSafeInteger(state.elapsedBeforeMs) ||
    state.elapsedBeforeMs < 0
  ) {
    errors.elapsedBeforeMs = "Elapsed time is invalid";
  }
  const maxDurationMs = LIMITS.focusMinutesMax * MILLISECONDS_PER_MINUTE;
  if (
    typeof state.plannedDurationMs !== "number" ||
    !Number.isSafeInteger(state.plannedDurationMs) ||
    state.plannedDurationMs < MILLISECONDS_PER_MINUTE ||
    state.plannedDurationMs > maxDurationMs
  ) {
    errors.plannedDurationMs = `Planned duration must be between ${LIMITS.focusMinutesMin} and ${LIMITS.focusMinutesMax} minutes`;
  }
  if (state.taskId !== null && !isPositiveId(state.taskId)) {
    errors.taskId = "Selected task is invalid";
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
  return state;
}
