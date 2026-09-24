import cn from "../utils/cn";
import ModalDialog from "./modal-dialog";

export { DialogFooter } from "./modal-dialog";

export type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export interface DialogProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /**
   * Keeps the dialog open - Escape does nothing and the close button is
   * disabled, e.g. while the request of its form runs.
   */
  closeDisabled?: boolean;
  /**
   * Called when the user closes the dialog (close button, Escape). In
   * uncontrolled mode it is called after the closing animation - e.g.
   * `() => navigate(-1)` for a dialog that is a route of its own.
   */
  onClose?: () => void;
  /**
   * Controls the dialog. Leave it out for an uncontrolled dialog that opens
   * when mounted and closes itself.
   */
  open?: boolean;
  /**
   * `alertdialog` for a dialog that interrupts with something urgent - a
   * question that must be answered, like the one of `ConfirmDialog`.
   */
  role?: "alertdialog" | "dialog";
  /** Maximum width from the `sm` breakpoint up. */
  size?: DialogSize;
  /** Heading - also the accessible name of the dialog. */
  title?: React.ReactNode;
}

const sizeClasses: Record<DialogSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  // Centered by the translate like the others - 1rem from both edges
  full: "sm:max-w-[calc(100%-2rem)]",
};

/**
 * A modal window. Traps the focus, closes on Escape and locks the page
 * scroll while open.
 */
export default function Dialog({
  closeDisabled = false,
  role = "dialog",
  size = "sm",
  ...props
}: DialogProps) {
  return (
    <ModalDialog
      {...props}
      backdropClassName="duration-200"
      // Room for a DialogFooter
      bodyClassName="pb-17"
      closeDisabled={closeDisabled}
      duration={200}
      openClassName="scale-100 opacity-100"
      panelClassName={cn(
        "fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-full max-w-11/12 -translate-x-1/2 -translate-y-1/2 scale-95 transform flex-col overflow-hidden rounded-lg border border-neutral-200 bg-background opacity-0 shadow-md transition-all duration-200 focus:outline-none motion-reduce:transition-opacity dark:border-neutral-800 dark:bg-background-dark",
        sizeClasses[size],
      )}
      role={role}
    />
  );
}
