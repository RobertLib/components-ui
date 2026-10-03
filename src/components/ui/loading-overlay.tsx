import { useLayoutEffect, useRef } from "react";
import { attachRef } from "../../hooks/use-form-control";
import cn from "../../utils/cn";
import Spinner, { type SpinnerSize } from "./spinner";
import { useMessages } from "../../providers/ui-context";

export interface LoadingOverlayProps extends React.ComponentProps<"div"> {
  /** Blurs the covered content a little - it reads less, but shows. */
  blur?: boolean;
  /** The region the overlay covers while `visible`. */
  children?: React.ReactNode;
  /**
   * Classes of the region - it is `relative`, the overlay covers it. Give
   * it the size and the radius of what it covers, e.g. `rounded-lg`.
   */
  className?: string;
  /**
   * Text under the spinner, e.g. "Loading orders…" - also what screen
   * readers hear. The localized "Loading…" is heard without it, not shown.
   */
  label?: string;
  /** Classes of the translucent layer over the content. */
  overlayClassName?: string;
  /**
   * Size of the spinner.
   * @default "lg"
   */
  spinnerSize?: SpinnerSize;
  /**
   * Covers the content - it fades in, and out again when this turns
   * `false` (at once for users who prefer reduced motion).
   */
  visible?: boolean;
}

/**
 * Covers its content with a translucent layer and a spinner while it
 * loads, e.g. a table that fetches its next page - the content stays in
 * sight, but cannot be clicked or reached by the keyboard (`inert`), and
 * the region is `aria-busy`. Screen readers hear the `label` once it
 * shows; a focus in the content moves to the region meanwhile and back
 * afterwards.
 */
export default function LoadingOverlay({
  blur = false,
  children,
  className,
  label,
  overlayClassName,
  ref,
  spinnerSize = "lg",
  visible = false,
  ...props
}: LoadingOverlayProps) {
  const messages = useMessages();
  const regionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // The element that had the focus in the content when it was covered
  const coveredFocusRef = useRef<HTMLElement | null>(null);

  // The covered content is inert - a focus in it would drop to the page.
  // The region holds it meanwhile, and gives it back.
  useLayoutEffect(() => {
    const region = regionRef.current;
    const content = contentRef.current;
    if (!region || !content) return;

    if (visible) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && content.contains(active)) {
        coveredFocusRef.current = active;
        region.focus({ preventScroll: true });
      }
      return;
    }

    const covered = coveredFocusRef.current;
    coveredFocusRef.current = null;
    const active = document.activeElement;
    if (
      covered?.isConnected &&
      (active === region || !active || active === document.body)
    ) {
      covered.focus({ preventScroll: true });
    }
  }, [visible]);

  return (
    <div
      aria-busy={visible || undefined}
      {...props}
      className={cn("relative focus:outline-hidden", className)}
      ref={(element) => {
        regionRef.current = element;
        const detachRef = attachRef(ref, element);
        return () => {
          regionRef.current = null;
          detachRef();
        };
      }}
      // Holds the focus of the covered content
      tabIndex={visible ? -1 : props.tabIndex}
    >
      <div className="contents" inert={visible} ref={contentRef}>
        {children}
      </div>

      {/* Visible or not, the same element - it fades out, not away */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-surface/70 text-primary-600 transition-[opacity,visibility] duration-200 motion-reduce:transition-none dark:bg-surface-dark/70 dark:text-primary-400",
          blur && "backdrop-blur-[2px]",
          visible ? "visible opacity-100" : "invisible opacity-0",
          overlayClassName,
        )}
        data-loading-overlay=""
      >
        <Spinner aria-hidden="true" size={spinnerSize} />
        {label && (
          <span className="px-4 text-center text-sm font-medium text-neutral-700 dark:text-neutral-200">
            {label}
          </span>
        )}
      </div>

      {/* Filled once it shows - a change of the text is heard */}
      <span className="sr-only" role="status">
        {visible ? (label ?? messages.common.loading) : ""}
      </span>
    </div>
  );
}
