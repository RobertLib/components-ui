import cn from "../../utils/cn";

/** The room inside a `Panel` - see `PanelProps.padding`. */
export type PanelPadding = "none" | "sm" | "md" | "lg" | "responsive";

export interface PanelProps extends React.ComponentProps<"div"> {
  /** `default` - a subtle border in the surface color, `neutral` - a visible gray one. */
  border?: "default" | "neutral" | "none";
  /**
   * The room around the content - `sm` 1rem, `md` 1.5rem, `lg` 2rem,
   * `responsive` 1rem on phones and 1.5rem from the `sm` breakpoint up, or
   * `none`. It is the `--cui-panel-padding` variable, which the picture and
   * the footer of a `Card` follow to reach its edges - pass another value in
   * `style` (`{ "--cui-panel-padding": "1.25rem" }`).
   * @default "md"
   */
  padding?: PanelPadding;
  /** Corner radius. */
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full" | "none";
  /** Shadow size. */
  shadow?: "sm" | "md" | "lg" | "xl" | "2xl" | "none";
}

// Set by every panel - one inside another does not take its padding
const paddingClasses: Record<PanelPadding, string> = {
  none: "[--cui-panel-padding:0px]",
  sm: "[--cui-panel-padding:--spacing(4)]",
  md: "[--cui-panel-padding:--spacing(6)]",
  lg: "[--cui-panel-padding:--spacing(8)]",
  responsive:
    "[--cui-panel-padding:--spacing(4)] sm:[--cui-panel-padding:--spacing(6)]",
};

/** A padded surface card - the base of `Accordion` and page sections. */
export default function Panel({
  border = "default",
  className,
  children,
  padding = "md",
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
        `bg-surface p-(--cui-panel-padding) dark:bg-surface-dark ${getRoundedClass()} ${getShadowClass()} ${getBorderClass()}`,
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
