import { Check, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import cn from "../utils/cn";
import { getNextTabbable, getTabbableElements } from "../utils/tabbable";
import { useMessages } from "../providers/ui-context";

export type ChipColor =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral";

export type ChipVariant = "default" | "outline" | "solid";

export type ChipSize = "sm" | "md" | "lg";

// The HTML `color` attribute gives way to the theme colors
export type ChipProps = Omit<React.ComponentProps<"span">, "color"> & {
  /**
   * Color scheme - one of the theme colors. A selected chip is drawn in the
   * `solid` variant of it.
   */
  color?: ChipColor;
  /** Whether an uncontrolled selectable chip starts selected. */
  defaultSelected?: boolean;
  /**
   * Dims the chip; its buttons (the toggle, the remove button) cannot be
   * used.
   */
  disabled?: boolean;
  /**
   * An icon before the text, e.g. `<Truck />` of lucide-react - sized to
   * the chip. A selected chip shows a check mark in its place.
   */
  icon?: React.ReactNode;
  /**
   * Adds a remove button (×) - named "Remove" and the text of the chip.
   * Backspace and Delete on it remove the chip too. When the chip goes away,
   * the focus moves on to the next chip (or the previous one).
   */
  onRemove?: () => void;
  /**
   * Makes the chip a toggle button (`aria-pressed`), e.g. a filter - called
   * with the new state.
   */
  onSelectedChange?: (selected: boolean) => void;
  /**
   * Accessible name of the remove button, when "Remove" and the text of the
   * chip do not fit - e.g. a chip with an avatar.
   */
  removeLabel?: string;
  /**
   * Makes the chip a toggle button (`aria-pressed`) that is selected -
   * controlled, with `onSelectedChange`. A selected chip is filled and shows
   * a check mark.
   */
  selected?: boolean;
  /** Text size and padding - `md` is the size of a text line. */
  size?: ChipSize;
  /**
   * `default` - colored text and border, `outline` - tinted background, `solid` - filled.
   * A selectable chip has it while not selected.
   */
  variant?: ChipVariant;
};

const colorVariants: Record<ChipVariant, Record<ChipColor, string>> = {
  default: {
    primary:
      "border-primary-300 bg-surface text-primary-800 dark:border-primary-700 dark:bg-surface-dark dark:text-primary-200",
    secondary:
      "border-secondary-300 bg-surface text-secondary-800 dark:border-secondary-700 dark:bg-surface-dark dark:text-secondary-200",
    success:
      "border-success-300 bg-surface text-success-800 dark:border-success-700 dark:bg-surface-dark dark:text-success-200",
    danger:
      "border-danger-300 bg-surface text-danger-800 dark:border-danger-700 dark:bg-surface-dark dark:text-danger-200",
    warning:
      "border-warning-300 bg-surface text-warning-800 dark:border-warning-700 dark:bg-surface-dark dark:text-warning-200",
    info: "border-info-300 bg-surface text-info-800 dark:border-info-700 dark:bg-surface-dark dark:text-info-200",
    neutral:
      "border-neutral-300 dark:border-neutral-700 bg-surface dark:bg-surface-dark text-neutral-800 dark:text-neutral-200",
  },
  outline: {
    primary:
      "border-primary-300 bg-primary-50 text-primary-800 dark:border-primary-700 dark:bg-primary-950 dark:text-primary-200",
    secondary:
      "border-secondary-300 bg-secondary-50 text-secondary-800 dark:border-secondary-700 dark:bg-secondary-950 dark:text-secondary-200",
    success:
      "border-success-300 bg-success-50 text-success-800 dark:border-success-700 dark:bg-success-950 dark:text-success-200",
    danger:
      "border-danger-300 bg-danger-50 text-danger-800 dark:border-danger-700 dark:bg-danger-950 dark:text-danger-200",
    warning:
      "border-warning-300 bg-warning-50 text-warning-800 dark:border-warning-700 dark:bg-warning-950 dark:text-warning-200",
    info: "border-info-300 bg-info-50 text-info-800 dark:border-info-700 dark:bg-info-950 dark:text-info-200",
    neutral:
      "border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200",
  },
  // White text stands out from the fill by at least 4.5:1 - dark text on
  // the yellow of warning
  solid: {
    primary:
      "border-primary-700 bg-primary-600 text-white dark:border-primary-500",
    secondary:
      "border-secondary-600 bg-secondary-500 text-white dark:border-secondary-500 dark:bg-secondary-600",
    success:
      "border-success-800 bg-success-700 text-white dark:border-success-600",
    danger: "border-danger-700 bg-danger-600 text-white dark:border-danger-500",
    warning:
      "border-warning-500 bg-warning-400 text-warning-950 dark:border-warning-400 dark:bg-warning-500",
    info: "border-info-800 bg-info-700 text-white dark:border-info-600",
    neutral:
      "border-neutral-600 dark:border-neutral-400 bg-neutral-500 text-white",
  },
};

const sizeClasses: Record<ChipSize, string> = {
  sm: "px-1.5 py-px text-xs",
  md: "px-2 py-0.5 text-sm",
  lg: "px-3 py-1 text-base",
};

// The remove button brings a padding of its own - less room on its side
const removableSizeClasses: Record<ChipSize, string> = {
  sm: "py-px ps-1.5 pe-0.5 text-xs",
  md: "py-0.5 ps-2 pe-1 text-sm",
  lg: "py-1 ps-3 pe-1.5 text-base",
};

const gapClasses: Record<ChipSize, string> = {
  sm: "gap-1",
  md: "gap-1",
  lg: "gap-1.5",
};

// An icon of any size given is drawn to fit the text
const iconClasses: Record<ChipSize, string> = {
  sm: "[&>svg]:size-3",
  md: "[&>svg]:size-3.5",
  lg: "[&>svg]:size-4",
};

const removeButtonClasses: Record<ChipSize, string> = {
  sm: "size-4 [&>svg]:size-3",
  md: "size-5 [&>svg]:size-3.5",
  lg: "size-6 [&>svg]:size-4",
};

// The focus ring keeps a gap to the chip, which may be filled with a color
// like its own
const toggleClasses =
  "cursor-pointer ring-offset-surface transition-[color,background-color,border-color,box-shadow] select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed motion-reduce:transition-none dark:ring-offset-surface-dark";

// Hover darkens whatever color the chip has - lightens the tint of one not
// selected in the dark, where lightening the fill would take contrast from
// the white text of a selected one
const toggleHoverClasses = {
  selected: "enabled:hover:inset-shadow-[0_0_0_999px_rgb(0_0_0/0.1)]",
  unselected:
    "enabled:hover:inset-shadow-[0_0_0_999px_rgb(0_0_0/0.05)] dark:enabled:hover:inset-shadow-[0_0_0_999px_rgb(255_255_255/0.08)]",
};

/**
 * Where the focus goes once a removable chip that has it is removed: the
 * next removable chip around it, the previous one after the last, else the
 * next control - so the filters can be cleared one after another.
 */
function focusTargetAfterRemoval(chip: HTMLElement) {
  const chips = Array.from(
    chip.parentElement?.querySelectorAll<HTMLElement>("[data-chip]") ?? [],
  ).filter((other) => other !== chip);
  const isAfter = (other: HTMLElement) =>
    !!(chip.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING);
  const nextChip =
    chips.find(isAfter) ?? chips.findLast((other) => !isAfter(other));
  const chipTarget = getTabbableElements(nextChip)[0];
  if (chipTarget) return chipTarget;

  const container = chip.parentElement;
  for (const scope of [container, container?.parentElement]) {
    const candidates = getTabbableElements(scope).filter(
      (element) => !chip.contains(element),
    );
    const next = candidates.find(isAfter);
    const target = next ?? candidates.at(-1);
    if (target) return target;
  }

  return getNextTabbable(chip) ?? null;
}

const isRemoveKey = (event: React.KeyboardEvent) =>
  (event.key === "Backspace" || event.key === "Delete") &&
  // Holding the key would go on to remove the chip that takes the focus
  !event.repeat;

/**
 * A small rounded label, e.g. a status or a tag. It is a `<span>`, so it
 * fits into text - also inside a paragraph. With `onRemove` it gets a remove
 * button; with `selected` / `onSelectedChange` it is a toggle button, e.g.
 * a filter - the props then go to the `<button>` (with `onRemove` too, to
 * the `<span>` around the toggle and the remove button).
 */
export default function Chip({
  className,
  color = "neutral",
  children,
  defaultSelected,
  disabled = false,
  icon,
  onClick,
  onKeyDown,
  onRemove,
  onSelectedChange,
  removeLabel,
  selected,
  size = "md",
  variant = "default",
  ...props
}: ChipProps) {
  const messages = useMessages();
  const contentId = useId();
  const removeButtonId = `${contentId}-remove`;

  const [selectedState, setSelectedState] = useState(defaultSelected ?? false);
  const isSelectable =
    selected !== undefined ||
    defaultSelected !== undefined ||
    onSelectedChange !== undefined;
  const isSelected = isSelectable && (selected ?? selectedState);
  const isRemovable = onRemove !== undefined;

  // Where the focus goes if the chip goes away after a removal from it
  const focusAfterRemoval = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Rendered again - the chip was not removed (yet), the focus stays
    focusAfterRemoval.current = null;
  });

  useEffect(
    () => () => {
      // Removed - the focus was on its remove button, now on the page
      const target = focusAfterRemoval.current;
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

  const remove = (chip: HTMLElement | null) => {
    if (chip?.contains(document.activeElement)) {
      focusAfterRemoval.current = focusTargetAfterRemoval(chip);
    }
    onRemove?.();
  };

  const toggle = () => {
    const next = !isSelected;
    if (selected === undefined) setSelectedState(next);
    onSelectedChange?.(next);
  };

  const iconSlot = (isSelected || icon) && (
    <span className={cn("inline-flex shrink-0", iconClasses[size])}>
      {isSelected ? <Check aria-hidden="true" /> : icon}
    </span>
  );

  const colorClasses = colorVariants[isSelected ? "solid" : variant][color];

  if (!isRemovable) {
    if (isSelectable) {
      return (
        <button
          {...(props as React.ComponentProps<"button">)}
          aria-pressed={isSelected}
          className={cn(
            "inline-flex items-center rounded-full border",
            sizeClasses[size],
            gapClasses[size],
            colorClasses,
            toggleClasses,
            toggleHoverClasses[isSelected ? "selected" : "unselected"],
            disabled && "opacity-50",
            className,
          )}
          disabled={disabled}
          onClick={(event) => {
            onClick?.(event as React.MouseEvent<HTMLSpanElement>);
            if (!event.defaultPrevented) toggle();
          }}
          onKeyDown={onKeyDown as React.KeyboardEventHandler<HTMLButtonElement>}
          type="button"
        >
          {iconSlot}
          {children}
        </button>
      );
    }

    return (
      <span
        {...props}
        className={cn(
          "inline-flex items-center rounded-full border",
          sizeClasses[size],
          !!icon && gapClasses[size],
          colorVariants[variant][color],
          disabled && "opacity-50",
          className,
        )}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {iconSlot}
        {children}
      </span>
    );
  }

  const content = (
    <>
      {iconSlot}
      <span id={contentId}>{children}</span>
    </>
  );

  return (
    <span
      {...props}
      // Found by the chip next to it when it is removed
      data-chip=""
      className={cn(
        "inline-flex items-center rounded-full border",
        removableSizeClasses[size],
        gapClasses[size],
        colorClasses,
        disabled && "opacity-50",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        // A click on the toggle - `onClick` runs first, as on a toggle chip
        // without the remove button
        const toggleButton =
          event.target instanceof Element &&
          event.target.closest("[aria-pressed]");
        if (
          !event.defaultPrevented &&
          toggleButton &&
          event.currentTarget.contains(toggleButton)
        ) {
          toggle();
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        // On the remove button, or on the toggle of a selectable chip
        if (!event.defaultPrevented && !disabled && isRemoveKey(event)) {
          event.preventDefault();
          event.stopPropagation();
          remove(event.currentTarget);
        }
      }}
    >
      {isSelectable ? (
        <button
          aria-pressed={isSelected}
          className={cn(
            // Inside the chip - a ring in the color of its text stands
            // out from its fill
            "inline-flex cursor-pointer items-center rounded-full select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-current disabled:cursor-not-allowed",
            gapClasses[size],
          )}
          disabled={disabled}
          type="button"
        >
          {content}
        </button>
      ) : (
        content
      )}
      <button
        aria-label={removeLabel ?? messages.chip.remove}
        // "Remove" and the text of the chip, whatever its content is
        aria-labelledby={
          removeLabel ? undefined : `${removeButtonId} ${contentId}`
        }
        className={cn(
          "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full opacity-70 transition-[opacity,background-color] hover:bg-current/15 hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-current disabled:cursor-not-allowed disabled:hover:bg-transparent motion-reduce:transition-none",
          removeButtonClasses[size],
        )}
        disabled={disabled}
        id={removeButtonId}
        onClick={(event) => {
          // Not a click on the chip, or on a row or card around it
          event.stopPropagation();
          remove(event.currentTarget.parentElement);
        }}
        type="button"
      >
        <X aria-hidden="true" />
      </button>
    </span>
  );
}
