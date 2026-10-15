import { useCallback, useState } from "react";
import { attachRef } from "../../hooks/use-form-control";
import { useMessages } from "../../providers/ui-context";
import cn from "../../utils/cn";

export interface FormActionsProps extends React.ComponentProps<"div"> {
  /**
   * The buttons - Cancel first, then the submit button, which ends up at
   * the end. Side by side at the end of the bar, under each other and as
   * wide as the bar where it is narrow (a phone).
   */
  children?: React.ReactNode;
  /** Classes of the bar. */
  className?: string;
  /**
   * The form has unsaved changes - the bar says so ("Unsaved changes")
   * unless it has a `status`.
   */
  dirty?: boolean;
  /**
   * A short text at the start of the bar - e.g. when the form was saved
   * last. Screen readers read it as it changes.
   */
  status?: React.ReactNode;
  /**
   * Keeps the bar at the bottom of the screen (or of the scrolling element
   * around, a dialog) while the end of the form is out of view - with a
   * line and a shadow over the fields scrolling under it, and room for the
   * home indicator of a phone. Put it last in the form: the end of the
   * form is where it stays once it is reached.
   * @default false
   */
  sticky?: boolean;
}

/** Whether a slot renders anything - the `false` of a condition does not. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

/** The element `element` scrolls in - `null` for the page. */
function scrollParentOf(element: Element) {
  const page = element.ownerDocument.scrollingElement;
  for (
    let parent = element.parentElement;
    parent && parent !== page && parent !== element.ownerDocument.body;
    parent = parent.parentElement
  ) {
    if (/auto|scroll|overlay|hidden/.test(getComputedStyle(parent).overflowY)) {
      return parent;
    }
  }
  return null;
}

/**
 * The bar of the buttons of a form - Cancel and Save at its end, a status
 * ("Unsaved changes") at its start. `sticky` keeps it in view at the bottom
 * of a long form until its end is reached. Left out when printed.
 */
export default function FormActions({
  children,
  className,
  dirty = false,
  ref,
  status,
  sticky = false,
  ...props
}: FormActionsProps) {
  const messages = useMessages().ui;
  // Stuck at the bottom with fields under it - not where the form ends
  const [stuck, setStuck] = useState(false);
  const shownStatus = hasContent(status)
    ? status
    : dirty
      ? messages.formActions.unsavedChanges
      : null;
  const hasStatus = shownStatus !== null;

  const barRef = useCallback(
    (element: HTMLDivElement | null) => {
      const detachRef = attachRef(ref, element);
      if (!element || !sticky || typeof IntersectionObserver === "undefined") {
        return detachRef;
      }

      // A bar stuck to the bottom edge reaches 1 px past the root shrunk by
      // 1 px - one at rest in the form is all in, one scrolled away above
      // is not at the bottom
      const observer = new IntersectionObserver(
        ([entry]) => {
          const bottom = entry.rootBounds?.bottom ?? window.innerHeight;
          setStuck(
            entry.intersectionRatio < 1 &&
              entry.boundingClientRect.bottom >= bottom - 1,
          );
        },
        {
          root: scrollParentOf(element),
          rootMargin: "0px 0px -1px 0px",
          threshold: [1],
        },
      );
      observer.observe(element);

      return () => {
        observer.disconnect();
        detachRef();
      };
    },
    [ref, sticky],
  );

  const isStuck = sticky && stuck;

  return (
    <div
      {...props}
      className={cn(
        // A phone has the buttons under each other, as wide as the bar
        "flex flex-col sm:flex-row sm:items-center print:hidden",
        sticky &&
          "sticky bottom-0 z-10 border-t border-transparent bg-surface pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] transition-shadow duration-200 data-stuck:border-neutral-200 data-stuck:shadow-[0_-6px_12px_-8px_rgb(0_0_0/0.25)] motion-reduce:transition-none dark:bg-surface-dark dark:data-stuck:border-neutral-800",
        className,
      )}
      data-stuck={isStuck ? "" : undefined}
      ref={barRef}
    >
      {/* In the page before it has something to say - a live region added
          with its text is not read */}
      <p
        className="text-sm text-neutral-600 sm:me-auto sm:pe-4 dark:text-neutral-400"
        role="status"
      >
        {shownStatus}
      </p>
      <div
        className={cn(
          "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end",
          hasStatus && "mt-2 sm:mt-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}
