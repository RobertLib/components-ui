export type PickerDim = "sm" | "md" | "lg";

/** What every custom picker gets from `DateTimePicker`. */
export interface CustomPickerProps {
  ariaLabel?: string;
  className?: string;
  dim: PickerDim;
  disabled?: boolean;
  error?: string;
  errorId?: string;
  /** Ref of the visible field - `DateTimePicker`'s `ref` and the form reset. */
  fieldRef?: React.Ref<HTMLInputElement>;
  inputId: string;
  label?: string;
  /** Latest selectable value, in the value format of the picker. */
  max?: string;
  /** Earliest selectable value, in the value format of the picker. */
  min?: string;
  minuteStep: number;
  name?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** The value is shown and submitted, but the popup does not open. */
  readOnly?: boolean;
  required?: boolean;
  value: string;
}
