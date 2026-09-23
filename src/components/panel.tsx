import cn from "../utils/cn";

export interface PanelProps extends React.ComponentProps<"div"> {
  /** `default` - a subtle border in the surface color, `neutral` - a visible gray one. */
  border?: "default" | "neutral" | "none";
  /** Corner radius. */
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full" | "none";
  /** Shadow size. */
  shadow?: "sm" | "md" | "lg" | "xl" | "2xl" | "none";
}

/** A padded surface card - the base of `Accordion` and page sections. */
export default function Panel({
  border = "default",
  className,
  children,
  rounded = "md",
  shadow = "sm",
  ...props
}: PanelProps) {
  const getRoundedClass = () => {
    switch (rounded) {
      case "sm":
        return "rounded-sm";
      case "md":
        return "rounded-md";
      case "lg":
        return "rounded-lg";
      case "xl":
        return "rounded-xl";
      case "2xl":
        return "rounded-2xl";
      case "3xl":
        return "rounded-3xl";
      case "full":
        return "rounded-full";
      case "none":
        return "";
      default:
        return "rounded-md";
    }
  };

  const getShadowClass = () => {
    switch (shadow) {
      case "sm":
        return "shadow-sm";
      case "md":
        return "shadow-md";
      case "lg":
        return "shadow-lg";
      case "xl":
        return "shadow-xl";
      case "2xl":
        return "shadow-2xl";
      case "none":
        return "";
      default:
        return "shadow-md";
    }
  };

  const getBorderClass = () => {
    switch (border) {
      case "default":
        return "border border-surface/30 dark:border-surface-dark/30";
      case "neutral":
        return "border border-neutral-200 dark:border-neutral-800";
      case "none":
        return "";
      default:
        return "border border-surface/30 dark:border-surface-dark/30";
    }
  };

  return (
    <div
      {...props}
      className={cn(
        `bg-surface p-6 dark:bg-surface-dark ${getRoundedClass()} ${getShadowClass()} ${getBorderClass()}`,
        className,
      )}
    >
      {children}
    </div>
  );
}
