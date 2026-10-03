import cn from "../../utils/cn";

export interface RequiredMarkProps extends Omit<
  React.ComponentProps<"span">,
  "children"
> {
  /** Classes of the star. */
  className?: string;
}

/**
 * The star after the label of a required field - what the fields of the
 * library show for `required`, for a label of your own. It is hidden from
 * screen readers, which hear "required" from the field itself.
 * `data-required-mark="hidden"` on an element around - a form that marks
 * its optional fields instead - hides the stars in it (the CSS class of
 * the star is `cui-required-mark`).
 */
export default function RequiredMark({
  className,
  ...props
}: RequiredMarkProps) {
  return (
    <span
      aria-hidden="true"
      {...props}
      className={cn(
        "cui-required-mark text-danger-700 dark:text-danger-400",
        className,
      )}
    >
      *
    </span>
  );
}
