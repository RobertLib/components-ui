import { useCallback, useEffect, useRef, useState } from "react";

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type FieldValue = string | number | readonly string[];

/** Points a `ref` prop at `element` - returns what detaches it again. */
function attachRef<T>(ref: React.Ref<T> | undefined, element: T | null) {
  if (typeof ref === "function") {
    const cleanup = ref(element);
    return typeof cleanup === "function" ? cleanup : () => ref(null);
  }

  if (ref) {
    ref.current = element;
    return () => {
      ref.current = null;
    };
  }

  return () => {};
}

/**
 * The value of a field that works controlled (`value` + `onChange`) and
 * uncontrolled (`defaultValue`). A controlled field always shows `value`, so
 * a change the parent rejects does not show up.
 *
 * Put the returned `fieldRef` on the field element: it keeps the field's own
 * `ref` prop working and lets `form.reset()` - also the one after a React
 * form action - bring back the `defaultValue` of an uncontrolled field.
 */
export function useFormControl<T extends FieldElement = FieldElement>({
  defaultValue,
  onChange,
  ref,
  value,
}: {
  defaultValue?: FieldValue;
  onChange?: React.ChangeEventHandler<T>;
  ref?: React.Ref<T>;
  value?: FieldValue;
}) {
  // What the user entered into an uncontrolled field. Until then, and again
  // after a reset, it shows `defaultValue` - like a native field does.
  const [enteredValue, setEnteredValue] = useState<FieldValue>();
  const isControlled = value !== undefined;

  const handleChange = useCallback(
    (event: React.ChangeEvent<T>) => {
      onChange?.(event);
      if (isControlled) return;

      const { target } = event;
      setEnteredValue(
        // The `value` of a multiple select is just its first selected option
        target instanceof HTMLSelectElement && target.multiple
          ? Array.from(target.selectedOptions, (option) => option.value)
          : target.value,
      );
    },
    [isControlled, onChange],
  );

  // A reset fires an event on the form only, none on its fields
  const fieldRef = useCallback(
    (element: T | null) => {
      const detachRef = attachRef(ref, element);
      const form = element?.form;
      const handleReset = () => setEnteredValue(undefined);

      form?.addEventListener("reset", handleReset);

      return () => {
        form?.removeEventListener("reset", handleReset);
        detachRef();
      };
    },
    [ref],
  );

  return {
    fieldRef,
    handleChange,
    value: isControlled ? value : (enteredValue ?? defaultValue ?? ""),
  };
}

/**
 * Calls `onReset` when the form around an element is reset - `form.reset()`,
 * a reset button, or React after a form action. For fields that keep their
 * value outside of a native form control (hidden inputs, `contentEditable`).
 *
 * Put the returned ref on an element inside the form (a field element also
 * follows its `form` attribute).
 */
export function useFormReset(onReset: () => void) {
  const onResetRef = useRef(onReset);

  useEffect(() => {
    onResetRef.current = onReset;
  });

  // A reset fires an event on the form only, none on its fields
  return useCallback((element: Element | null) => {
    const form =
      element && "form" in element && element.form instanceof HTMLFormElement
        ? element.form
        : element?.closest("form");
    if (!form) return;

    const handleReset = () => onResetRef.current();
    form.addEventListener("reset", handleReset);

    return () => form.removeEventListener("reset", handleReset);
  }, []);
}
