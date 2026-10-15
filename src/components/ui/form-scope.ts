import { createContext, use } from "react";

/**
 * Whether the fields inside are read-only - set by a `FormGrid` (and so a
 * `FormSection`) with `readOnly`, read by every field. `undefined` leaves
 * the fields to their own `readOnly`. The dialogs and popovers set it back:
 * their fields belong to another form than the section they open from.
 */
export const ReadOnlyContext = /* @__PURE__ */ createContext<
  boolean | undefined
>(undefined);

/**
 * The `readOnly` of a field: its own prop when it has one - `false` keeps a
 * field editable in a read-only section - else that of the `FormGrid` or
 * `FormSection` around it.
 */
export function useReadOnly(readOnly: boolean | undefined): boolean {
  const scoped = use(ReadOnlyContext);
  return readOnly ?? scoped ?? false;
}

/**
 * Where the labels of the fields are - above the control, or beside it at
 * the start (the left, right to left the right).
 */
export type FormLabelPosition = "start" | "top";

/** What a `FormGrid` tells the grids and items inside it. */
export interface FormLayoutContextValue {
  /** The columns of the nearest grid - for the span of its items. */
  columns: 1 | 2 | 3 | 4;
  /** The label position in effect - also one inherited. */
  labelPosition: FormLabelPosition;
}

export const FormLayoutContext =
  /* @__PURE__ */ createContext<FormLayoutContextValue | null>(null);

/**
 * The room above a label beside its field (`labelPosition="start"`), by the
 * size of the field - its text on the line of the text in the control. A
 * label is 20 px high, a field 22, 26, 34 or 46 px. Read by the stylesheet
 * only beside the field; a label without it takes that of `md`, a legend
 * none.
 */
export const startLabelOffsets = {
  xs: "[--cui-label-offset:--spacing(0.25)]",
  sm: "[--cui-label-offset:--spacing(0.75)]",
  md: "[--cui-label-offset:--spacing(1.75)]",
  lg: "[--cui-label-offset:--spacing(3.25)]",
} as const;

/**
 * The classes of the label of a field: `cui-field-label` puts it beside the
 * field (`labelPosition="start"`), with the offset of the size of the
 * field.
 */
export const fieldLabelClass = (dim: keyof typeof startLabelOffsets) =>
  `cui-field-label ${startLabelOffsets[dim]}`;
