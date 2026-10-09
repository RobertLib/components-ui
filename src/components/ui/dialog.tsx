import cn from "../../utils/cn";
import ModalDialog from "./modal-dialog";

export { DialogFooter } from "./modal-dialog";

export type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export interface DialogProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /**
   * Classes of the scrolling body around the content - e.g. `flex flex-col`
   * for content that fills it, or another padding (`p-6` by default).
   */
  bodyClassName?: string;
  /**
   * Keeps the dialog open - Escape and a click on the backdrop do nothing
   * and the close button is disabled, e.g. while the request of its form
   * runs.
   */
  closeDisabled?: boolean;
  /**
   * A click on the backdrop closes the dialog. Off by default: a stray
   * click does not throw away a form being filled in.
   */
  closeOnBackdropClick?: boolean;
  /**
   * Escape closes the dialog - on by default. Turned off, Escape does
   * nothing while the dialog is the topmost overlay (the close button still
   * closes it); `closeDisabled` keeps it open by any means.
   */
  closeOnEscape?: boolean;
  /**
   * Below the `md` breakpoint (768px) the dialog fills the screen - its
   * header at the top and a `DialogFooter` at the bottom, clear of the notch
   * and the home indicator of a phone (with `viewport-fit=cover`). For a
   * form too long for a centered window on a phone. `size` applies from `md`
   * up then.
   */
  fullScreenOnMobile?: boolean;
  /**
   * Asked before the user closes the dialog - by the close button, Escape
   * or the backdrop. Return `false`, or a promise of it, to keep it open -
   * e.g. the answer of a "Discard changes?" `useConfirm()`. While a promise
   * is pending, further attempts to close wait for it. Not asked when
   * `open` turns `false`.
   */
  onBeforeClose?: () => boolean | void | Promise<boolean | void>;
  /**
   * Called when the user closes the dialog (close button, Escape, the
   * backdrop with `closeOnBackdropClick`). In uncontrolled mode it is called
   * after the closing animation - e.g. `() => navigate(-1)` for a dialog
   * that is a route of its own.
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

// `fullScreenOnMobile`: the sizes from where it is a window
const mdSizeClasses: Record<DialogSize, string> = {
  sm: "md:max-w-sm",
  md: "md:max-w-md",
  lg: "md:max-w-lg",
  xl: "md:max-w-xl",
  "2xl": "md:max-w-2xl",
  full: "md:max-w-[calc(100%-2rem)]",
};

// A window in the middle of the screen - `left-1/2` and the translate center
// it, the same in both writing directions
const WINDOW_CLASSES =
  "fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-full max-w-11/12 -translate-x-1/2 -translate-y-1/2 scale-95 transform flex-col overflow-hidden rounded-lg border border-neutral-200 bg-dialog opacity-0 shadow-md transition-all duration-200 focus:outline-hidden motion-reduce:transition-opacity dark:border-neutral-800 dark:bg-dialog-dark";

// The whole screen below `md` - its edges at the edges of a phone screen,
// the header and the footer inset from them - a window from `md` up
const FULL_SCREEN_CLASSES =
  "fixed inset-0 z-50 flex h-dvh w-full scale-95 transform flex-col overflow-hidden bg-dialog opacity-0 transition-all duration-200 [--cui-safe-bottom:env(safe-area-inset-bottom)] [--cui-safe-top:env(safe-area-inset-top)] focus:outline-hidden motion-reduce:transition-opacity md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[90dvh] md:max-w-11/12 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border md:border-neutral-200 md:shadow-md md:[--cui-safe-bottom:0px] md:[--cui-safe-top:0px] dark:bg-dialog-dark md:dark:border-neutral-800";

/**
 * A modal window. Traps the focus, closes on Escape and locks the page
 * scroll while open. `ref` and the other props go to the window - the
 * element with the `role`, which has `data-state="open"` or `"closed"`
 * (also while it animates in and out), like its backdrop.
 */
export default function Dialog({
  bodyClassName,
  closeDisabled = false,
  closeOnBackdropClick = false,
  closeOnEscape = true,
  fullScreenOnMobile = false,
  role = "dialog",
  size = "sm",
  ...props
}: DialogProps) {
  return (
    <ModalDialog
      {...props}
      backdropClassName="duration-200"
      // The content clear of the home indicator without a footer too
      bodyClassName={cn(
        fullScreenOnMobile && "pb-[calc(1.5rem+var(--cui-safe-bottom,0px))]",
        bodyClassName,
      )}
      closeDisabled={closeDisabled}
      closeOnBackdropClick={closeOnBackdropClick}
      closeOnEscape={closeOnEscape}
      duration={200}
      // Square corners where the dialog fills the screen
      footerClassName={fullScreenOnMobile ? "md:rounded-b-lg" : "rounded-b-lg"}
      openClassName="scale-100 opacity-100"
      panelClassName={
        fullScreenOnMobile
          ? cn(FULL_SCREEN_CLASSES, mdSizeClasses[size])
          : cn(WINDOW_CLASSES, sizeClasses[size])
      }
      role={role}
    />
  );
}
