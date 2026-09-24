import cn from "../utils/cn";

export interface VisuallyHiddenProps extends React.ComponentProps<"span"> {
  /**
   * Shows the content while it, or an element in it, has the focus - e.g. a
   * "Skip to content" link. Style the shown state with `className` (e.g.
   * `fixed top-2 left-2`) - while hidden, the content is clipped away
   * whatever the classes say.
   */
  focusable?: boolean;
}

/**
 * Content for screen readers only - hidden from the eye, not from assistive
 * technology, e.g. a label of an icon or the unit of a number. An inline
 * `<span>`, so it fits into buttons, links and text.
 */
export default function VisuallyHidden({
  className,
  focusable = false,
  ...props
}: VisuallyHiddenProps) {
  return (
    <span
      {...props}
      className={cn(
        // Focused, the classes of the page are all that is left
        focusable ? "not-focus-within:sr-only" : "sr-only",
        className,
      )}
    />
  );
}
