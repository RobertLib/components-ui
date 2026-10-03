import { createContext } from "react";

/** What an `AccordionGroup` tells the `Accordion`s in it. */
export interface AccordionGroupContextValue {
  /** Single groups: the open section can be closed, leaving none open. */
  collapsible: boolean;
  /** Marks the toggles of the group - its arrow keys move between them. */
  groupId: string;
  /** The `value`s of the open sections. */
  openValues: readonly string[];
  /** Opens or closes the section of `value`. */
  toggle: (value: string) => void;
  /** `single` - opening a section closes the open one. */
  type: "single" | "multiple";
}

/**
 * The group an `Accordion` is in - `null` outside of one, and in the
 * content of an accordion, so that a section nested there stays on its own.
 */
export const AccordionGroupContext =
  createContext<AccordionGroupContextValue | null>(null);
