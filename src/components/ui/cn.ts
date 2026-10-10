import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names, resolving Tailwind conflicts so callers can
 * safely override a primitive's defaults (e.g. `max-w-md` on a dialog).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
