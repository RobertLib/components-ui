import { AlertTriangle, Info, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { attachRef } from "../../hooks/use-form-control";
import useLocalStorage from "../../hooks/use-local-storage";
import cn from "../../utils/cn";
import { getNextTabbable, getPreviousTabbable } from "../../utils/tabbable";
import { getActiveElement } from "./overlay-stack";
import { useMessages, useRouterActions } from "../../providers/ui-context";

/** What a `SystemBanner` tells - its color, icon and role. */
export type SystemBannerVariant = "info" | "warning" | "danger" | "neutral";

/** The link or button of a `SystemBanner`, e.g. "Details". */
export interface SystemBannerAction {
  /** Makes it a link to this page - through the router of `UIProvider`. */
  href?: string;
  /** Text of the link or button. */
  label: string;
  /** Called when it is pressed - also before a link navigates. */
  onClick?: () => void;
}

export interface SystemBannerProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /** A link or a button after the message, e.g. "Details" of an outage. */
  action?: SystemBannerAction;
  /**
   * The message - the banner renders nothing without one, so it can be
   * placed unconditionally.
   */
  children?: React.ReactNode;
  /**
   * Shows a close button at the end. Closed, the banner renders nothing -
   * and stays closed after a reload with a `storageKey`.
   */
  dismissible?: boolean;
  /**
   * Shown before the message - the icon of the `variant` by default,
   * `false` leaves it out.
   */
  icon?: React.ReactNode;
  /** Called when the close button of a `dismissible` banner is pressed. */
  onDismiss?: () => void;
  /**
   * `localStorage` key a `dismissible` banner is remembered closed under -
   * also in the other tabs of the app. Give each message a key of its own,
   * e.g. `"outage-2026-11-01"`: a new message under a new key shows again.
   * Without it the banner shows again on the next load of the app.
   */
  storageKey?: string;
  /** Bold text before the message, e.g. "Planned outage". */
  title?: React.ReactNode;
  /**
   * Color and icon of the banner - also its role: `danger` and `warning`
   * are announced at once, `info` and `neutral` as a status.
   * @default "info"
   */
  variant?: SystemBannerVariant;
}

interface BannerStyles {
  button: string;
  container: string;
}

// Filled, the text at 4.5:1 at least - warning is yellow, with dark text
const styles: Record<SystemBannerVariant, BannerStyles> = {
  danger: {
    button: "hover:bg-white/15",
    container: "bg-danger-600 text-white dark:bg-danger-700",
  },
  info: {
    button: "hover:bg-white/15",
    container: "bg-primary-600 text-white dark:bg-primary-700",
  },
  neutral: {
    button: "hover:bg-white/15",
    container: "bg-neutral-800 text-white dark:bg-neutral-700",
  },
  warning: {
    button: "hover:bg-black/10",
    container: "bg-warning-400 text-warning-950",
  },
};

const icons = {
  danger: XCircle,
  info: Info,
  neutral: Info,
  warning: AlertTriangle,
};

// Read while there is no `storageKey` - nothing is written under it
const NO_STORAGE_KEY = "";

/** Whether a node renders anything - `false`, `null` and `""` do not. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

/**
 * Gives the focus to `target` once the banner it was in is gone - unless
 * the page has already put it elsewhere.
 */
function restoreFocus(target: HTMLElement | null) {
  const active = getActiveElement(target?.ownerDocument);
  if (
    target?.isConnected &&
    (!active || active === target.ownerDocument.body)
  ) {
    target.focus();
  }
}

/**
 * A message across the whole app - a planned outage, a test environment,
 * the user the app is used as - for the `banner` of `AppShell`, above the
 * `Navbar`. A filled strip with an icon, the message, an optional link or
 * button (`action`) and close button (`dismissible`), remembered closed
 * under a `storageKey`. Renders nothing without children. `danger` and
 * `warning` are alerts (`role="alert"`), `info` and `neutral` a status.
 * Left out when printed. `ref` and the other props go to the banner.
 */
export default function SystemBanner({
  action,
  children,
  className,
  dismissible = false,
  icon,
  onDismiss,
  ref,
  storageKey,
  title,
  variant = "info",
  ...props
}: SystemBannerProps) {
  const { Link } = useRouterActions();
  const messages = useMessages().ui;
  const bannerRef = useRef<HTMLDivElement>(null);
  // Where the focus goes once the banner closed from its button is gone
  const focusAfterDismiss = useRef<HTMLElement | null>(null);

  // Closed for this load of the app - or for good, under a `storageKey`.
  // A message under another key shows again.
  const key = storageKey ?? NO_STORAGE_KEY;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [isStoredDismissed, setStoredDismissed] = useLocalStorage(key, false);
  const isShown =
    (hasContent(children) || hasContent(title)) &&
    dismissedKey !== key &&
    !(storageKey !== undefined && isStoredDismissed === true);

  useEffect(() => {
    // Closed - it renders nothing and stays: the focus moves on as at a
    // removal
    if (!isShown) restoreFocus(focusAfterDismiss.current);
    focusAfterDismiss.current = null;
  });

  // Removed by `onDismiss` - the focus was on its close button
  useEffect(() => () => restoreFocus(focusAfterDismiss.current), []);

  if (!isShown) return null;

  const variantStyles = styles[variant] ?? styles.info;
  const IconComponent = icons[variant] ?? Info;
  // An alert interrupts the screen reader, a status waits for a pause - the
  // explicit `aria-live` only repeats the role for older screen readers
  const isAlert = variant === "danger" || variant === "warning";

  const handleDismiss = () => {
    const banner = bannerRef.current;
    if (banner?.contains(getActiveElement(banner.ownerDocument))) {
      // The next control after the banner - the one before it at the end
      // of the page
      focusAfterDismiss.current =
        getNextTabbable(banner) ?? getPreviousTabbable(banner) ?? null;
    }
    if (storageKey !== undefined) setStoredDismissed(true);
    setDismissedKey(key);
    onDismiss?.();
  };

  const controlClassName =
    "rounded-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-current";
  const actionClassName = cn(
    controlClassName,
    "cursor-pointer font-semibold whitespace-nowrap underline underline-offset-2 hover:no-underline",
  );

  return (
    <div
      {...props}
      aria-live={isAlert ? "assertive" : "polite"}
      className={cn(
        // A line in forced colors mode, which drops the fill
        "flex items-center gap-2 border-b border-transparent px-4 py-2 text-sm print:hidden forced-colors:border-[CanvasText]",
        variantStyles.container,
        className,
      )}
      data-variant={variant}
      ref={(element) => {
        bannerRef.current = element;
        const detachRef = attachRef(ref, element);
        return () => {
          bannerRef.current = null;
          detachRef();
        };
      }}
      role={isAlert ? "alert" : "status"}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <p className="flex min-w-0 items-start gap-2">
          {icon !== false && (
            <span aria-hidden="true" className="flex h-5 shrink-0 items-center">
              {icon ?? <IconComponent size={16} />}
            </span>
          )}
          <span className="min-w-0 text-start wrap-break-word">
            {hasContent(title) && (
              <strong className="font-semibold">{title} </strong>
            )}
            {children}
          </span>
        </p>
        {action &&
          (action.href !== undefined ? (
            <Link
              className={actionClassName}
              href={action.href}
              onClick={action.onClick}
            >
              {action.label}
            </Link>
          ) : (
            <button
              className={actionClassName}
              onClick={action.onClick}
              type="button"
            >
              {action.label}
            </button>
          ))}
      </div>
      {dismissible && (
        <button
          aria-label={messages.systemBanner.dismiss}
          className={cn(
            controlClassName,
            "-my-1 -me-2 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors motion-reduce:transition-none",
            variantStyles.button,
          )}
          onClick={handleDismiss}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      )}
    </div>
  );
}
