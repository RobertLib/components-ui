import { useEffect, useId, useState } from "react";
import { AccordionGroupContext } from "./accordion-group-context";
import cn from "../utils/cn";
import logger from "../utils/logger";

interface AccordionGroupBaseProps extends Omit<
  React.ComponentProps<"div">,
  "defaultValue"
> {
  /** The `Accordion`s of the group - give each a `value`. */
  children?: React.ReactNode;
  /** Classes of the wrapper - it stacks the accordions with a gap (`gap-3`). */
  className?: string;
  /**
   * `single` only: the open section can be closed too, leaving none open.
   * Without it, one section stays open once one was opened.
   */
  collapsible?: boolean;
  /**
   * The section open at first in an uncontrolled group - `null` for none;
   * an array of the open ones with `type="multiple"`.
   */
  defaultValue?: string | string[] | null;
  /**
   * `single` - opening a section closes the open one; `multiple` - any of
   * the sections can be open.
   */
  type?: "single" | "multiple";
  /**
   * The open section of a controlled group - `null` for none; an array of
   * the open ones with `type="multiple"`. Use with `onValueChange`.
   */
  value?: string | string[] | null;
}

/** One section open at a time - one value. */
interface SingleSelectionProps {
  collapsible?: boolean;
  defaultValue?: string | null;
  /**
   * Called with the `value` of the section to open - `null` when the open
   * one closes; with `type="multiple"` the array of the sections to keep
   * open.
   */
  onValueChange?: (value: string | null) => void;
  type?: "single";
  value?: string | null;
}

/** Any of the sections open - an array of values. */
interface MultipleSelectionProps {
  collapsible?: never;
  defaultValue?: string[];
  /** Called with the `value`s of the sections to keep open. */
  onValueChange?: (value: string[]) => void;
  type: "multiple";
  value?: string[];
}

export type AccordionGroupProps = AccordionGroupBaseProps &
  (SingleSelectionProps | MultipleSelectionProps);

/** The open sections - one value, an array or none. */
const toOpenValues = (value: string | string[] | null | undefined) =>
  value === null || value === undefined
    ? []
    : Array.isArray(value)
      ? value
      : [value];

/** The toggles of the accordions of the group `groupId`, in page order. */
const getToggles = (root: HTMLElement, groupId: string) =>
  Array.from(
    root.querySelectorAll<HTMLElement>("[data-accordion-toggle]"),
  ).filter((toggle) => toggle.dataset.accordionToggle === groupId);

/** Where an arrow key, Home or End moves the focus from `index`. */
function getKeyTarget(toggles: HTMLElement[], index: number, key: string) {
  const last = toggles.length - 1;

  switch (key) {
    case "ArrowDown":
      return toggles[index === last ? 0 : index + 1];
    case "ArrowUp":
      return toggles[index === 0 ? last : index - 1];
    case "Home":
      return toggles[0];
    case "End":
      return toggles[last];
    default:
      return undefined;
  }
}

/**
 * `Accordion`s that open together: in a `single` group opening a section
 * closes the open one, in a `multiple` group any can be open. The arrow keys
 * move between the toggles of the sections, Home / End to the first / last.
 */
export default function AccordionGroup({
  children,
  className,
  collapsible = false,
  defaultValue,
  onKeyDown,
  onValueChange,
  type = "single",
  value,
  ...props
}: AccordionGroupProps) {
  const groupId = useId();
  const [internalValues, setInternalValues] = useState(() =>
    toOpenValues(defaultValue),
  );

  const isControlled = value !== undefined;
  const openValues = isControlled ? toOpenValues(value) : internalValues;

  useEffect(() => {
    if (isControlled && !onValueChange) {
      logger.warn(
        "AccordionGroup: `value` without `onValueChange` cannot be changed - use `defaultValue` for the sections open at first.",
      );
    }
  }, [isControlled, onValueChange]);

  const toggle = (itemValue: string) => {
    const isOpen = openValues.includes(itemValue);

    // The open section of a single group stays open, unless collapsible
    if (type === "single" && isOpen && !collapsible) return;

    const next =
      type === "multiple"
        ? isOpen
          ? openValues.filter((open) => open !== itemValue)
          : [...openValues, itemValue]
        : isOpen
          ? []
          : [itemValue];

    if (!isControlled) setInternalValues(next);

    if (type === "multiple") {
      (onValueChange as ((value: string[]) => void) | undefined)?.(next);
    } else {
      (onValueChange as ((value: string | null) => void) | undefined)?.(
        next[0] ?? null,
      );
    }
  };

  // The APG accordion keys - the arrows move between the section toggles
  // of this group, not of a group nested in a section
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    const toggles = getToggles(event.currentTarget, groupId);
    const index = toggles.indexOf(event.target as HTMLElement);
    if (index === -1) return;

    const target = getKeyTarget(toggles, index, event.key);
    if (!target) return;

    event.preventDefault();
    target.focus();
  };

  return (
    <AccordionGroupContext
      value={{ collapsible, groupId, openValues, toggle, type }}
    >
      <div
        {...props}
        className={cn("flex flex-col gap-3", className)}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </AccordionGroupContext>
  );
}
