import {
  useCallback,
  useEffect,
  useId,
  useInsertionEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import cn from "../utils/cn";
import IconButton from "./icon-button";
import {
  isTopmostOverlay,
  lockPageScroll,
  OverlayContext,
  useFocusTrap,
  useOverlayLayer,
} from "./overlay-stack";
import { getTabbableElements } from "../utils/tabbable";
import { useMessages } from "../providers/ui-context";

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
  full: "sm:max-w-full sm:mx-4",
};

/**
 * A modal window. Traps the focus, closes on Escape and locks the page
 * scroll while open.
 */
export default function Dialog({
  className,
  children,
  closeDisabled = false,
  onClose,
  open,
  size = "sm",
  title,
  "aria-label": ariaLabel,
  ...props
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messages = useMessages();

  // Internal state only used in uncontrolled mode
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // Determine if controlled or uncontrolled
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalIsOpen;
  const isRendered = isControlled ? open : !isClosed;

  const titleId = useId();

  // In the overlay stack shared with popovers, tooltips and the drawer: only
  // the topmost overlay handles Escape - a ConfirmDialog opened from a Dialog
  // closes alone - and only the topmost modal one traps the focus
  const { childContext, id: dialogId } = useOverlayLayer(isRendered, {
    getElements: () => [dialogRef.current],
    modal: true,
  });

  const handleClose = useCallback(() => {
    if (closeDisabled) return;

    if (isControlled) {
      onClose?.();
      return;
    }

    // Uncontrolled mode: animate out, then report it - once, however often
    // the close button is clicked meanwhile
    if (closeTimeoutRef.current) return;

    setInternalIsOpen(false);

    closeTimeoutRef.current = setTimeout(() => {
      setIsClosed(true);
      returnFocusRef.current?.focus();
      onClose?.();
    }, 200);
  }, [closeDisabled, isControlled, onClose]);

  // Uncontrolled mode opens itself right after mounting, so it animates in
  useEffect(() => {
    if (isControlled) return;

    openTimeoutRef.current = setTimeout(() => setInternalIsOpen(true), 10);

    return () => {
      if (openTimeoutRef.current) clearTimeout(openTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [isControlled]);

  // Where the focus was before the dialog opened - it goes back there on
  // close. Insertion effects run before the layout phase, in which an
  // `autoFocus` field of the dialog takes the focus.
  useInsertionEffect(() => {
    if (isRendered) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
    }
  }, [isRendered]);

  // While open: lock the page scroll
  useEffect(() => {
    if (!isRendered) return;
    return lockPageScroll();
  }, [isRendered]);

  // The topmost overlay closes on Escape - unless an open popover, dropdown
  // or tooltip inside has handled it already
  useEffect(() => {
    if (!isRendered) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        !isTopmostOverlay(dialogId)
      ) {
        return;
      }
      event.preventDefault();
      handleClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dialogId, handleClose, isRendered]);

  // Tab stays inside, and focus that lands outside comes back - not during
  // the closing animation, when it goes back where it was
  useFocusTrap(isOpen, dialogId, dialogRef);

  // Move the focus into the dialog, and back where it was once it closes
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    // Unless an `autoFocus` field has taken it already
    if (!dialog.contains(document.activeElement)) {
      const tabbableElements = getTabbableElements(dialog);
      // Skip the close button in the header when there is anything else
      (
        tabbableElements.find(
          (element) => element !== closeButtonRef.current,
        ) ?? tabbableElements[0]
      )?.focus();
    }

    if (!isControlled) return;

    const returnFocus = returnFocusRef.current;
    return () => returnFocus?.focus?.();
  }, [isControlled, isOpen]);

  const ariaProps = title
    ? { "aria-labelledby": titleId }
    : ariaLabel
      ? { "aria-label": ariaLabel }
      : {};

  if (!isRendered || typeof document === "undefined") {
    return null;
  }

  const closeButton = (
    <IconButton
      aria-label={messages.dialog.close}
      className="opacity-70 hover:opacity-100"
      disabled={closeDisabled}
      onClick={handleClose}
      ref={closeButtonRef}
    >
      <X size={18} />
    </IconButton>
  );

  // Rendered into the body: callers often sit inside a stacking context that
  // traps a `fixed` child (a sticky table cell, a transformed panel), which
  // would let sticky table headers and similar paint over the dialog.
  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        // A click on the backdrop leaves the focus in the dialog
        onMouseDown={(event) => event.preventDefault()}
      />

      <div
        {...props}
        {...ariaProps}
        aria-modal="true"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-full max-w-11/12 -translate-x-1/2 -translate-y-1/2 scale-95 transform flex-col overflow-hidden rounded-lg border border-neutral-200 bg-background opacity-0 shadow-md transition-all duration-200 focus:outline-none dark:border-neutral-800 dark:bg-background-dark",
          sizeClasses[size],
          isOpen && "scale-100 opacity-100",
          className,
        )}
        ref={dialogRef}
        role="dialog"
        // Focusable, so a click on its text keeps the focus inside
        tabIndex={-1}
      >
        {title ? (
          <header className="sticky top-0 z-1 flex items-center justify-between border-b border-neutral-200 bg-surface px-6 py-3.25 dark:border-neutral-800 dark:bg-surface-dark">
            <h2 className="font-semibold" id={titleId}>
              {title}
            </h2>
            <div className="inline-flex">{closeButton}</div>
          </header>
        ) : (
          <div className="sticky top-0 z-1 flex items-center justify-end border-b border-neutral-200 bg-surface px-4 py-3.25 dark:border-neutral-800 dark:bg-surface-dark">
            {closeButton}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6 pb-17">
          <OverlayContext value={childContext}>{children}</OverlayContext>
        </div>
      </div>
    </>,
    document.body,
  );
}

/**
 * Buttons pinned to the bottom of a `Dialog` - place it last inside the
 * dialog content.
 */
export function DialogFooter({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "absolute right-0 bottom-0 left-0 z-10 rounded-b-lg border-t border-neutral-200 bg-surface px-6 py-3.25 dark:border-neutral-800 dark:bg-surface-dark",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
