import { cn } from "../utils/cn";
import { type ReactNode, useEffect, useRef, useState } from "react";

export interface CollapsibleContentProps {
  className?: string;
  /** Length of the height animation in milliseconds. */
  duration?: number;
  children: ReactNode;
  isOpen: boolean;
}

/**
 * Animates its children in and out by height. Closed content is unmounted
 * once the animation ends.
 */
export default function CollapsibleContent({
  className,
  duration = 300,
  children,
  isOpen,
}: CollapsibleContentProps) {
  const [isVisible, setIsVisible] = useState(isOpen);

  const contentRef = useRef<HTMLDivElement>(null);
  // Content rendered open is shown as it is - only changes animate
  const animatedOpen = useRef(isOpen);

  useEffect(() => {
    const element = contentRef.current;
    if (!element || animatedOpen.current === isOpen) return;

    animatedOpen.current = isOpen;
    const timers: ReturnType<typeof setTimeout>[] = [];

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

      // After animation completes, remove fixed height
      timers.push(
        setTimeout(() => {
          element.style.height = "auto";
        }, duration),
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
      className={cn("overflow-hidden transition-all ease-in-out", className)}
      ref={contentRef}
      style={{
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}
