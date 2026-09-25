import { ExternalLink } from "lucide-react";
import cn, { joinTokens } from "../utils/cn";
import { useMessages, useRouter } from "../providers/ui-context";

type LinkColor =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "neutral"
  | "inherit";

// The HTML `color` attribute gives way to the theme colors
export interface LinkProps extends Omit<React.ComponentProps<"a">, "color"> {
  /**
   * Text color - one of the theme colors, or `inherit` for the color of the
   * text around (keep the underline then, it tells the link apart).
   */
  color?: LinkColor;
  /**
   * Opens the page in a new tab (`target="_blank"`, `rel="noopener
   * noreferrer"`), with an icon after the text and "(opens in a new tab)"
   * for screen readers.
   */
  external?: boolean;
  /**
   * Target URL. A path goes through the router's `Link` of `UIProvider`; an
   * address with a scheme (`https:`, `mailto:`, `tel:`), an anchor on the
   * page (`#details`) and a download are plain links.
   */
  href: string;
  /**
   * `always` - underlined, as a link in running text should be; `hover` -
   * underlined under the pointer, e.g. in a table or a list where it is
   * clear what is a link; `none` - never.
   */
  underline?: "always" | "hover" | "none";
}

// At least 4.5:1 on the surface and on the page background, light or dark
const colorClasses: Record<LinkColor, string> = {
  primary:
    "text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300",
  secondary:
    "text-secondary-600 hover:text-secondary-800 dark:text-secondary-300 dark:hover:text-secondary-100",
  success:
    "text-success-700 hover:text-success-800 dark:text-success-400 dark:hover:text-success-300",
  danger:
    "text-danger-700 hover:text-danger-800 dark:text-danger-400 dark:hover:text-danger-300",
  warning:
    "text-warning-700 hover:text-warning-800 dark:text-warning-400 dark:hover:text-warning-300",
  neutral:
    "text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white",
  inherit: "text-inherit",
};

const underlineClasses = {
  always: "underline underline-offset-2",
  hover: "no-underline underline-offset-2 hover:underline",
  none: "no-underline",
};

// A scheme (`https:`, `mailto:`) or a protocol-relative `//host`
const SCHEME = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/** Whether a link is left to the browser rather than the router. */
const isPlainLink = (href: string, download: unknown) =>
  SCHEME.test(href) || href.startsWith("#") || download !== undefined;

/**
 * A text link - inline in running text, in a table cell, a list. Paths are
 * rendered by the router's `Link` (see Routing), `external` links open in a
 * new tab.
 */
export default function Link({
  children,
  className,
  color = "primary",
  download,
  external = false,
  href,
  rel,
  target,
  underline = "always",
  ...props
}: LinkProps) {
  const { Link: RouterLink } = useRouter();
  const messages = useMessages();

  const classes = cn(
    "cui-link transition-colors motion-reduce:transition-none",
    colorClasses[color],
    underlineClasses[underline],
    className,
  );

  if (external) {
    return (
      <a
        {...props}
        className={classes}
        download={download}
        href={href}
        // The opened page gets no hold of this one, nor where it came from
        rel={joinTokens(rel, "noopener noreferrer")}
        target={target ?? "_blank"}
      >
        {children}
        {/* Glued to the last word: no line break before the word joiner,
            and none between it and the icon inside nowrap */}
        <span aria-hidden="true" className="whitespace-nowrap">
          {"\u2060"}
          <ExternalLink className="ms-[0.25em] inline-block size-[0.85em] align-[-0.1em]" />
        </span>
        <span
          className="sr-only"
          // A block, as `sr-only` makes it anyway - so the accessible name
          // gets a space before it also where no CSS applies (tests in jsdom)
          style={{ display: "block" }}
        >
          {messages.link.opensInNewTab}
        </span>
      </a>
    );
  }

  if (isPlainLink(href, download)) {
    return (
      <a
        {...props}
        className={classes}
        download={download}
        href={href}
        rel={rel}
        target={target}
      >
        {children}
      </a>
    );
  }

  return (
    <RouterLink
      {...props}
      className={classes}
      href={href}
      rel={rel}
      target={target}
    >
      {children}
    </RouterLink>
  );
}
