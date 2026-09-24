import { Fragment } from "react";
import cn from "../utils/cn";
import { getShortcutKeys } from "../utils/shortcut";
import useIsApplePlatform from "../hooks/use-is-apple-platform";

export interface KbdProps extends React.ComponentProps<"kbd"> {
  /**
   * A shortcut like `"mod+k"` shown instead of `children` - one key cap per
   * key, in the notation of the platform: ⌘ K on a Mac, Ctrl + K elsewhere
   * (see the shortcut syntax on the Kbd page).
   */
  shortcut?: string;
  /** Size of the key caps. */
  size?: "sm" | "md";
}

const keyStyles =
  "inline-flex items-center justify-center rounded border border-b-2 border-neutral-300 bg-neutral-50 font-sans font-medium text-neutral-700 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200";

const sizeStyles = {
  sm: "h-5 min-w-5 px-1 text-[0.6875rem]",
  md: "h-6 min-w-6 px-1.5 text-xs",
};

/**
 * A key or a keyboard shortcut, e.g. in a menu, a tooltip or help text. With
 * `shortcut`, each key is a nested `<kbd>` - the HTML markup of a key
 * combination.
 */
export default function Kbd({
  children,
  className,
  shortcut,
  size = "md",
  ...props
}: KbdProps) {
  // The server writes shortcuts the Windows way, the browser then corrects them
  const isApple = useIsApplePlatform();

  if (shortcut === undefined) {
    return (
      <kbd {...props} className={cn(keyStyles, sizeStyles[size], className)}>
        {children}
      </kbd>
    );
  }

  const keys = getShortcutKeys(shortcut, isApple);

  return (
    <kbd
      {...props}
      className={cn(
        "inline-flex items-center gap-0.5 font-sans text-xs text-neutral-500 dark:text-neutral-400",
        className,
      )}
    >
      {keys.map((key, index) => (
        <Fragment key={index}>
          {/* macOS writes ⌘K, Windows Ctrl+K */}
          {index > 0 && !isApple && "+"}
          <kbd className={cn(keyStyles, sizeStyles[size])}>{key}</kbd>
        </Fragment>
      ))}
    </kbd>
  );
}
