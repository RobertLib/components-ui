import { ChevronDown } from "lucide-react";
import { use, useId } from "react";
import Button, { type ButtonProps } from "./button";
import ButtonGroup from "./button-group";
import { ButtonGroupContext } from "./button-group-context";
import cn from "../utils/cn";
import Dropdown from "./dropdown";
import type { DropdownEntry } from "./menu/types";
import { useMessages } from "../providers/ui-context";

export interface SplitButtonProps extends Omit<ButtonProps, "link" | "size"> {
  /** Entries of the menu - related actions, like the items of `Dropdown`. */
  items: DropdownEntry[];
  /** Size of both buttons. */
  size?: "sm" | "md" | "lg";
  /**
   * Accessible name of the button that opens the menu - the localized "More
   * options" by default.
   */
  toggleLabel?: string;
}

// The toggle holds only its chevron - narrower than a button with a label
const toggleStyles = {
  sm: "px-1!",
  md: "px-1.5!",
  lg: "px-2!",
};

/**
 * The button of the main action joined with a button that opens a menu of
 * related ones, e.g. "Save" and "Save as draft". `color`, `variant`,
 * `size`, `disabled` and `loading` apply to both; the other props -
 * `onClick`, `type="submit"`, … - go to the main button.
 */
export default function SplitButton({
  children,
  className,
  color,
  disabled = false,
  fullWidth = false,
  id,
  items,
  loading = false,
  size,
  style,
  toggleLabel,
  variant,
  ...props
}: SplitButtonProps) {
  const messages = useMessages();
  const outer = use(ButtonGroupContext);
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  // In a toolbar that sets the size of its buttons
  const groupSize = outer?.size === "icon" ? undefined : outer?.size;
  const effectiveSize = size ?? groupSize ?? "md";

  return (
    <ButtonGroup
      // Named by the main action - its menu button reads as part of it
      aria-labelledby={buttonId}
      className={cn(fullWidth && "w-full", className)}
      color={color}
      size={effectiveSize}
      style={style}
      variant={variant}
    >
      <Button
        {...props}
        className={fullWidth ? "min-w-0 flex-1" : undefined}
        disabled={disabled}
        id={buttonId}
        loading={loading}
      >
        {children}
      </Button>
      <Dropdown
        buttonTrigger
        items={items}
        trigger={
          <Button
            aria-label={toggleLabel ?? messages.splitButton.moreOptions}
            className={toggleStyles[effectiveSize]}
            // Busy as a whole - no other action while the main one runs
            disabled={disabled || loading}
          >
            <ChevronDown aria-hidden="true" size={16} />
          </Button>
        }
      />
    </ButtonGroup>
  );
}
