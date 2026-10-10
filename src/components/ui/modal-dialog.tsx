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
import cn from "../../utils/cn";
import Button, { type ButtonProps } from "./button";
import IconButton from "./icon-button";
import {
  getActiveElement,
  getActiveFocusReturnTargets,
  hasModalOverlayFrom,
  isEscapeKey,
  isTopmostOverlay,
  lockPageScroll,
  OverlayContext,
  returnFocus,
  useFocusTrap,
  useOverlayLayer,
} from "./overlay-stack";
import { attachRef } from "../../hooks/use-form-control";
import isPromiseLike from "../../utils/is-promise-like";
import { composedContains, getTabbableElements } from "../../utils/tabbable";
import { useMessages, usePortalContainer } from "../../providers/ui-context";
import { ButtonGroupContext } from "./button-group-context";

/**
 * How a `DialogFooter` makes room for itself: the body of its dialog leaves
 * its height free, so the footer covers no content.
 */
interface FooterSlot {
  /** Classes of the footer, e.g. its rounded corners. */
  className?: string;
  /** Follows the height of `footer` - returns what stops it. */
  observe: (footer: HTMLElement) => () => void;
}

// Set by every Dialog and Sheet: the footer of a Dialog opened from a Sheet
// (a ConfirmDialog) belongs to that Dialog, not to the sheet around.
const FooterSlotContext = /* @__PURE__ */ createContext<FooterSlot | null>(
  null,
);

// Closes the dialog around as its close button does - see DialogCloseButton
const DialogCloseContext = /* @__PURE__ */ createContext<(() => void) | null>(
  null,
);

const subscribeToNothing = () => () => {};

// A swipe down on the header this long - or a quick flick of a few pixels -
// closes a sheet that can be swiped away
const SWIPE_CLOSE_DISTANCE = 80;
const SWIPE_CLOSE_VELOCITY = 0.5;
const SWIPE_FLICK_DISTANCE = 16;

// Controls in the header a swipe does not start on
const SWIPE_EXEMPT = "a[href], button, input, select, textarea, [role=button]";

/**
 * The implementation `Dialog` and `Sheet` share - they differ in the classes
 * they give it. Its header, its body and a `DialogFooter` keep off the
 * notch and the home indicator of a phone by the insets the panel classes
 * put into `--cui-safe-top` / `--cui-safe-bottom` - an edge of the panel at
 * an edge of the screen sets them to `env(safe-area-inset-*)`.
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
   * Escape closes the dialog (unless `closeDisabled`). Off, an Escape while
   * it is the topmost overlay does nothing - it is used up all the same.
   */
  closeOnEscape?: boolean;
  /**
   * Classes of the panel while it is closed - before it animates in and
   * while it animates out.
   */
  closedClassName?: string;
  /** How long the closing animation takes, in milliseconds. */
  duration: number;
  /** Classes of a `DialogFooter` in it, e.g. its rounded corners. */
  footerClassName?: string;
  /** See `DialogProps.onBeforeClose` - also a thenable of another library. */
  onBeforeClose?: () => boolean | void | PromiseLike<boolean | void>;
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
  /**
   * A swipe down on the header closes the dialog on touch screens (unless
   * `closeDisabled`) - the panel follows the finger, and a handle on the
   * header shows it can be dragged. For a sheet at the bottom of the screen.
   */
  swipeToClose?: boolean;
  /** See `DialogProps.title`. */
  title?: React.ReactNode;
}

/**
 * A modal window: the backdrop, the panel with its header and a scrolling
 * body, rendered into the body (the `portalContainer` of `UIProvider`).
 * Traps the focus and gives it back, closes on Escape through the overlay
 * stack and locks the page scroll while open. `ref`, the `className` and
 * the other props are the panel's - the element with the `role`; it and
 * the backdrop have `data-state="open"` or `"closed"` (also while they
 * animate in and out).
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
  closeOnEscape = true,
  duration,
  footerClassName,
  onBeforeClose,
  onClose,
  open,
  openClassName,
  panelClassName,
  role = "dialog",
  swipeToClose = false,
  title,
  "aria-label": ariaLabel,
  ref,
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
  const messages = useMessages().ui;
  const getPortalContainer = usePortalContainer();

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
  // The times it was opened, which tell the answers of `onBeforeClose` of
  // each apart - counted in the render, so also while it is hidden
  // (`<Activity>`) and runs no effects
  const [openings, setOpenings] = useState(0);

  if (isRequestedOpen !== wasRequestedOpen) {
    setWasRequestedOpen(isRequestedOpen);
    if (isRequestedOpen) setOpenings(openings + 1);
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
  // closes alone - and only the topmost modal one traps the focus. A
  // dialog opened from it that closes after it gives the focus back where
  // this one would have.
  const { childContext, id: dialogId } = useOverlayLayer(isRequestedOpen, {
    getElements: () => [dialogRef.current],
    getReturnTargets: () => returnFocusRef.current,
    modal: true,
    portaled: true,
  });

  const close = useCallback(() => {
    if (isControlled) {
      onClose?.();
      return;
    }

    // Uncontrolled mode: animate out, then report it - once, however often
    // the close button is clicked meanwhile
    setCloseRequested(true);
  }, [isControlled, onClose]);

  // `onBeforeClose` answers with a promise: the dialog closes once it
  // resolves - if it may still close then, as the latest render has it -
  // and further requests to close wait for that answer
  const closeAfterAnswerRef = useRef(close);
  // The time the dialog is open on the page, `null` while it is closed,
  // hidden or unmounted. An answer closes it only at the time it was asked
  // in - not once its owner closed it or it was unmounted, nor once it was
  // opened again. Hidden and shown again (`<Activity>`, a Suspense boundary
  // above) it is the same time; an answer that came while it was hidden
  // closes nothing.
  const openingRef = useRef<number | null>(null);
  // The time of the question that waits for its answer - opened again, the
  // dialog does not wait for an answer that may never come
  const askedInRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    closeAfterAnswerRef.current = () => {
      if (!closeDisabled && isRequestedOpen) close();
    };
  });

  useLayoutEffect(() => {
    if (!isRequestedOpen) return;
    openingRef.current = openings;
    return () => {
      openingRef.current = null;
    };
  }, [isRequestedOpen, openings]);

  const handleClose = useCallback(() => {
    // Closed already, animating out - or waiting for an answer
    if (
      closeDisabled ||
      !isRequestedOpen ||
      askedInRef.current === openingRef.current
    ) {
      return;
    }

    const answer = onBeforeClose?.();
    if (answer === false) return;

    // Also a thenable of another promise library or realm
    if (isPromiseLike(answer)) {
      const opening = openingRef.current;
      askedInRef.current = opening;
      // A question of a later time still waits for its own answer
      const answered = () => {
        if (askedInRef.current === opening) askedInRef.current = null;
      };
      Promise.resolve(answer).then(
        (allowed) => {
          answered();
          if (allowed !== false && opening === openingRef.current) {
            closeAfterAnswerRef.current();
          }
        },
        // Rejected - it stays open
        answered,
      );
      return;
    }

    close();
  }, [close, closeDisabled, isRequestedOpen, onBeforeClose]);

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
  // back then and tells the parent. Not the focus while a dialog opened
  // from it is still open - its focus trap keeps it, and gives it back
  // where this one would have once it closes.
  useEffect(() => {
    if (!exiting) return;

    const timer = setTimeout(() => {
      setExiting(false);
      if (isControlled) return;

      focusReturnedRef.current = true;
      if (!hasModalOverlayFrom(dialogId)) {
        returnFocus(returnFocusRef.current, dialogRef.current);
      }
      onCloseRef.current?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [dialogId, duration, exiting, isControlled]);

  // Uncontrolled mode, unmounted by the parent while open or closing - the
  // focus that went with the dialog goes back where it was, not to the page.
  // Not once the closing animation has given it back, nor when it is
  // elsewhere (StrictMode runs this cleanup on mount too).
  useEffect(() => {
    if (isControlled) return;

    return () => {
      const active = getActiveElement();
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
      // Used up also when it does not close the dialog - the dialog under
      // it, or the page, must not take it
      event.preventDefault();
      if (closeOnEscape) handleClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, dialogId, handleClose, isRequestedOpen]);

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

  // Move the focus into the dialog, and back where it was once it closes -
  // unless a dialog opened from it is still open (see above)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    // Unless an `autoFocus` field has taken it already
    if (!composedContains(dialog, getActiveElement())) {
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
      if (!hasModalOverlayFrom(dialogId)) returnFocus(targets, dialog);
    };
  }, [dialogId, isControlled, isOpen]);

  // The height of the DialogFooter in it, which the body leaves free under
  // its padding - the content as far from the footer as from the header
  const [footerHeight, setFooterHeight] = useState(0);
  const footerSlot = useMemo<FooterSlot>(
    () => ({
      className: footerClassName,
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
    [footerClassName],
  );

  // `swipeToClose`: how far the finger has dragged the panel down, while it
  // does - the panel follows it without a transition
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const dragRef = useRef<{
    id: number;
    lastTime: number;
    lastY: number;
    startY: number;
    velocity: number;
  } | null>(null);
  const canSwipe = swipeToClose && !closeDisabled && isOpen;

  // Disabled while dragged - e.g. its form started saving: back in place
  if (!canSwipe && dragOffset !== null) setDragOffset(null);

  const endDrag = (event: React.PointerEvent<HTMLElement>, cancel: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;

    // Back to its place, or out - animated from where the finger left it,
    // as both happen in one render: its offset goes as its classes change
    setDragOffset(null);
    const distance = event.clientY - drag.startY;
    if (
      !cancel &&
      (distance >= SWIPE_CLOSE_DISTANCE ||
        (distance >= SWIPE_FLICK_DISTANCE &&
          drag.velocity >= SWIPE_CLOSE_VELOCITY))
    ) {
      handleClose();
    }
  };

  const swipeHandlers = canSwipe
    ? {
        onPointerCancel: (event: React.PointerEvent<HTMLElement>) =>
          endDrag(event, true),
        onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
          if (
            event.pointerType === "mouse" ||
            !event.isPrimary ||
            (event.target instanceof Element &&
              event.target.closest(SWIPE_EXEMPT))
          ) {
            return;
          }
          dragRef.current = {
            id: event.pointerId,
            lastTime: event.timeStamp,
            lastY: event.clientY,
            startY: event.clientY,
            velocity: 0,
          };
          // The moves reach the header also once the finger leaves it
          event.currentTarget.setPointerCapture?.(event.pointerId);
        },
        onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
          const drag = dragRef.current;
          if (!drag || drag.id !== event.pointerId) return;

          const elapsed = event.timeStamp - drag.lastTime;
          if (elapsed > 0) {
            drag.velocity = (event.clientY - drag.lastY) / elapsed;
          }
          drag.lastTime = event.timeStamp;
          drag.lastY = event.clientY;
          // Down only - up, it stays where it is
          setDragOffset(Math.max(0, event.clientY - drag.startY));
        },
        onPointerUp: (event: React.PointerEvent<HTMLElement>) =>
          endDrag(event, false),
      }
    : {};

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

  // Shows on touch screens that the sheet can be swiped down - the swipe is
  // a shortcut for the close button, which screen readers use instead
  const swipeHandle = (
    <span
      aria-hidden="true"
      className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-neutral-300 dark:bg-neutral-600 pointer-fine:hidden"
    />
  );

  const state = isOpen ? "open" : "closed";

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
          data-state={state}
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
          data-state={state}
          // The dialog's own ref, and the one given to it
          ref={(element) => {
            dialogRef.current = element;
            const detachRef = attachRef(ref, element);
            return () => {
              dialogRef.current = null;
              detachRef();
            };
          }}
          role={role}
          style={
            dragOffset === null
              ? props.style
              : // Follows the finger at once
                {
                  ...props.style,
                  transition: "none",
                  translate: `0 ${dragOffset}px`,
                }
          }
          // Focusable, so a click on its text keeps the focus inside
          tabIndex={-1}
        >
          {title ? (
            <header
              className={cn(
                "sticky top-0 z-1 flex items-center justify-between border-b border-neutral-200 bg-surface px-6 pt-[calc(0.8125rem+var(--cui-safe-top,0px))] pb-3.25 dark:border-neutral-800 dark:bg-surface-dark",
                swipeToClose && "touch-none",
              )}
              {...swipeHandlers}
            >
              {swipeToClose && swipeHandle}
              <h2 className="font-heading text-section-title" id={titleId}>
                {title}
              </h2>
              <div className="inline-flex">{closeButton}</div>
            </header>
          ) : (
            <div
              className={cn(
                "sticky top-0 z-1 flex items-center justify-end border-b border-neutral-200 bg-surface px-4 pt-[calc(0.8125rem+var(--cui-safe-top,0px))] pb-3.25 dark:border-neutral-800 dark:bg-surface-dark",
                swipeToClose && "touch-none",
              )}
              {...swipeHandlers}
            >
              {swipeToClose && swipeHandle}
              {closeButton}
            </div>
          )}
          <div
            className={cn(
              "flex-1 overflow-y-auto p-6",
              // Not the margin of a `space-y` form either: the footer out of
              // the flow is its last child, the content before it gets one.
              // With content after the footer, that content is the last one
              // and the margin stays between the two
              "[&_:has(+[data-dialog-footer]:last-child)]:mb-0",
              // Clear of the home indicator without a footer too - a margin,
              // which another padding of `bodyClassName` keeps and a margin
              // of it replaces
              footerHeight === 0 && "mb-(--cui-safe-bottom,0px)",
              bodyClassName,
            )}
            style={
              footerHeight > 0
                ? { paddingBottom: `calc(${footerHeight}px + 1.5rem)` }
                : undefined
            }
          >
            <DialogCloseContext value={handleClose}>
              <FooterSlotContext value={footerSlot}>
                {children}
              </FooterSlotContext>
            </DialogCloseContext>
          </div>
        </div>
      </OverlayContext>
    </ButtonGroupContext>,
    getPortalContainer(),
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
        // Above the home indicator of a phone at the bottom of its screen.
        // No margin of a `space-y` form with content after it - it would
        // lift the footer off the bottom
        "absolute inset-x-0 bottom-0 z-10 m-0 border-t border-neutral-200 bg-surface px-6 pt-3.25 pb-[calc(0.8125rem+var(--cui-safe-bottom,0px))] dark:border-neutral-800 dark:bg-surface-dark",
        slot?.className,
        className,
      )}
      data-dialog-footer=""
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

/**
 * A `Button` that closes the `Dialog` or `Sheet` it is in as the close
 * button of its header does - it asks `onBeforeClose`, and waits for its
 * answer with the other requests to close. Cancel of a `FormDialog`.
 */
export function DialogCloseButton(props: Omit<ButtonProps, "onClick">) {
  const requestClose = use(DialogCloseContext);

  return <Button {...props} onClick={() => requestClose?.()} />;
}
