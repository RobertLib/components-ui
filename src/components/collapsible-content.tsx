import { cn } from "../utils/cn";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

export interface CollapsibleContentProps {
  /** Classes of the animated wrapper. */
  className?: string;
  /** Length of the height animation in milliseconds. */
  duration?: number;
  /** The content that collapses. */
  children: ReactNode;
  /** Id of the wrapper, e.g. for `aria-controls` of the toggle. */
  id?: string;
  /** Whether the content is shown - a change animates it in or out. */
  isOpen: boolean;
}

// Users who asked the system for less motion see the content at once
const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Animates its children in and out by height. Closed content is unmounted
 * once the animation ends; open content is clipped only while it animates,
 * so the focus rings and shadows at its edges show. Without animation for
 * users who prefer reduced motion.
 */
export default function CollapsibleContent({
  className,
  duration = 300,
  children,
  id,
  isOpen,
}: CollapsibleContentProps) {
  const [isVisible, setIsVisible] = useState(isOpen);

  const contentRef = useRef<HTMLDivElement>(null);
  // Content rendered open is shown as it is - only changes animate
  const animatedOpen = useRef(isOpen);

  // Before the browser paints - opened content would show at its full
  // height for a frame before the animation starts from none
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element || animatedOpen.current === isOpen) return;

    animatedOpen.current = isOpen;

    if (prefersReducedMotion()) {
      element.style.height = "";
      element.style.overflow = "";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(isOpen);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    // What is outside of the animated height is cut off - until it is open
    element.style.overflow = "hidden";

    if (isOpen) {
      // If opening, make visible and measure actual content height
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);

      // Measure actual content height
      const scrollHeight = element.scrollHeight;

      // Set height from 0 to actual height
      element.style.height = "0px";
      timers.push(
        setTimeout(() => {
          element.style.height = `${scrollHeight}px`;
        }, 10),
      );

      // After animation completes, remove fixed height - and the clipping,
      // which would cut the focus rings at the edges of the content. Not
      // before the height above is set, which would then stay for good.
      timers.push(
        setTimeout(
          () => {
            element.style.height = "auto";
            element.style.overflow = "";
          },
          Math.max(duration, 10),
        ),
      );
    } else {
      // If closing, first set fixed height
      // Use current height (either auto or already set px value)
      const currentHeight =
        element.style.height === "auto" || element.style.height === ""
          ? element.scrollHeight
          : parseInt(element.style.height);

      element.style.height = `${currentHeight}px`;

      // Then animate to 0
      timers.push(
        setTimeout(() => {
          element.style.height = "0px";
        }),
      );

      // After animation completes, hide element
      timers.push(setTimeout(() => setIsVisible(false), duration));
    }

    // A toggle in the middle of the animation starts over from here
    return () => timers.forEach(clearTimeout);
  }, [duration, isOpen]);

  if (!isVisible && !isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "transition-all ease-in-out motion-reduce:transition-none",
        className,
      )}
      id={id}
      ref={contentRef}
      style={{
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}
