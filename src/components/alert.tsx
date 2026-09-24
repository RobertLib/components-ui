import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import cn from "../utils/cn";

export interface AlertProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Hides the icon on the left. */
  noIcon?: boolean;
  /** Bold heading above the message. */
  title?: React.ReactNode;
  /**
   * Color and icon of the alert - also its role: `danger` and `warning` are
   * announced at once, `success` and `info` as a status.
   */
  type?: "success" | "danger" | "warning" | "info";
}

/**
 * A highlighted message. Renders nothing without children, so it can be
 * placed unconditionally: `<Alert type="danger">{error}</Alert>`.
 *
 * `danger` and `warning` are alerts (`role="alert"`), which screen readers
 * announce also when they appear with their message. `success` and `info`
 * are a status (`role="status"`), and a status that appears already filled
 * is often not announced - tell of the outcome of an action with a toast.
 */
export default function Alert({
  className,
  children,
  noIcon = false,
  title,
  type = "info",
  ...props
}: AlertProps) {
  if (!children) return null;

  const IconComponent = (() => {
    switch (type) {
      case "success":
        return CheckCircle;
      case "danger":
        return XCircle;
      case "warning":
        return AlertTriangle;
      case "info":
      default:
        return Info;
    }
  })();

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          container:
            "from-success-50 dark:from-success-900/20 to-success-50 dark:to-success-900/20 border border-success-200 dark:border-success-800",
          icon: "text-success-600 dark:text-success-400",
          title: "text-success-900 dark:text-success-100",
          content: "text-success-700 dark:text-success-300",
        };
      case "danger":
        return {
          container:
            "from-danger-50 dark:from-danger-900/20 to-danger-50 dark:to-danger-900/20 border border-danger-200 dark:border-danger-800",
          icon: "text-danger-700 dark:text-danger-400",
          title: "text-danger-900 dark:text-danger-100",
          content: "text-danger-700 dark:text-danger-300",
        };
      case "warning":
        return {
          container:
            "from-warning-50 dark:from-warning-900/20 to-warning-50 dark:to-warning-900/20 border border-warning-200 dark:border-warning-800",
          icon: "text-warning-600 dark:text-warning-400",
          title: "text-warning-900 dark:text-warning-100",
          content: "text-warning-700 dark:text-warning-300",
        };
      case "info":
      default:
        return {
          container:
            "from-primary-50 dark:from-primary-900/20 to-primary-50 dark:to-primary-900/20 border border-primary-200 dark:border-primary-800",
          icon: "text-primary-600 dark:text-primary-400",
          title: "text-primary-900 dark:text-primary-100",
          content: "text-primary-700 dark:text-primary-300",
        };
    }
  };

  const styles = getTypeStyles();
  // An alert interrupts the screen reader, a status waits for a pause - the
  // explicit `aria-live` only repeats the role for older screen readers
  const isAlert = type === "danger" || type === "warning";
  const roleType = isAlert ? "alert" : "status";
  const liveType = isAlert ? "assertive" : "polite";

  return (
    <div
      {...props}
      aria-live={liveType}
      className={cn(
        "rounded-lg bg-linear-to-r p-4",
        styles.container,
        className,
      )}
      role={roleType}
    >
      <div className="flex items-start space-x-3">
        {!noIcon && (
          <div className="shrink-0">
            <IconComponent
              className={cn(
                "h-5 w-5",
                !!title && "relative top-0.5",
                styles.icon,
              )}
            />
          </div>
        )}
        <div>
          {title && (
            <h3 className={cn("font-medium", styles.title)}>{title}</h3>
          )}
          <div className={cn("text-sm", styles.content, !!title && "mt-1")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
