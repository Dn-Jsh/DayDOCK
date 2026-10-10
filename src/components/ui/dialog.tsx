import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentPropsWithoutRef, HTMLAttributes } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

/** Modal root. Controlled through `open`/`onOpenChange`; Escape closes it. */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Accessible name of the close button (icon-only, so required). */
  closeLabel?: string;
}

/**
 * Focus-trapped modal panel. Every dialog MUST include a `DialogTitle` and,
 * when one exists, a `DialogDescription` so Radix can label the dialog —
 * Radix wires them to `aria-labelledby`/`aria-describedby` automatically.
 * The close button is rendered last so the first Tab lands in the content.
 */
export function DialogContent({
  className,
  children,
  closeLabel = "Close dialog",
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dd-overlay fixed inset-0 z-50 bg-black/70" />
      <DialogPrimitive.Content
        className={cn(
          "dd-content fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md",
          "-translate-x-1/2 -translate-y-1/2 rounded-none border border-border",
          "bg-popover p-6 text-popover-foreground shadow-2xl",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className={cn(
            "absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-none",
            "border border-transparent text-muted-foreground",
            "transition-colors duration-150 hover:border-border hover:bg-secondary hover:text-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Title/description stack above the dialog body. */
export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 pr-8 text-left", className)} {...props} />;
}

/** Button row at the bottom of a dialog; right-aligned, wraps when narrow. */
export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex flex-wrap justify-end gap-2", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold leading-tight text-foreground", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
