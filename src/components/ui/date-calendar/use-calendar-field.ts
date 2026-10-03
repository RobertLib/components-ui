import { useCallback } from "react";
import {
  useFieldsetDisabled,
  useFormReset,
} from "../../../hooks/use-form-control";

/**
 * The state an inline calendar shares with its field: disabled also by a
 * disabled `<fieldset>` around it, and reset with its form. Put
 * `wrapperRef` on the element around the calendar.
 */
export default function useCalendarField({
  disabled,
  form,
  onReset,
}: {
  disabled: boolean;
  form?: string;
  onReset: () => void;
}) {
  // The days are no native fields - a disabled fieldset around them leaves
  // them alone unless told
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  // `form.reset()` - also the one after a React form action
  const formResetRef = useFormReset(onReset, form);

  const wrapperRef = useCallback(
    (element: HTMLDivElement | null) => {
      const detachReset = formResetRef(element);
      const detachFieldset = fieldsetRef(element);

      return () => {
        detachReset?.();
        detachFieldset?.();
      };
    },
    [fieldsetRef, formResetRef],
  );

  return { disabled: disabled || fieldsetDisabled, wrapperRef };
}
