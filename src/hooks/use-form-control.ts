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

/** The value of a field element - of a multiple select all picked ones. */
function readValue(element: FieldElement): FieldValue {
  // The `value` of a multiple select is just its first selected option
  return element instanceof HTMLSelectElement && element.multiple
    ? Array.from(element.selectedOptions, (option) => option.value)
    : element.value;
}

/** The `value` property of `element` - its own or that of its prototype. */
function findValueProperty(element: FieldElement) {
  for (
    let target: object | null = element;
    target;
    target = Object.getPrototypeOf(target)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(target, "value");
    if (descriptor) return descriptor;
  }
  return undefined;
}

/**
 * Calls `onWrite` whenever a script sets the `value` of `element` - which
 * fires no event: React Hook Form's `register()`, `setValue()` and
 * `reset()` do so. Wraps the property the way React tracks it, and passes
 * every write on to it. Returns what stops the watch.
 */
function watchValueWrites(element: FieldElement, onWrite: () => void) {
  const property = findValueProperty(element);
  const get = property?.get;
  const set = property?.set;
  if (!property || !get || !set) return () => {};

  const own = Object.getOwnPropertyDescriptor(element, "value");
  let active = true;
  const setValue = function (this: FieldElement, next: unknown) {
    set.call(this, next);
    if (active) onWrite();
  };

  Object.defineProperty(element, "value", {
    configurable: true,
    enumerable: property.enumerable,
    get() {
      return get.call(this);
    },
    set: setValue,
  });

  return () => {
    active = false;
    // Wrapped once more meanwhile - that wrapper keeps calling this one
    if (Object.getOwnPropertyDescriptor(element, "value")?.set !== setValue) {
      return;
    }
    if (own) Object.defineProperty(element, "value", own);
    else Reflect.deleteProperty(element, "value");
  };
}

// Reset events that reached the root of their form's document - settled
// there by each watcher of the form
const resetsAtRoot = new WeakSet<Event>();
// Reset events a task waits for, in case a listener stops them on their way
// to the root
const resetsAwaited = new WeakSet<Event>();
// The callbacks watching the resets of a form. A field rendered with a new
// ref during a reset (a state update of `onReset` renders before the event
// reaches the root) watches anew - the watchers alive at the end count.
const resetWatchers = new WeakMap<HTMLFormElement, Set<() => void>>();

/**
 * Calls `onReset` after a reset of `form` that was not canceled. The event
 * reaches the form before the listeners of the page - a React `onReset`
 * that calls `preventDefault()` runs at the root - so it is settled once it
 * reaches the root of the form's document, or a task later when a listener
 * stopped it on its way there. Returns what stops the watch.
 */
function watchFormReset(form: HTMLFormElement, onReset: () => void) {
  const root = form.getRootNode();
  const watchers = resetWatchers.get(form) ?? new Set();
  resetWatchers.set(form, watchers);
  // A function of its own - the same callback may watch twice
  const watcher = () => onReset();
  watchers.add(watcher);

  const handleFormReset = (event: Event) => {
    if (resetsAwaited.has(event)) return;
    resetsAwaited.add(event);

    setTimeout(() => {
      if (resetsAtRoot.has(event) || event.defaultPrevented) return;
      for (const current of resetWatchers.get(form) ?? []) current();
    });
  };

  // By its target, not by an event seen at the form - a watcher that
  // started while the event was on its way still gets it here
  const handleRootReset = (event: Event) => {
    if (event.target !== form) return;
    resetsAtRoot.add(event);
    if (!event.defaultPrevented) onReset();
  };

  form.addEventListener("reset", handleFormReset);
  root.addEventListener("reset", handleRootReset);

  return () => {
    watchers.delete(watcher);
    form.removeEventListener("reset", handleFormReset);
    root.removeEventListener("reset", handleRootReset);
  };
}

/** Whether `element` shows a value of its own - not a checkbox or a radio. */
const holdsValue = (element: FieldElement) =>
  !(
    element instanceof HTMLInputElement &&
    (element.type === "checkbox" || element.type === "radio")
  );

const sameValue = (a: FieldValue | undefined, b: FieldValue | undefined) =>
  a !== undefined && b !== undefined && String(a) === String(b);

/**
 * The value of a field that works controlled (`value` + `onChange`) and
 * uncontrolled (`defaultValue`). A controlled field always shows `value`, so
 * a change the parent rejects does not show up.
 *
 * Put the returned `fieldRef` on the field element (on every radio of a
 * group): it keeps the field's own `ref` prop working, and makes a form
 * reset - `form.reset()`, also the one after a React form action - bring
 * back the `defaultValue` of an uncontrolled field and leave a controlled one
 * showing its `value`. A reset a listener cancels (`preventDefault()`)
 * changes nothing, as in a native field.
 *
 * With `followScriptWrites`, for an element that shows the value itself (an
 * input, a textarea, a select), a value a script writes into an uncontrolled
 * field - React Hook Form's `register()` with `defaultValues`, `setValue()`,
 * `reset(values)` - becomes its value, as in a native field: the next render
 * keeps it, and what depends on the value (a clear button, a counter)
 * follows it at once. A controlled field shows `value` again at its next
 * render, like a controlled native one. Only writes through the `value`
 * property count - a script selecting the options of a multiple select one
 * by one, or setting the `value` attribute, is seen at the next change.
 */
export function useFormControl<T extends FieldElement = FieldElement>({
  defaultValue,
  followScriptWrites = false,
  onChange,
  ref,
  value,
}: {
  defaultValue?: FieldValue;
  /** Makes a value a script writes into the element the field's value. */
  followScriptWrites?: boolean;
  onChange?: React.ChangeEventHandler<T>;
  ref?: React.Ref<T>;
  value?: FieldValue;
}) {
  // What the user (or a script) entered into an uncontrolled field. Until
  // then, and again after a reset, it shows `defaultValue` - like a native
  // field does.
  const [enteredValue, setEnteredValue] = useState<FieldValue>();
  const isControlled = value !== undefined;
  // The elements `fieldRef` is on
  const elements = useRef(new Set<T>());
  // What the listeners of the DOM need to know - up to date after each
  // render, and `entered` also at once after a change
  const latest = useRef({
    defaultValue,
    entered: undefined as FieldValue | undefined,
    // The entered value was written by a script, not typed
    fromScript: false,
    isControlled,
  });

  const handleChange = useCallback(
    (event: React.ChangeEvent<T>) => {
      onChange?.(event);
      if (isControlled) return;

      const entered = readValue(event.target);
      latest.current.entered = entered;
      latest.current.fromScript = false;
      setEnteredValue(entered);
    },
    [isControlled, onChange],
  );

  // A reset fires an event on the form only, none on its fields
  const fieldRef = useCallback(
    (element: T | null) => {
      const form = element?.form;
      const handleReset = () => {
        latest.current.entered = undefined;
        latest.current.fromScript = false;
        setEnteredValue(undefined);
      };

      // A write while nothing was entered that brings the default is React
      // showing it (after a reset) - no value entered
      const handleWrite = () => {
        const state = latest.current;
        if (!element || state.isControlled) return;

        const written = readValue(element);
        if (
          state.entered === undefined &&
          sameValue(written, state.defaultValue ?? "")
        ) {
          return;
        }

        state.entered = written;
        state.fromScript = true;
        setEnteredValue(written);
      };

      // Watched before the `ref` prop gets the element - `register()`
      // writes the default value into it right then
      const stopWatching =
        element && followScriptWrites && holdsValue(element)
          ? watchValueWrites(element, handleWrite)
          : undefined;
      const detachRef = attachRef(ref, element);

      if (element) elements.current.add(element);
      const stopResetWatch = form
        ? watchFormReset(form, handleReset)
        : undefined;

      return () => {
        if (element) elements.current.delete(element);
        stopResetWatch?.();
        detachRef();
        stopWatching?.();
      };
    },
    [followScriptWrites, ref],
  );

  // What a reset brings back: the value a controlled field shows, the
  // `defaultValue` of an uncontrolled one - also one that arrived late
  const resetValue = isControlled ? value : (defaultValue ?? "");

  useLayoutEffect(() => {
    const state = latest.current;
    state.defaultValue = defaultValue;
    state.isControlled = isControlled;

    // React writing a `defaultValue` that arrived late looks like a script
    // to the watch - the field shows its default then, and a later one too
    if (
      !isControlled &&
      state.fromScript &&
      sameValue(enteredValue, defaultValue ?? "")
    ) {
      state.entered = undefined;
      state.fromScript = false;
      setEnteredValue(undefined);
    }
  }, [defaultValue, enteredValue, isControlled]);

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
  /**
   * Left alone while `undefined` - the page may set it itself - after
   * clearing it once when it goes from `true` to `undefined`
   * (`indeterminate={partly || undefined}`).
   */
  indeterminate?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}) {
  const element = useRef<HTMLInputElement | null>(null);
  // Whether the last render made the checkbox partly checked
  const wasIndeterminate = useRef(false);

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

    // A click clears it - every render puts it back while the prop says so.
    // The prop going away takes back the partly checked state it set.
    if (indeterminate !== undefined) {
      checkbox.indeterminate = indeterminate;
    } else if (wasIndeterminate.current) {
      checkbox.indeterminate = false;
    }
    wasIndeterminate.current = indeterminate === true;
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
 * a reset button, or React after a form action - once the reset event has
 * passed the listeners of the page; not for a reset one of them canceled
 * (`preventDefault()`), which leaves native fields alone too. For fields that
 * keep their value outside of a native form control (hidden inputs,
 * `contentEditable`).
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

      return watchFormReset(form, () => onResetRef.current());
    },
    [formId],
  );
}
