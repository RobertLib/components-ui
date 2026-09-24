import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import cn from "../utils/cn";

export interface OverlayProps extends React.ComponentProps<"div"> {
  /**
   * Renders the backdrop into `document.body`. `false` renders it in place,
   * right before the panel it dims the page for - both then share one
   * stacking context, so a panel that is not portaled either stays above
   * it also in a parent with a `transform`, a `filter` or a `z-index`.
   */
  portal?: boolean;
}

const subscribeToNothing = () => () => {};

/**
 * A dimmed full-screen backdrop, rendered into `document.body` - behind the
 * slid-in `Drawer`, or behind an overlay of your own (see `useOverlay`).
 * Handle its `onClick` to close what it is behind.
 */
export default function Overlay({
  className,
  portal = true,
  ...props
}: OverlayProps) {
  // False on the server and while a server-rendered page hydrates, which
  // has no portal in its HTML - the portaled backdrop shows right after.
  // Rendered on the client only, it is true at once.
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const backdrop = (
    <div
      {...props}
      className={cn(
        "fixed inset-0 z-30 animate-fade-in bg-black/50",
        className,
      )}
    />
  );

  if (!portal) return backdrop;
  if (!isHydrated) return null;

  return createPortal(backdrop, document.body);
}
