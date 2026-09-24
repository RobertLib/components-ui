import cn from "../utils/cn";

export interface FormDescriptionProps extends React.ComponentProps<"p"> {
  /** The text - without it nothing is rendered. */
  children?: React.ReactNode;
}

/**
 * Help text of a form field, e.g. the expected format. Give it an `id` and
 * list it in the field's `aria-describedby` - the fields of the library do
 * that with their `description` prop. Renders nothing without children, so
 * it can be placed unconditionally.
 */
export default function FormDescription({
  className,
  children,
  ...props
}: FormDescriptionProps) {
  if (!children) return null;

  return (
    <p
      {...props}
      className={cn(
        "text-xs text-neutral-600 dark:text-neutral-400",
        className,
      )}
    >
      {children}
    </p>
  );
}
