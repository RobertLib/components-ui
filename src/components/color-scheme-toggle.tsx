import { Monitor, Moon, Sun } from "lucide-react";
import { useRef } from "react";
import cn from "../utils/cn";
import Tooltip from "./tooltip";
import useColorScheme, {
  type ColorScheme,
  type UseColorSchemeOptions,
} from "../hooks/use-color-scheme";
import { useMessages } from "../providers/ui-context";

export interface ColorSchemeToggleProps
  extends
    Omit<React.ComponentProps<"div">, "defaultValue" | "onChange">,
    UseColorSchemeOptions {
  /** Called with the scheme the user chose. */
  onChange?: (colorScheme: ColorScheme) => void;
  /** Size of the buttons. */
  size?: "sm" | "md";
  /** Side of the buttons their tooltips appear on. */
  tooltipPosition?: "top" | "bottom" | "left" | "right";
}

const schemes = [
  { icon: Sun, value: "light" },
  { icon: Moon, value: "dark" },
  { icon: Monitor, value: "system" },
] as const;

const sizeClasses = {
  sm: { button: "p-1", icon: "h-3.5 w-3.5" },
  md: { button: "p-1.5", icon: "h-4 w-4" },
};

/**
 * Three buttons for the color scheme of the page - light, dark and that of
 * the system - built on `useColorScheme` (pass its options). A radio group
 * for assistive technology: one tab stop, the arrow keys choose.
 */
export default function ColorSchemeToggle({
  "aria-label": ariaLabel,
  className,
  defaultColorScheme,
  onChange,
  onKeyDown,
  size = "md",
  storageKey,
  tooltipPosition = "bottom",
  ...props
}: ColorSchemeToggleProps) {
  const messages = useMessages();
  const { colorScheme, setColorScheme } = useColorScheme({
    defaultColorScheme,
    storageKey,
  });
  const groupRef = useRef<HTMLDivElement>(null);

  const choose = (value: ColorScheme) => {
    setColorScheme(value);
    onChange?.(value);
  };

  // The arrow keys move to the next choice and choose it, around the ends -
  // like native radio buttons
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;

    event.preventDefault();
    const current = schemes.findIndex(({ value }) => value === colorScheme);
    const next = (current + step + schemes.length) % schemes.length;
    choose(schemes[next].value);
    groupRef.current
      ?.querySelectorAll<HTMLElement>("[role='radio']")
      [next]?.focus();
  };

  return (
    <div
      {...props}
      aria-label={ariaLabel ?? messages.colorScheme.label}
      className={cn(
        "inline-flex gap-0.5 rounded-md bg-background p-0.5 dark:bg-background-dark",
        className,
      )}
      onKeyDown={handleKeyDown}
      ref={groupRef}
      role="radiogroup"
    >
      {schemes.map(({ icon: Icon, value }) => {
        const checked = value === colorScheme;
        const name = messages.colorScheme[value];

        return (
          <Tooltip key={value} position={tooltipPosition} title={name}>
            <button
              aria-checked={checked}
              aria-label={name}
              className={cn(
                "cursor-pointer rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transition-none",
                sizeClasses[size].button,
                checked
                  ? "bg-surface text-neutral-900 shadow dark:bg-surface-dark dark:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200",
              )}
              onClick={() => choose(value)}
              role="radio"
              // The chosen one is the tab stop of the group
              tabIndex={checked ? 0 : -1}
              type="button"
            >
              <Icon aria-hidden="true" className={sizeClasses[size].icon} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
