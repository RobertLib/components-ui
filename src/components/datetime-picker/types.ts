export type PickerDim = "sm" | "md" | "lg";

/**
 * The native attributes of `DateTimePicker` a custom picker puts on its
 * visible field - `form` also on the hidden input. The rest of the input
 * props are handled by the picker itself.
 */
export type PickerInputProps = Omit<
  React.ComponentProps<"input">,
  | "aria-label"
  | "className"
  | "defaultValue"
  | "disabled"
  | "id"
  | "max"
  | "min"
  | "name"
  | "onBlur"
  | "onChange"
  | "onFocus"
  | "placeholder"
  | "readOnly"
  | "ref"
  | "required"
  | "step"
  | "type"
  | "value"
>;

/** What every custom picker gets from `DateTimePicker`. */
export interface CustomPickerProps {
  /** Accessible name of the field without a `label`. */
  ariaLabel?: string;
  /**
   * Whether the field has a clear button - by default when it is not
   * `required`.
   */
  clearable?: boolean;
  /** Classes of the visible field. */
  className?: string;
  /** Help text under the field. */
  description?: React.ReactNode;
  /** Id of the help text - the field is described by it after the error. */
  descriptionId?: string;
  /** Size of the field. */
  dim: PickerDim;
  /** Neither editable nor submitted, the popup does not open. */
  disabled?: boolean;
  /** Validation message under the field. */
  error?: string;
  /** Id of the validation message - the field is described by it. */
  errorId?: string;
  /** Ref of the visible field - `DateTimePicker`'s `ref` and the form reset. */
  fieldRef?: React.Ref<HTMLInputElement>;
  /** Id of the visible field - the label points at it. */
  inputId: string;
  /** Other attributes of the visible field. */
  inputProps: PickerInputProps;
  /** Text of the label above the field. */
  label?: string;
  /** Latest selectable value, in the value format of the picker. */
  max?: string;
  /** Earliest selectable value, in the value format of the picker. */
  min?: string;
  /** Minutes offered by the time lists - a whole number from 1 to 60. */
  minuteStep: number;
  /** Name of the hidden input that submits the value. */
  name?: string;
  /** The focus left the picker - its field, clear button and popup. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** The focus entered the picker. */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Called with the new value, in the value format of the picker. */
  onValueChange: (value: string) => void;
  /** Placeholder of the empty field. */
  placeholder?: string;
  /** The value is shown and submitted, but the popup does not open. */
  readOnly?: boolean;
  /** The browser checks that the field has a value. */
  required?: boolean;
  /** The value in the format of the native input - `""` without one. */
  value: string;
}
