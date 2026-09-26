import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import cn from "../utils/cn";
import IconButton from "./icon-button";
import {
  getActiveFocusReturnTargets,
  isEscapeKey,
  isTopmostOverlay,
  lockPageScroll,
  OverlayContext,
  returnFocus,
  useFocusTrap,
  useOverlayLayer,
} from "./overlay-stack";
import { attachRef } from "../hooks/use-form-control";
import { getTabbableElements } from "../utils/tabbable";
import { useMessages } from "../providers/ui-context";
import { ButtonGroupContext } from "./button-group-context";

/**
 * How a `DialogFooter` in a Sheet makes room for itself: the body of the
 * sheet leaves its height free, so the footer covers no content.
 */
interface FooterSlot {
  /** Follows the height of `footer` - returns what stops it. */
  observe: (footer: HTMLElement) => () => void;
}

// Set by a Sheet. A Dialog sets null: the footer of a Dialog opened from a
// Sheet (a ConfirmDialog) belongs to that Dialog, not to the sheet around.
const FooterSlotContext = createContext<FooterSlot | null>(null);

const subscribeToNothing = () => () => {};

/**
 * The implementation `Dialog` and `Sheet` share - they differ in the classes
 * they give it.
 */
export interface ModalDialogProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /**
   * Animates opening and closing also when controlled - a controlled
   * Dialog appears and goes at once, a Sheet slides in and out.
   */
  animateControlled?: boolean;
  /** Classes of the backdrop, e.g. the length of its fade. */
  backdropClassName?: string;
  /** Classes of the scrolling body. */
  bodyClassName?: string;
  /** See `DialogProps.closeDisabled`. */
  closeDisabled?: boolean;
  /** A click on the backdrop closes the dialog (unless `closeDisabled`). */
  closeOnBackdropClick?: boolean;
  /**
   * Classes of the panel while it is closed - before it animates in and
   * while it animates out.
   */
  closedClassName?: string;
  /** How long the closing animation takes, in milliseconds. */
  duration: number;
  /**
   * The body leaves the height of a `DialogFooter` free. Without it the
   * footer has the fixed room the body classes give it.
   */
  fitFooter?: boolean;
  /** See `DialogProps.onClose`. */
  onClose?: () => void;
  /** See `DialogProps.open`. */
  open?: boolean;
  /** Classes of the panel while it is open. */
  openClassName?: string;
  /** Classes of the panel - its place, size and animation. */
  panelClassName?: string;
  /** See `DialogProps.role`. */
  role?: "alertdialog" | "dialog";
  /** See `DialogProps.title`. */
  title?: React.ReactNode;
}

/**
 * A modal window: the backdrop, the panel with its header and a scrolling
 * body, rendered into the body. Traps the focus and gives it back, closes on
 * Escape through the overlay stack and locks the page scroll while open.
 */
export default function ModalDialog({
  animateControlled = false,
  backdropClassName,
  bodyClassName,
  children,
  className,
  closeDisabled = false,
  closedClassName,
  closeOnBackdropClick = false,
  duration,
  fitFooter = false,
  onClose,
  open,
  openClassName,
  panelClassName,
  role = "dialog",
  title,
  "aria-label": ariaLabel,
  ...props
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Where the focus goes back to, best first - see getFocusReturnTargets
  const returnFocusRef = useRef<HTMLElement[]>([]);
  // Uncontrolled mode: the closing animation is over and the focus is back
  const focusReturnedRef = useRef(false);
  // The `onClose` of the last render - an uncontrolled dialog calls it once
  // it has animated out
  const onCloseRef = useRef(onClose);
  const messages = useMessages();

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  const isControlled = open !== undefined;
  const isAnimated = !isControlled || animateControlled;

  // False on the server and while a server-rendered page hydrates, which
  // has no portal in its HTML - an open dialog opens right after. Rendered
  // on the client only, it is true at once.
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  // Uncontrolled mode: the user has closed it (close button, Escape)
  const [closeRequested, setCloseRequested] = useState(false);
  const isRequestedOpen = isHydrated && (isControlled ? open : !closeRequested);

  // Animated, it is rendered closed first and opened a moment later, so the
  // change animates; closed, it stays rendered until it has animated out
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [wasRequestedOpen, setWasRequestedOpen] = useState(isRequestedOpen);

  if (isRequestedOpen !== wasRequestedOpen) {
    setWasRequestedOpen(isRequestedOpen);
    setEntered(false);
    setExiting(isAnimated && !isRequestedOpen);
  }

  const isOpen = isAnimated ? isRequestedOpen && entered : isRequestedOpen;
  const isRendered = isAnimated ? isRequestedOpen || exiting : isRequestedOpen;
  // Animating out - no longer to be clicked, and out of the overlay stack:
  // the next Escape is for the overlay under it
  const isClosing = isRendered && !isRequestedOpen;

  const titleId = useId();

  // In the overlay stack shared with popovers, tooltips and the drawer: only
  // the topmost overlay handles Escape - a ConfirmDialog opened from a Dialog
  // closes alone - and only the topmost modal one traps the focus
  const { childContext, id: dialogId } = useOverlayLayer(isRequestedOpen, {
    getElements: () => [dialogRef.current],
    modal: true,
  });

  const handleClose = useCallback(() => {
    // Closed already, animating out
    if (closeDisabled || !isRequestedOpen) return;

    if (isControlled) {
      onClose?.();
      return;
    }

    // Uncontrolled mode: animate out, then report it - once, however often
    // the close button is clicked meanwhile
    setCloseRequested(true);
  }, [closeDisabled, isControlled, isRequestedOpen, onClose]);

  // Opens right after it is rendered closed, so it animates in
  useEffect(() => {
    if (!isAnimated || !isRequestedOpen || entered) return;

    // Laid out closed first - a browser that has not computed the closed
    // styles yet would show it open at once
    dialogRef.current?.getBoundingClientRect();
    const timer = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(timer);
  }, [entered, isAnimated, isRequestedOpen]);

  // Gone once it has animated out. An uncontrolled dialog gives the focus
  // back then and tells the parent.
  useEffect(() => {
    if (!exiting) return;

    const timer = setTimeout(() => {
      setExiting(false);
      if (isControlled) return;

      focusReturnedRef.current = true;
      returnFocus(returnFocusRef.current, dialogRef.current);
      onCloseRef.current?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, exiting, isControlled]);

  // Uncontrolled mode, unmounted by the parent while open or closing - the
  // focus that went with the dialog goes back where it was, not to the page.
  // Not once the closing animation has given it back, nor when it is
  // elsewhere (StrictMode runs this cleanup on mount too).
  useEffect(() => {
    if (isControlled) return;

    return () => {
      const active = document.activeElement;
      if (!focusReturnedRef.current && (!active || active === document.body)) {
        returnFocus(returnFocusRef.current);
      }
    };
  }, [isControlled]);

  // Where the focus was before the dialog opened - it goes back there on
  // close, or to the trigger of the popover it was in when that has closed
  // meanwhile - also when the popover closed in this same commit, taking the
  // focus with its panel - or, when that is gone too (the row the dialog
  // deleted), to the Tab stop next to it. Insertion effects run before the
  // layout phase, in which an `autoFocus` field of the dialog takes the
  // focus. Read at every opening - also when it opens again while it is
  // animating out, from another button (the next row of a list).
  useInsertionEffect(() => {
    if (isRequestedOpen) {
      returnFocusRef.current = getActiveFocusReturnTargets();
    }
  }, [isRequestedOpen]);

  // While open: lock the page scroll
  useEffect(() => {
    if (!isRendered) return;
    return lockPageScroll();
  }, [isRendered]);

  // The topmost overlay closes on Escape - unless an open popover, dropdown
  // or tooltip inside has handled it already
  useEffect(() => {
    if (!isRequestedOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !isEscapeKey(event) ||
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
  }, [dialogId, handleClose, isRequestedOpen]);

  // Whether the dialog was the topmost overlay when the press that ends in
  // a click on the backdrop began. A menu or popover open in it closes on
  // that press - the same click must not close the dialog too. A tooltip
  // does not count: it stays while its trigger has the focus, which the
  // press on the backdrop leaves there.
  const wasTopmostOnPressRef = useRef(false);

  useEffect(() => {
    if (!isRequestedOpen || !closeOnBackdropClick) return;

    const handlePointerDown = () => {
      wasTopmostOnPressRef.current = isTopmostOverlay(dialogId, {
        press: true,
      });
    };

    // Capture on the document, added before any menu in the dialog opened -
    // it runs before the menu handles the press and leaves the stack
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [closeOnBackdropClick, dialogId, isRequestedOpen]);

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
      // Skip the close button in the header when there is anything else.
      // With nothing to focus (a disabled close button, no fields) the
      // dialog takes the focus itself - it must not stay on the button
      // that opened it, where Enter would press it again.
      (
        tabbableElements.find(
          (element) => element !== closeButtonRef.current,
        ) ??
        tabbableElements[0] ??
        dialog
      ).focus();
    }

    if (!isControlled) return;

    const targets = returnFocusRef.current;
    return () => {
      returnFocus(targets, dialog);
    };
  }, [isControlled, isOpen]);

  // The height of the DialogFooter in it, which the body leaves free
  const [footerHeight, setFooterHeight] = useState(0);
  const footerSlot = useMemo<FooterSlot>(
    () => ({
      observe: (footer) => {
        const measure = () => setFooterHeight(footer.offsetHeight);
        measure();
        // Not in every environment (jsdom) - measured once then
        const observer =
          typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(measure);
        observer?.observe(footer);
        return () => {
          observer?.disconnect();
          setFooterHeight(0);
        };
      },
    }),
    [],
  );

  const ariaProps = title
    ? { "aria-labelledby": titleId }
    : ariaLabel
      ? { "aria-label": ariaLabel }
      : {};

  if (!isRendered) return null;

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
  // All of it is in the dialog for the overlays opened in it - also its
  // title: a tooltip or popover there is not the page under the dialog
  return createPortal(
    <ButtonGroupContext value={null}>
      <OverlayContext value={childContext}>
        <div
          className={cn(
            "fixed inset-0 z-50 bg-black/50 transition-opacity",
            isOpen ? "opacity-100" : "opacity-0",
            isClosing && "pointer-events-none",
            backdropClassName,
          )}
          onClick={
            closeOnBackdropClick
              ? () => {
                  if (wasTopmostOnPressRef.current) handleClose();
                }
              : undefined
          }
          // A click on the backdrop leaves the focus in the dialog
          onMouseDown={(event) => event.preventDefault()}
        />

        <div
          {...props}
          {...ariaProps}
          aria-modal="true"
          className={cn(
            panelClassName,
            isOpen ? openClassName : closedClassName,
            isClosing && "pointer-events-none",
            className,
          )}
          ref={dialogRef}
          role={role}
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
          <div
            className={cn("flex-1 overflow-y-auto p-6", bodyClassName)}
            style={
              fitFooter && footerHeight > 0
                ? { paddingBottom: `calc(${footerHeight}px + 1.5rem)` }
                : undefined
            }
          >
            <FooterSlotContext value={fitFooter ? footerSlot : null}>
              {children}
            </FooterSlotContext>
          </div>
        </div>
      </OverlayContext>
    </ButtonGroupContext>,
    document.body,
  );
}

/**
 * Buttons pinned to the bottom of a `Dialog` or a `Sheet` while the content
 * scrolls - place it last inside the content, also inside a `<form>` there,
 * so its submit button submits the form.
 */
export function DialogFooter({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<"div">) {
  const slot = use(FooterSlotContext);

  return (
    <div
      className={cn(
        "absolute right-0 bottom-0 left-0 z-10 border-t border-neutral-200 bg-surface px-6 py-3.25 dark:border-neutral-800 dark:bg-surface-dark",
        // A sheet has square corners - the ones of a top sheet are clipped
        !slot && "rounded-b-lg",
        className,
      )}
      {...props}
      ref={(element) => {
        const detachRef = attachRef(ref, element);
        const stopObserving =
          element && slot ? slot.observe(element) : undefined;
        return () => {
          detachRef();
          stopObserving?.();
        };
      }}
    >
      {children}
    </div>
  );
}
