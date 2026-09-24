import { useState } from "react";

/** What `useDisclosure` returns. */
export interface UseDisclosureResult {
  /** Closes it - fits the `onClose` prop of `Dialog` and `ConfirmDialog`. */
  onClose: () => void;
  /** Opens it - e.g. the `onClick` of the button that shows a dialog. */
  onOpen: () => void;
  /** Sets the state - fits the `onOpenChange` prop of `Popover`. */
  onOpenChange: (open: boolean) => void;
  /** Opens it when it is closed and closes it when it is open. */
  onToggle: () => void;
  /** Whether it is open - pass it on as the `open` prop. */
  open: boolean;
}

/**
 * The open state of a dialog, a popover or a panel with the helpers that
 * change it, named after the props they fit:
 * `<Dialog open={dialog.open} onClose={dialog.onClose}>`.
 */
export default function useDisclosure(
  initialOpen = false,
): UseDisclosureResult {
  const [open, setOpen] = useState(initialOpen);

  return {
    onClose: () => setOpen(false),
    onOpen: () => setOpen(true),
    onOpenChange: (next: boolean) => setOpen(next),
    onToggle: () => setOpen((current) => !current),
    open,
  };
}
