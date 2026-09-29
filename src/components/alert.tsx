import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { attachRef } from "../hooks/use-form-control";
import cn from "../utils/cn";
import { getNextTabbable, getPreviousTabbable } from "../utils/tabbable";
import { useMessages } from "../providers/ui-context";

type AlertType = "success" | "danger" | "warning" | "info";
type AlertVariant = "subtle" | "solid" | "outline";

export interface AlertProps extends Omit<React.ComponentProps<"div">, "title"> {
  /**
   * Buttons under the message, e.g. "Retry" or "View details" - small ones
   * fit best (`size="sm"`).
   */
  actions?: React.ReactNode;
  /**
   * Level of the heading of `title` - the level below the headings around.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Hides the icon on the left. */
  noIcon?: boolean;
  /**
   * Shows a close button at the end, which calls this - remove the alert
   * then. The focus moves on to the next control of the page once the
   * alert is gone.
   */
  onClose?: () => void;
  /** Bold heading above the message. */
  title?: React.ReactNode;
  /**
   * Color and icon of the alert - also its role: `danger` and `warning` are
   * announced at once, `success` and `info` as a status.
   */
  type?: AlertType;
  /**
   * `subtle` - a tinted background with a border, `solid` - filled with the
   * color, `outline` - a colored border on the surface.
   * @default "subtle"
   */
  variant?: AlertVariant;
}

interface AlertStyles {
  close: string;
  container: string;
  content: string;
  icon: string;
  title: string;
}

// Every text stands out from its background by at least 4.5:1, the icon by
// 3:1 - warning is yellow, with dark text when filled
const styles: Record<AlertVariant, Record<AlertType, AlertStyles>> = {
  subtle: {
    success: {
      close:
        "text-success-700 hover:bg-success-100 dark:text-success-300 dark:hover:bg-success-900/40",
      container:
        "bg-linear-to-r from-success-50 dark:from-success-900/20 to-success-50 dark:to-success-900/20 border border-success-200 dark:border-success-800",
      content: "text-success-700 dark:text-success-300",
      icon: "text-success-600 dark:text-success-400",
      title: "text-success-900 dark:text-success-100",
    },
    danger: {
      close:
        "text-danger-700 hover:bg-danger-100 dark:text-danger-300 dark:hover:bg-danger-900/40",
      container:
        "bg-linear-to-r from-danger-50 dark:from-danger-900/20 to-danger-50 dark:to-danger-900/20 border border-danger-200 dark:border-danger-800",
      content: "text-danger-700 dark:text-danger-300",
      icon: "text-danger-700 dark:text-danger-400",
      title: "text-danger-900 dark:text-danger-100",
    },
    warning: {
      close:
        "text-warning-700 hover:bg-warning-100 dark:text-warning-300 dark:hover:bg-warning-900/40",
      container:
        "bg-linear-to-r from-warning-50 dark:from-warning-900/20 to-warning-50 dark:to-warning-900/20 border border-warning-200 dark:border-warning-800",
      content: "text-warning-700 dark:text-warning-300",
      icon: "text-warning-600 dark:text-warning-400",
      title: "text-warning-900 dark:text-warning-100",
    },
    info: {
      close:
        "text-primary-700 hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-900/40",
      container:
        "bg-linear-to-r from-primary-50 dark:from-primary-900/20 to-primary-50 dark:to-primary-900/20 border border-primary-200 dark:border-primary-800",
      content: "text-primary-700 dark:text-primary-300",
      icon: "text-primary-600 dark:text-primary-400",
      title: "text-primary-900 dark:text-primary-100",
    },
  },
  solid: {
    success: {
      close: "text-white hover:bg-white/15",
      container: "border border-success-800 bg-success-700 dark:bg-success-800",
      content: "text-white",
      icon: "text-white",
      title: "text-white",
    },
    danger: {
      close: "text-white hover:bg-white/15",
      container: "border border-danger-700 bg-danger-600 dark:bg-danger-700",
      content: "text-white",
      icon: "text-white",
      title: "text-white",
    },
    warning: {
      close: "text-warning-950 hover:bg-black/10",
      container: "border border-warning-500 bg-warning-400",
      content: "text-warning-950",
      icon: "text-warning-950",
      title: "text-warning-950",
    },
    info: {
      close: "text-white hover:bg-white/15",
      container: "border border-primary-700 bg-primary-600 dark:bg-primary-700",
      content: "text-white",
      icon: "text-white",
      title: "text-white",
    },
  },
  outline: {
    success: {
      close:
        "text-success-700 hover:bg-success-50 dark:text-success-400 dark:hover:bg-success-950",
      container:
        "border border-success-600 bg-surface dark:border-success-500 dark:bg-surface-dark",
      content: "text-neutral-700 dark:text-neutral-300",
      icon: "text-success-700 dark:text-success-400",
      title: "text-success-800 dark:text-success-300",
    },
    danger: {
      close:
        "text-danger-700 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-950",
      container:
        "border border-danger-600 bg-surface dark:border-danger-500 dark:bg-surface-dark",
      content: "text-neutral-700 dark:text-neutral-300",
      icon: "text-danger-700 dark:text-danger-400",
      title: "text-danger-800 dark:text-danger-300",
    },
    warning: {
      close:
        "text-warning-700 hover:bg-warning-50 dark:text-warning-400 dark:hover:bg-warning-950",
      container:
        "border border-warning-600 bg-surface dark:border-warning-500 dark:bg-surface-dark",
      content: "text-neutral-700 dark:text-neutral-300",
      icon: "text-warning-700 dark:text-warning-400",
      title: "text-warning-800 dark:text-warning-300",
    },
    info: {
      close:
        "text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950",
      container:
        "border border-primary-600 bg-surface dark:border-primary-500 dark:bg-surface-dark",
      content: "text-neutral-700 dark:text-neutral-300",
      icon: "text-primary-700 dark:text-primary-400",
      title: "text-primary-800 dark:text-primary-300",
    },
  },
};

const icons = {
  danger: XCircle,
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
};

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
  actions,
  className,
  children,
  headingLevel = 3,
  noIcon = false,
  onClose,
  ref,
  title,
  type = "info",
  variant = "subtle",
  ...props
}: AlertProps) {
  const messages = useMessages();
  const alertRef = useRef<HTMLDivElement>(null);
  // Where the focus goes once the alert closed from its button is gone
  const focusAfterClose = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Rendered again - the alert was not removed (yet), the focus stays
    focusAfterClose.current = null;
  });

  useEffect(
    () => () => {
      // Removed - the focus was on its close button, now on the page
      const target = focusAfterClose.current;
      const { activeElement } = document;
      if (
        target?.isConnected &&
        (!activeElement || activeElement === document.body)
      ) {
        target.focus();
      }
    },
    [],
  );

  if (!children) return null;

  const IconComponent = icons[type] ?? Info;
  const typeStyles =
    (styles[variant] ?? styles.subtle)[type] ?? styles.subtle.info;
  const Heading = `h${headingLevel}` as const;
  // An alert interrupts the screen reader, a status waits for a pause - the
  // explicit `aria-live` only repeats the role for older screen readers
  const isAlert = type === "danger" || type === "warning";
  const roleType = isAlert ? "alert" : "status";
  const liveType = isAlert ? "assertive" : "polite";

  const handleClose = () => {
    const alert = alertRef.current;
    if (alert?.contains(document.activeElement)) {
      // The next control after the alert - or the one before it at the end
      // of the page
      focusAfterClose.current =
        getNextTabbable(alert) ?? getPreviousTabbable(alert) ?? null;
    }
    onClose?.();
  };

  return (
    <div
      {...props}
      aria-live={liveType}
      className={cn("rounded-lg p-4", typeStyles.container, className)}
      ref={(element) => {
        alertRef.current = element;
        const detachRef = attachRef(ref, element);
        return () => {
          alertRef.current = null;
          detachRef();
        };
      }}
      role={roleType}
    >
      <div className="flex items-start gap-3">
        {!noIcon && (
          <div className="shrink-0">
            <IconComponent
              aria-hidden="true"
              className={cn(
                "h-5 w-5",
                !!title && "relative top-0.5",
                typeStyles.icon,
              )}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {title && (
            <Heading className={cn("font-medium", typeStyles.title)}>
              {title}
            </Heading>
          )}
          <div className={cn("text-sm", typeStyles.content, !!title && "mt-1")}>
            {children}
          </div>
          {actions && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
        {onClose && (
          <button
            aria-label={messages.alert.close}
            className={cn(
              "-m-1 shrink-0 cursor-pointer rounded-md p-1 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-current motion-reduce:transition-none",
              typeStyles.close,
            )}
            onClick={handleClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
