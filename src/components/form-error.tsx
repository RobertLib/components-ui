import cn from "../utils/cn";

export interface FormErrorProps extends React.ComponentProps<"div"> {
  children?: React.ReactNode;
}

/**
 * A validation message under a form field. Renders nothing without
 * children, so it can be placed unconditionally.
 */
export default function FormError({
  className,
  children,
  ...props
}: FormErrorProps) {
  if (!children) return null;

  return (
    <div
      {...props}
      className={cn(
        "animate-fade-in text-sm text-danger-600 dark:text-danger-400",
        className,
      )}
      role="alert"
    >
      {children}
    </div>
  );
}
