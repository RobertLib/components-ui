import { Check, Copy, X } from "lucide-react";
import { useEffect } from "react";
import cn from "../utils/cn";
import IconButton, { type IconButtonProps } from "./icon-button";
import Tooltip from "./tooltip";
import useClipboard from "../hooks/use-clipboard";
import { useMessages } from "../providers/ui-context";

export interface CopyButtonProps extends Omit<
  IconButtonProps,
  "children" | "loading" | "value"
> {
  /**
   * Name and tooltip before copying - the localized "Copy" by default. Say
   * what it copies where a page has several of them: "Copy IBAN".
   */
  label?: string;
  /** Called once `value` is in the clipboard. */
  onCopied?: (value: string) => void;
  /** How long the button says "Copied" (or that copying failed), in milliseconds. */
  timeout?: number;
  /** Side of the button the tooltip appears on. */
  tooltipPosition?: "top" | "bottom" | "left" | "right";
  /** The text it copies to the clipboard. */
  value: string;
}

/**
 * An icon button that copies `value` to the clipboard. Its icon turns into
 * a check mark, and its name and tooltip say "Copied" for a moment - or
 * that copying failed, which screen readers hear from a status. The click
 * does not bubble past the button: a copy button in a clickable row or card
 * does not also click that.
 */
export default function CopyButton({
  className,
  label,
  onClick,
  onCopied,
  timeout = 2000,
  tooltipPosition = "top",
  value,
  variant,
  ...props
}: CopyButtonProps) {
  const messages = useMessages();
  const { copied, copy, error, reset } = useClipboard({ timeout });

  // A failure is shown as long as a success - then the button offers
  // copying again
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(reset, timeout);
    return () => clearTimeout(timer);
  }, [error, reset, timeout]);

  const text = copied
    ? messages.copyButton.copied
    : error
      ? messages.copyButton.error
      : (label ?? messages.copyButton.copy);

  const iconClassName = "h-4 w-4";

  return (
    <>
      {/* A shorter delay than usual - after a quick click the tooltip comes
        soon enough to say "Copied" */}
      <Tooltip delay={300} position={tooltipPosition} title={text}>
        <IconButton
          {...props}
          aria-label={text}
          className={cn(
            copied && "text-success-600 dark:text-success-400",
            className,
          )}
          onClick={(event) => {
            // A click reaching the tooltip would hide it - it stays and says
            // "Copied". Nor does the click select a row the button is in.
            event.stopPropagation();
            onClick?.(event);
            if (event.defaultPrevented) return;

            void copy(value).then((success) => {
              if (success) onCopied?.(value);
            });
          }}
          variant={error ? "danger" : variant}
        >
          {copied ? (
            <Check aria-hidden="true" className={iconClassName} />
          ) : error ? (
            <X aria-hidden="true" className={iconClassName} />
          ) : (
            <Copy aria-hidden="true" className={iconClassName} />
          )}
        </IconButton>
      </Tooltip>
      {/* Screen readers do not announce the new name of the focused button -
        the outcome is told by a status, there before it has anything to
        say, so that its change is heard */}
      <span className="sr-only" role="status">
        {copied
          ? messages.copyButton.copied
          : error
            ? messages.copyButton.error
            : ""}
      </span>
    </>
  );
}
