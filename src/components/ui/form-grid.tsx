import { use } from "react";
import cn from "../../utils/cn";
import {
  FormLayoutContext,
  ReadOnlyContext,
  type FormLabelPosition,
} from "./form-scope";

export type { FormLabelPosition } from "./form-scope";

/** The columns of a `FormGrid`. */
export type FormGridColumns = 1 | 2 | 3 | 4;

export interface FormGridProps extends React.ComponentProps<"div"> {
  /** The fields - a cell each; `FormGridItem` spans more columns. */
  children?: React.ReactNode;
  /**
   * Classes of the element around the grid - it gets `ref` and the other
   * attributes too. The element measures its width (a CSS container named
   * `cui-form`), and so takes none from its content: in a flex row give it
   * one, e.g. `flex-1`.
   */
  className?: string;
  /**
   * Columns of fields, 1 to 4 - where the grid is wide enough: `2` from
   * 36rem of its width, `3` from 48rem, `4` two from 36rem and four from
   * 56rem; one column below. With the labels beside the fields from 48rem,
   * 64rem, and 48rem and 72rem. The width of the grid counts, not that of
   * the screen - the fields of a narrow dialog stack too.
   * @default 1
   */
  columns?: FormGridColumns;
  /**
   * Where the labels of the fields inside are: `"top"` above the control,
   * `"start"` beside it, in a column `labelWidth` wide - the control, its
   * description and error message next to it, a checkbox or a switch lined
   * up with the controls. Below 30rem of the width of the grid the labels
   * go above. A field with a floating label, or none, stays as it is.
   * Defaults to that of a `FormGrid` or `FormSection` around, else `"top"`.
   */
  labelPosition?: FormLabelPosition;
  /**
   * Width of the column of the labels beside the fields (any CSS length,
   * `"12rem"`). Defaults to that of a grid around, else 10rem.
   */
  labelWidth?: string;
  /**
   * Makes every field inside read-only, as its own `readOnly` would: the
   * value shows, can be selected and copied, and is submitted, but not
   * changed - one form for both the detail and the edit of a record. A
   * field with `readOnly={false}` stays editable; the fields of a dialog
   * or a popover opened from inside are not affected. Defaults to that of
   * a grid around.
   */
  readOnly?: boolean;
}

export interface FormGridItemProps extends React.ComponentProps<"div"> {
  /** The field or fields of the cell. */
  children?: React.ReactNode;
  /**
   * Columns of its `FormGrid` the item spans - `"full"` the whole row. It
   * spans fewer while the grid has fewer, and one on a phone.
   * @default 1
   */
  span?: FormGridColumns | "full";
}

// Literal classes - Tailwind finds them in the source. The grid is a
// container (`cui-form`), so the columns follow its width.
const columnClasses: Record<
  FormLabelPosition,
  Record<FormGridColumns, string | undefined>
> = {
  top: {
    1: undefined,
    2: "@xl/cui-form:grid-cols-2",
    3: "@3xl/cui-form:grid-cols-3",
    4: "@xl/cui-form:grid-cols-2 @4xl/cui-form:grid-cols-4",
  },
  // A column of a field beside its label needs more room
  start: {
    1: undefined,
    2: "@3xl/cui-form:grid-cols-2",
    3: "@5xl/cui-form:grid-cols-3",
    4: "@3xl/cui-form:grid-cols-2 @6xl/cui-form:grid-cols-4",
  },
};

// By the label position, the columns of the grid and the span - at most
// the columns the grid has at each width
const spanClasses: Record<string, string> = {
  "top-2-2": "@xl/cui-form:col-span-2",
  "top-3-2": "@3xl/cui-form:col-span-2",
  "top-3-3": "@3xl/cui-form:col-span-3",
  "top-4-2": "@xl/cui-form:col-span-2",
  "top-4-3": "@xl/cui-form:col-span-2 @4xl/cui-form:col-span-3",
  "top-4-4": "@xl/cui-form:col-span-2 @4xl/cui-form:col-span-4",
  "start-2-2": "@3xl/cui-form:col-span-2",
  "start-3-2": "@5xl/cui-form:col-span-2",
  "start-3-3": "@5xl/cui-form:col-span-3",
  "start-4-2": "@3xl/cui-form:col-span-2",
  "start-4-3": "@3xl/cui-form:col-span-2 @6xl/cui-form:col-span-3",
  "start-4-4": "@3xl/cui-form:col-span-2 @6xl/cui-form:col-span-4",
};

/**
 * Lays out the fields of a form in 1 to 4 columns, one on a phone, with the
 * labels above the fields or beside them (`labelPosition`) - and with
 * `readOnly` makes every field inside read-only. `FormGridItem` spans a
 * field over more columns.
 */
export default function FormGrid({
  children,
  className,
  columns = 1,
  labelPosition,
  labelWidth,
  readOnly,
  style,
  ...props
}: FormGridProps) {
  const parent = use(FormLayoutContext);
  const parentReadOnly = use(ReadOnlyContext);
  const position = labelPosition ?? parent?.labelPosition ?? "top";

  return (
    <div
      {...props}
      className={cn("@container/cui-form", className)}
      // Only a position of its own - the fields inside follow the nearest
      data-label-position={labelPosition}
      data-readonly={readOnly ? "" : undefined}
      style={
        labelWidth === undefined
          ? style
          : ({
              ...style,
              "--cui-label-width": labelWidth,
            } as React.CSSProperties)
      }
    >
      <div
        className={cn(
          "grid grid-cols-1 gap-x-6 gap-y-4",
          columnClasses[position][columns],
        )}
      >
        <FormLayoutContext value={{ columns, labelPosition: position }}>
          <ReadOnlyContext value={readOnly ?? parentReadOnly}>
            {children}
          </ReadOnlyContext>
        </FormLayoutContext>
      </div>
    </div>
  );
}

/**
 * A cell of a `FormGrid` over more columns than one - a long text field, an
 * address line: `<FormGridItem span={2}>…</FormGridItem>`.
 */
export function FormGridItem({
  className,
  span = 1,
  ...props
}: FormGridItemProps) {
  const layout = use(FormLayoutContext);
  const columns = layout?.columns ?? 1;
  const spanClass =
    span === "full"
      ? "col-span-full"
      : spanClasses[
          `${layout?.labelPosition ?? "top"}-${columns}-${Math.min(span, columns)}`
        ];

  return <div {...props} className={cn("min-w-0", spanClass, className)} />;
}
