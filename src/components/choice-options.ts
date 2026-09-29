import cn from "../utils/cn";

// The look of the options RadioGroup and CheckboxGroup share - both plain
// rows and the cards of `variant="card"`.

export type ChoiceDim = "xs" | "sm" | "md" | "lg";

/** The text of the options - as big as the text of an Input of the `dim`. */
export const optionTextSizes: Record<ChoiceDim, string> = {
  xs: "text-sm",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

/** The box of a radio or a checkbox - as big as that of a Checkbox. */
export const optionBoxSizes: Record<ChoiceDim, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
};

// Centers the box on the first line of the label of a card
const cardBoxOffsets: Record<ChoiceDim, string> = {
  xs: "mt-1",
  sm: "mt-0.75",
  md: "mt-1",
  lg: "mt-1",
};

const cardPaddings: Record<ChoiceDim, string> = {
  xs: "gap-2 p-2",
  sm: "gap-2 p-2.5",
  md: "gap-3 p-3",
  lg: "gap-3 p-4",
};

const cardDescriptionSizes: Record<ChoiceDim, string> = {
  xs: "text-xs",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
};

/**
 * The element around the options: a column, a wrapping row - or a grid of
 * `columns` from the `sm` breakpoint on (a column on phones), whose number
 * comes in the `--cui-columns` property (`optionListStyle`). Cards in a row
 * share it in columns at least 12rem wide.
 */
export function optionListClassName(
  variant: "default" | "card",
  orientation: "horizontal" | "vertical",
  columns: number | undefined,
) {
  const card = variant === "card";

  if (columns !== undefined) {
    return cn(
      "grid sm:grid-cols-[repeat(var(--cui-columns),minmax(0,1fr))]",
      card ? "gap-3" : "gap-x-4 gap-y-1",
    );
  }
  if (card) {
    return orientation === "horizontal"
      ? "grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3"
      : "grid gap-2";
  }
  return orientation === "horizontal"
    ? "flex flex-row flex-wrap gap-x-4 gap-y-1"
    : "flex flex-col gap-1";
}

/** The style that gives the grid of `columns` its number. */
export const optionListStyle = (columns: number | undefined) =>
  columns === undefined
    ? undefined
    : ({
        "--cui-columns": Math.max(1, Math.round(columns)),
      } as React.CSSProperties);

interface CardState {
  dim: ChoiceDim;
  disabled: boolean;
  invalid: boolean;
  readOnly: boolean;
}

/**
 * The `<label>` of a card - the whole card picks the option. A picked card
 * has the primary border and tint - in forced colors (Windows High
 * Contrast), which draw every border in one color and no tint, the border of
 * the system's highlight color - and the keyboard focus of its input an
 * outline around the card (the input's own is hidden).
 */
export const cardClassName = ({
  dim,
  disabled,
  invalid,
  readOnly,
}: CardState) =>
  cn(
    "flex items-start rounded-lg border bg-surface transition-colors motion-reduce:transition-none dark:bg-surface-dark",
    cardPaddings[dim],
    invalid
      ? "border-danger-500"
      : "border-neutral-300 dark:border-neutral-700",
    "has-checked:border-primary-500 has-checked:bg-primary-50 dark:has-checked:border-primary-400 dark:has-checked:bg-primary-950/40",
    invalid &&
      "has-checked:border-danger-500 dark:has-checked:border-danger-500",
    "forced-colors:has-checked:border-[Highlight]",
    "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-500",
    disabled
      ? "cursor-not-allowed opacity-60"
      : readOnly
        ? "cursor-default"
        : "cursor-pointer hover:border-neutral-400 dark:hover:border-neutral-500",
    // Disabled by a disabled fieldset around, which no prop tells
    "has-disabled:cursor-not-allowed has-disabled:opacity-60 has-disabled:hover:border-neutral-300 dark:has-disabled:hover:border-neutral-700",
  );

/** The input of a card - at its end, on the first line of the label. */
export const cardInputClassName = (dim: ChoiceDim) =>
  cn(
    "order-last shrink-0 accent-primary-500 focus-visible:outline-hidden",
    optionBoxSizes[dim],
    cardBoxOffsets[dim],
  );

/** The icon of a card, or of an option before its label. */
export const optionIconClassName =
  "flex shrink-0 text-neutral-500 dark:text-neutral-400";

/** The description in a card. */
export const cardDescriptionClassName = (dim: ChoiceDim) =>
  cn("text-neutral-600 dark:text-neutral-400", cardDescriptionSizes[dim]);
