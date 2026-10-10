import { createContext } from "react";
import type { ButtonProps } from "./button";

/**
 * A variant of the buttons of a group - not `link`, which has no border to
 * join the buttons by.
 */
export type ButtonGroupVariant = Exclude<ButtonProps["variant"], "link">;

/** What a `ButtonGroup` tells each button in it. */
export interface ButtonGroupContextValue {
  /** Color of the buttons without one of their own. */
  color?: ButtonProps["color"];
  /** The button is the first of the group - its outer corners are round. */
  first: boolean;
  /** The button is the last of the group - its outer corners are round. */
  last: boolean;
  orientation: "horizontal" | "vertical";
  /** Size of the buttons without one of their own. */
  size?: ButtonProps["size"];
  /** Variant of the buttons without one of their own. */
  variant?: ButtonGroupVariant;
}

/** Set by `ButtonGroup` around each of its children - read by `Button`. */
export const ButtonGroupContext =
  /* @__PURE__ */ createContext<ButtonGroupContextValue | null>(null);
