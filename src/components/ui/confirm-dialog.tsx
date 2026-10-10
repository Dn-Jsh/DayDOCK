import { useState } from "react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Must state what will happen / what will be removed. */
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Runs when Confirm is pressed. The dialog closes only after it resolves;
   * if it rejects, the dialog stays open so the caller can show the error.
   */
  onConfirm: () => void | Promise<void>;
  /** Defaults to `true` — this dialog exists for destructive actions. */
  destructive?: boolean;
}

/**
 * Confirmation modal used by every destructive action (delete task, delete
 * project, delete note…). Focus is trapped, Escape cancels, Cancel is the
 * first focusable control, and the confirm button states the action.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = true,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      /* The caller owns error display; keep the dialog open (input is not lost). */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            disabled={busy}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
