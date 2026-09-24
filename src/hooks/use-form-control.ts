import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type FieldValue = string | number | readonly string[];

/** Points a `ref` prop at `element` - returns what detaches it again. */
export function attachRef<T>(
  ref: React.Ref<T> | undefined,
  element: T | null,
): () => void {
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

/** Sets whether `form.reset()` checks a checkbox or a radio. */
function setDefaultChecked(input: HTMLInputElement, isDefault: boolean) {
  if (input.defaultChecked === isDefault) return;

  // Setting `checked` marks the input as changed by script - then its new
  // default leaves what it shows alone
  const { checked } = input;
  input.checked = checked;
  input.defaultChecked = isDefault;
}

/**
 * Makes `value` what `form.reset()` brings back in a select (the
 * `defaultSelected` of its options) or a radio (its `defaultChecked`). React
 * writes these defaults only when the element mounts - the `value`
 * attribute of a text field it keeps in sync itself.
 */
function setResetValue(element: FieldElement, value: FieldValue) {
  const values = new Set((Array.isArray(value) ? value : [value]).map(String));

  if (element instanceof HTMLSelectElement) {
    for (const option of element.options) {
      const isDefault = values.has(option.value);
      if (option.defaultSelected === isDefault) continue;

      // Setting `selected` marks the option as changed by script - then its
      // new default leaves the selection alone
      const { selected } = option;
      option.selected = selected;
      option.defaultSelected = isDefault;
    }
  } else if (element instanceof HTMLInputElement && element.type === "radio") {
    setDefaultChecked(element, values.has(element.value));
  }
}

/**
 * The value of a field that works controlled (`value` + `onChange`) and
 * uncontrolled (`defaultValue`). A controlled field always shows `value`, so
 * a change the parent rejects does not show up.
 *
 * Put the returned `fieldRef` on the field element (on every radio of a
 * group): it keeps the field's own `ref` prop working, and makes a form
 * reset - `form.reset()`, also the one after a React form action - bring
 * back the `defaultValue` of an uncontrolled field and leave a controlled one
 * showing its `value`.
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
  // The elements `fieldRef` is on
  const elements = useRef(new Set<T>());

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

      if (element) elements.current.add(element);
      form?.addEventListener("reset", handleReset);

      return () => {
        if (element) elements.current.delete(element);
        form?.removeEventListener("reset", handleReset);
        detachRef();
      };
    },
    [ref],
  );

  // What a reset brings back: the value a controlled field shows, the
  // `defaultValue` of an uncontrolled one - also one that arrived late
  const resetValue = isControlled ? value : (defaultValue ?? "");

  useLayoutEffect(() => {
    for (const element of elements.current) {
      setResetValue(element, resetValue);
    }
  });

  return {
    fieldRef,
    handleChange,
    value: isControlled ? value : (enteredValue ?? defaultValue ?? ""),
  };
}

/**
 * For a checkbox that works controlled (`checked` + `onChange`) and
 * uncontrolled (`defaultChecked`) like a native one: makes `form.reset()` -
 * also the one after a React form action - leave a controlled checkbox
 * showing `checked`. (An uncontrolled one goes back to `defaultChecked` by
 * itself.) Also sets `indeterminate`, which exists only as a DOM property.
 *
 * Put the returned ref on the checkbox - it keeps its own `ref` prop working.
 */
export function useCheckedControl({
  checked,
  indeterminate,
  ref,
}: {
  checked?: boolean;
  /** Left alone when `undefined` - the page may set it itself. */
  indeterminate?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}) {
  const element = useRef<HTMLInputElement | null>(null);

  const checkboxRef = useCallback(
    (checkbox: HTMLInputElement | null) => {
      element.current = checkbox;
      const detachRef = attachRef(ref, checkbox);

      return () => {
        element.current = null;
        detachRef();
      };
    },
    [ref],
  );

  useLayoutEffect(() => {
    const checkbox = element.current;
    if (!checkbox) return;

    if (checked !== undefined) setDefaultChecked(checkbox, checked);

    // A click clears it - every render puts it back while the prop says so
    if (indeterminate !== undefined) checkbox.indeterminate = indeterminate;
  });

  return checkboxRef;
}

/** The `<fieldset>` elements around `element`, the nearest first. */
function* fieldsetsAround(element: Element) {
  for (
    let fieldset = element.parentElement?.closest("fieldset");
    fieldset;
    fieldset = fieldset.parentElement?.closest("fieldset")
  ) {
    yield fieldset;
  }
}

/**
 * Whether a `<fieldset disabled>` around `element` disables it, as it
 * disables a native field - one in the first `<legend>` of the fieldset it
 * leaves alone.
 */
function isDisabledByFieldset(element: Element) {
  for (const fieldset of fieldsetsAround(element)) {
    if (
      fieldset.disabled &&
      !fieldset.querySelector(":scope > legend")?.contains(element)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Whether a disabled `<fieldset>` around a field disables it - for the
 * controls of a field that are no native form controls (an element with a
 * role, a drop zone), which the fieldset leaves enabled. Put the returned
 * ref on an element of the field: the value follows the `disabled` of the
 * fieldsets around it as it changes. `false` on the server.
 */
export function useFieldsetDisabled() {
  const [disabled, setDisabled] = useState(false);

  const ref = useCallback((element: Element | null) => {
    if (!element) return;

    const update = () => setDisabled(isDisabledByFieldset(element));
    update();

    const observer = new MutationObserver(update);
    for (const fieldset of fieldsetsAround(element)) {
      observer.observe(fieldset, { attributeFilter: ["disabled"] });
    }

    return () => observer.disconnect();
  }, []);

  return [disabled, ref] as const;
}

/** The form with the id `formId` in the document of `element`. */
function findForm(element: Element, formId: string) {
  const form = element.ownerDocument.getElementById(formId);
  return form instanceof HTMLFormElement ? form : null;
}

/**
 * Calls `onReset` when the form around an element is reset - `form.reset()`,
 * a reset button, or React after a form action. For fields that keep their
 * value outside of a native form control (hidden inputs, `contentEditable`).
 *
 * Put the returned ref on an element inside the form (a field element also
 * follows its `form` attribute) - or anywhere, with the id of the form as
 * `formId` (the `form` prop of a field).
 */
export function useFormReset(onReset: () => void, formId?: string) {
  const onResetRef = useRef(onReset);

  useEffect(() => {
    onResetRef.current = onReset;
  });

  // A reset fires an event on the form only, none on its fields
  return useCallback(
    (element: Element | null) => {
      const form = !element
        ? null
        : formId
          ? findForm(element, formId)
          : "form" in element && element.form instanceof HTMLFormElement
            ? element.form
            : element.closest("form");
      if (!form) return;

      const handleReset = () => onResetRef.current();
      form.addEventListener("reset", handleReset);

      return () => form.removeEventListener("reset", handleReset);
    },
    [formId],
  );
}
