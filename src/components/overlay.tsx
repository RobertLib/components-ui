import { createPortal } from "react-dom";
import cn from "../utils/cn";

export type OverlayProps = React.ComponentProps<"div">;

/** A dimmed full-screen backdrop, rendered into `document.body`. */
export default function Overlay({ className, ...props }: OverlayProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      {...props}
      className={cn(
        "fixed inset-0 z-30 animate-fade-in bg-black/50",
        className,
      )}
    />,
    document.body,
  );
}
