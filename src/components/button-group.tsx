import { Children, isValidElement, use } from "react";
import cn from "../utils/cn";
import type { ButtonProps } from "./button";
import { ButtonGroupContext } from "./button-group-context";

export interface ButtonGroupProps extends React.ComponentProps<"div"> {
  /** Color of the buttons that do not set their own. */
  color?: ButtonProps["color"];
  /** Joins the buttons in a row or in a column. */
  orientation?: "horizontal" | "vertical";
  /** Size of the buttons that do not set their own. */
  size?: ButtonProps["size"];
  /** Variant of the buttons that do not set their own. */
  variant?: ButtonProps["variant"];
}

/**
 * Buttons joined into one piece, e.g. the actions of a record - a `group`
 * for assistive technology, named with `aria-label`. Each child is one
 * `Button`, or a `Dropdown` or `Tooltip` around one; `color`, `size` and
 * `variant` go to the buttons that do not set their own.
 */
export default function ButtonGroup({
  children,
  className,
  color,
  orientation = "horizontal",
  size,
  variant,
  ...props
}: ButtonGroupProps) {
  // A group in a group - a SplitButton in a toolbar - takes over what it
  // does not set itself
  const outer = use(ButtonGroupContext);
  const buttons = Children.toArray(children);

  return (
    <div
      role="group"
      {...props}
      className={cn(
        // The wrapper of a Dropdown lets its button stretch like the others
        "inline-flex [&>.popover]:flex",
        orientation === "vertical" && "flex-col [&>.popover]:flex-col",
        className,
      )}
    >
      {buttons.map((button, index) => (
        <ButtonGroupContext
          key={isValidElement(button) ? button.key : index}
          value={{
            color: color ?? outer?.color,
            first: index === 0,
            last: index === buttons.length - 1,
            orientation,
            size: size ?? outer?.size,
            variant: variant ?? outer?.variant,
          }}
        >
          {button}
        </ButtonGroupContext>
      ))}
    </div>
  );
}
