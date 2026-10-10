import {
  useCallback,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type FieldValue = string | number | readonly string[];

/**
 * Keeps a field's DOM listeners while Activity hides it: its refs and
 * layout effects detach, but its form controls and state stay alive.
 * A replaced ref or removed element lets go after the commit; a real
 * unmount lets go at once, even when the field was already hidden.
 */
function useRetainedFieldWatch() {
  const watches = useRef(
    new Map<Element, { detached: boolean; stop: () => void }>(),
  );
  const visible = useRef(false);

  const releaseDetached = useCallback(() => {
    const current = watches.current;
    for (const [element, watch] of current) {
      if (!watch.detached || (!visible.current && element.isConnected)) {
        continue;
      }
      current.delete(element);
      watch.stop();
    }
  }, []);

  useLayoutEffect(() => {
    visible.current = true;
    // Revealing Activity reconnects only the refs still rendered. A ref
    // removed while hidden needs releasing even if its node stayed alive.
    queueMicrotask(releaseDetached);
    return () => {
      visible.current = false;
    };
  }, [releaseDetached]);

  useInsertionEffect(() => {
    // Hidden updates can remove a node whose ref already detached on hide.
    // There is no second ref cleanup, so check again after every commit.
    queueMicrotask(releaseDetached);
  });

  useInsertionEffect(() => {
    const current = watches.current;
    return () => {
      current.forEach((watch) => watch.stop());
      current.clear();
    };
  }, []);

  return useCallback(
    (element: Element, start: () => () => void) => {
      const current = watches.current;
      current.get(element)?.stop();
      const watch = { detached: false, stop: start() };
      current.set(element, watch);

      return () => {
        watch.detached = true;
        // Ref cleanup runs before the layout cleanup that tells us whether
        // Activity hid the field. Reattaching the same node replaces this
        // registration before this microtask gets a chance to remove it.
        queueMicrotask(releaseDetached);
      };
    },
    [releaseDetached],
  );
}

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
function setResetValue(element: FieldElement, value: FieldValue | undefined) {
  const values = new Set(
    (Array.isArray(value) ? value : [value ?? ""]).map(String),
  );

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
    // No default is no selection - an empty string is a real radio option.
    setDefaultChecked(
      element,
      value !== undefined && values.has(element.value),
    );
  }
}

/** The value of a field element - of a multiple select all picked ones. */
function readValue(element: FieldElement): FieldValue {
  // The `value` of a multiple select is just its first selected option
  return element instanceof HTMLSelectElement && element.multiple
    ? Array.from(element.selectedOptions, (option) => option.value)
    : element.value;
}

type WatchedProperty = "checked" | "indeterminate" | "value";

/** A property of `element` - its own or that of its prototype. */
function findProperty(element: FieldElement, name: WatchedProperty) {
  for (
    let target: object | null = element;
    target;
    target = Object.getPrototypeOf(target)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    if (descriptor) return descriptor;
  }
  return undefined;
}

/**
 * Calls `onWrite` whenever a script sets the property `name` of `element` -
 * which fires no event: React Hook Form's `register()`, `setValue()` and
 * `reset()` set the `value` (the `checked` of a checkbox). Wraps the
 * property the way React tracks it, and passes every write on to it.
 * Returns what stops the watch.
 */
function watchPropertyWrites(
  element: FieldElement,
  name: WatchedProperty,
  onWrite: () => void,
) {
  const property = findProperty(element, name);
  const get = property?.get;
  const set = property?.set;
  if (!property || !get || !set) return () => {};

  const own = Object.getOwnPropertyDescriptor(element, name);
  let active = true;
  const setValue = function (this: FieldElement, next: unknown) {
    set.call(this, next);
    if (active) onWrite();
  };

  Object.defineProperty(element, name, {
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
    if (Object.getOwnPropertyDescriptor(element, name)?.set !== setValue) {
      return;
    }
    if (own) Object.defineProperty(element, name, own);
    else Reflect.deleteProperty(element, name);
  };
}

// Reset events waiting for every listener to have had a chance to cancel
// them, including later listeners on the same root and on the window
const pendingResets = new WeakMap<Node, Set<Event>>();
// The callbacks watching resets in a document or shadow root. A field
// rendered with a new ref during a reset (a state update of `onReset`
// renders before the event reaches the root) watches anew - the watchers
// alive when the reset settles count.
const resetWatchers = new WeakMap<
  Node,
  Set<(form: EventTarget | null, event: Event) => void>
>();

/**
 * A value written after form.reset() returns wins over its deferred reset,
 * e.g. React Hook Form restoring its defaults. Returns a reset still being
 * dispatched: its default action may yet overwrite the write.
 */
function supersedeResets(
  element: Element,
  superseded: WeakSet<Event>,
  formId?: string,
) {
  let dispatching: Event | undefined;
  for (const event of pendingResets.get(element.getRootNode()) ?? []) {
    if (event.eventPhase === Event.NONE) superseded.add(event);
    else if (event.target === ownerFormOf(element, formId)) dispatching = event;
  }
  return dispatching;
}

/**
 * Calls `onReset` after a reset of the current form of `element` that was
 * not canceled. Listens at the document or shadow root, so a form mounted
 * later, replaced or renamed is followed without reattaching the field.
 * Settles a task later, after every listener can cancel the reset. A
 * microtask is too early: a browser can run it between event listeners.
 * Capture also catches resets stopped before they bubble to the root.
 * `onCancel` lets a field keep script writes made during a canceled reset.
 */
function watchFormReset(
  element: Element,
  onReset: (event: Event) => void,
  formId?: string | (() => string | undefined),
  onCancel?: (event: Event) => void,
) {
  const root = element.getRootNode();
  const watchers = resetWatchers.get(root) ?? new Set();
  resetWatchers.set(root, watchers);
  // A function of its own - the same callback may watch twice
  const watcher = (form: EventTarget | null, event: Event) => {
    const currentFormId = typeof formId === "function" ? formId() : formId;
    if (!form || form !== ownerFormOf(element, currentFormId)) return;
    if (event.defaultPrevented) onCancel?.(event);
    else onReset(event);
  };
  watchers.add(watcher);

  const handleReset = (event: Event) => {
    const pending = pendingResets.get(root) ?? new Set<Event>();
    if (pending.has(event)) return;
    pending.add(event);
    pendingResets.set(root, pending);
    // A shadow-root event loses its target once dispatch has finished.
    const form = event.target;

    setTimeout(() => {
      pending.delete(event);
      // A callback may synchronously render and attach new watchers. They
      // must not be visited again by this reset.
      for (const current of [...(resetWatchers.get(root) ?? [])]) {
        current(form, event);
      }
    });
  };

  root.addEventListener("reset", handleReset, true);
  // Also catch a reset whose first watcher was attached after capture,
  // e.g. by a render in the form's onReset.
  root.addEventListener("reset", handleReset);

  return () => {
    watchers.delete(watcher);
    root.removeEventListener("reset", handleReset, true);
    root.removeEventListener("reset", handleReset);
  };
}

/** Whether `element` shows a value of its own - not a checkbox or a radio. */
const holdsValue = (element: FieldElement) =>
  !(
    element instanceof HTMLInputElement &&
    (element.type === "checkbox" || element.type === "radio")
  );

function sameValue(a: FieldValue | undefined, b: FieldValue | undefined) {
  if (a === undefined || b === undefined) return false;

  // Compare each selected value: ["a", "b"] and ["a,b"] are different
  // selections, as are no selection and one option with an empty value.
  const left = Array.isArray(a) ? a : [a];
  const right = Array.isArray(b) ? b : [b];
  return (
    left.length === right.length &&
    left.every((value, index) => String(value) === String(right[index]))
  );
}

/**
 * Whether `written` is what the element shows for its default - also as a
 * mask lays it out, which React writes for a default given without it.
 */
const showsDefault = (
  written: FieldValue | undefined,
  defaultValue: FieldValue | undefined,
  shownDefault: FieldValue | undefined,
) => sameValue(written, defaultValue ?? "") || sameValue(written, shownDefault);

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
  commitBeforeChange = false,
  defaultValue,
  followScriptWrites = false,
  form,
  onChange,
  ref,
  shownDefault,
  value,
}: {
  /**
   * Renders what the user entered into an uncontrolled field before
   * `onChange`, which may submit the form - for a value the form takes from
   * another element than the field's (a hidden input).
   */
  commitBeforeChange?: boolean;
  defaultValue?: FieldValue;
  /** Makes a value a script writes into the element the field's value. */
  followScriptWrites?: boolean;
  /** Reattaches the reset listener when the native field changes forms. */
  form?: string;
  onChange?: React.ChangeEventHandler<T>;
  ref?: React.Ref<T>;
  /**
   * The text the element shows for `defaultValue` when it differs - laid
   * into a mask. React writing it is no value a script entered.
   */
  shownDefault?: FieldValue;
  value?: FieldValue;
}) {
  // What the user (or a script) entered into an uncontrolled field. Until
  // then, and again after a reset, it shows `defaultValue` - like a native
  // field does.
  const [enteredValue, setEnteredValue] = useState<FieldValue>();
  const isControlled = value !== undefined;
  // The elements `fieldRef` is on
  const elements = useRef(new Set<T>());
  const retainWatch = useRetainedFieldWatch();
  const supersededResets = useRef(new WeakSet<Event>());
  // What the listeners of the DOM need to know - up to date after each
  // render, and `entered` also at once after a change
  const latest = useRef({
    defaultValue,
    form,
    entered: undefined as FieldValue | undefined,
    // The entered value was written by a script, not typed
    fromScript: false,
    isControlled,
    shownDefault,
    writeDuringReset: undefined as Event | undefined,
  });

  const handleChange = useCallback(
    (event: React.ChangeEvent<T>) => {
      const enter = () => {
        // Some composite fields report a value-only target; the refs still
        // point at their real form controls.
        for (const element of elements.current) {
          supersedeResets(element, supersededResets.current, form);
        }
        const entered = readValue(event.target);
        latest.current.entered = entered;
        latest.current.fromScript = false;
        latest.current.writeDuringReset = undefined;
        setEnteredValue(entered);
      };

      if (commitBeforeChange && !isControlled) {
        flushSync(enter);
        onChange?.(event);
        return;
      }
      onChange?.(event);
      if (!isControlled) enter();
    },
    [commitBeforeChange, form, isControlled, onChange],
  );

  // A reset fires an event on the form only, none on its fields
  const fieldRef = useCallback(
    (element: T | null) => {
      const handleReset = (event: Event) => {
        if (supersededResets.current.has(event)) return;
        latest.current.entered = undefined;
        latest.current.fromScript = false;
        latest.current.writeDuringReset = undefined;
        setEnteredValue(undefined);
      };

      const handleCancelReset = (event: Event) => {
        const state = latest.current;
        if (state.writeDuringReset !== event) return;
        state.writeDuringReset = undefined;
        setEnteredValue(state.entered);
      };

      // A write while nothing was entered that brings the default is React
      // showing it (after a reset) - no value entered
      const handleWrite = () => {
        const state = latest.current;
        if (!element || state.isControlled) return;

        const dispatching = supersedeResets(
          element,
          supersededResets.current,
          state.form,
        );
        const written = readValue(element);
        if (
          state.entered === undefined &&
          showsDefault(written, state.defaultValue, state.shownDefault)
        ) {
          return;
        }

        state.entered = written;
        state.fromScript = true;
        state.writeDuringReset = dispatching;
        // During a reset, wait for its outcome. Rendering the written value
        // now could restore it after the native reset but before we settle.
        if (!dispatching) setEnteredValue(written);
      };

      // Watched before the `ref` prop gets the element - `register()`
      // writes the default value into it right then
      const detachWatch = element
        ? retainWatch(element, () => {
            elements.current.add(element);
            const stopWatching =
              followScriptWrites && holdsValue(element)
                ? watchPropertyWrites(element, "value", handleWrite)
                : undefined;
            const stopResetWatch = watchFormReset(
              element,
              handleReset,
              () => latest.current.form,
              handleCancelReset,
            );
            return () => {
              elements.current.delete(element);
              stopResetWatch();
              stopWatching?.();
            };
          })
        : undefined;
      const detachRef = attachRef(ref, element);

      return () => {
        detachWatch?.();
        detachRef();
      };
    },
    [followScriptWrites, ref, retainWatch],
  );

  // What a reset brings back: the value a controlled field shows, the
  // `defaultValue` of an uncontrolled one - also one that arrived late
  const resetValue = isControlled ? value : defaultValue;

  useInsertionEffect(() => {
    const state = latest.current;
    state.defaultValue = defaultValue;
    state.form = form;
    state.isControlled = isControlled;
    state.shownDefault = shownDefault;
  }, [defaultValue, form, isControlled, shownDefault]);

  useLayoutEffect(() => {
    const state = latest.current;
    // React applying a late default writes during the commit, after this
    // render had no entered value. Clear only that write; an entered value
    // already in the render stays even when a later default matches it.
    if (
      !isControlled &&
      enteredValue === undefined &&
      state.fromScript &&
      showsDefault(state.entered, defaultValue, shownDefault)
    ) {
      state.entered = undefined;
      state.fromScript = false;
      setEnteredValue(undefined);
    }
  }, [defaultValue, enteredValue, isControlled, shownDefault]);

  // Activity keeps these controls in their form but skips layout effects
  // while hidden. Their reset defaults must follow hidden commits too.
  useInsertionEffect(() => {
    for (const element of elements.current) {
      setResetValue(element, resetValue);
    }
  });

  // Newly attached refs are only available after insertion effects.
  useLayoutEffect(() => {
    for (const element of elements.current) {
      setResetValue(element, resetValue);
    }
  });

  const resolvedValue = isControlled ? value : (enteredValue ?? defaultValue);

  return {
    fieldRef,
    handleChange,
    // Radios distinguish an unselected group from an explicitly empty pick.
    hasValue: resolvedValue !== undefined,
    value: resolvedValue ?? "",
  };
}

/**
 * Whether an `aria-invalid` of the page marks a field as invalid - `"true"`,
 * `"grammar"`, `"spelling"`, not `"false"`.
 */
export const isAriaInvalid = (value: React.AriaAttributes["aria-invalid"]) =>
  value !== undefined && value !== false && value !== "false";

/**
 * The `data-state` of a checkbox (a switch, an option of a group) - what it
 * shows: `checked`, `unchecked` or `indeterminate` (partly checked).
 */
export const checkedState = (
  checked: boolean | undefined,
  indeterminate?: boolean,
) => (indeterminate ? "indeterminate" : checked ? "checked" : "unchecked");

/**
 * Keeps the `data-state` of `checkbox` telling its state - also when the
 * state changes without a render: a click on an uncontrolled checkbox, a
 * reset of its form, a script setting `checked` (React Hook Form) or
 * `indeterminate`. Returns what stops it.
 */
function watchCheckedState(
  checkbox: HTMLInputElement,
  formId?: string | (() => string | undefined),
) {
  const update = () => {
    checkbox.dataset.state = checkedState(
      checkbox.checked,
      checkbox.indeterminate,
    );
  };
  const stopChecked = watchPropertyWrites(checkbox, "checked", update);
  const stopIndeterminate = watchPropertyWrites(
    checkbox,
    "indeterminate",
    update,
  );
  const stopReset = watchFormReset(checkbox, update, formId);
  checkbox.addEventListener("change", update);
  update();

  return () => {
    checkbox.removeEventListener("change", update);
    stopReset();
    stopIndeterminate();
    stopChecked();
  };
}

/**
 * For a checkbox that works controlled (`checked` + `onChange`) and
 * uncontrolled (`defaultChecked`) like a native one: makes `form.reset()` -
 * also the one after a React form action - leave a controlled checkbox
 * showing `checked`. (An uncontrolled one goes back to `defaultChecked` by
 * itself.) Also sets `indeterminate`, which exists only as a DOM property,
 * and keeps `data-state` telling what the checkbox shows (`checkedState` -
 * render it too, for the first paint and the server).
 *
 * Put the returned ref on the checkbox - it keeps its own `ref` prop working.
 */
export function useCheckedControl({
  checked,
  form,
  indeterminate,
  ref,
}: {
  checked?: boolean;
  /** Follows resets of the checkbox's current form. */
  form?: string;
  /**
   * Left alone while `undefined` - the page may set it itself - after
   * clearing it once when it goes from `true` to `undefined`
   * (`indeterminate={partly || undefined}`).
   */
  indeterminate?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}) {
  const element = useRef<HTMLInputElement | null>(null);
  const retainWatch = useRetainedFieldWatch();
  const latestForm = useRef(form);
  // Whether the last render made the checkbox partly checked
  const wasIndeterminate = useRef(false);

  useInsertionEffect(() => {
    latestForm.current = form;
  }, [form]);

  const checkboxRef = useCallback(
    (checkbox: HTMLInputElement | null) => {
      const detachWatch = checkbox
        ? retainWatch(checkbox, () => {
            element.current = checkbox;
            const stopState = watchCheckedState(
              checkbox,
              () => latestForm.current,
            );
            return () => {
              if (element.current === checkbox) element.current = null;
              stopState();
            };
          })
        : undefined;
      const detachRef = attachRef(ref, checkbox);

      return () => {
        detachRef();
        detachWatch?.();
      };
    },
    [ref, retainWatch],
  );

  const sync = () => {
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

    // A render writes the `data-state` of the props - the checkbox may show
    // another one (an uncontrolled checkbox the user clicked)
    checkbox.dataset.state = checkedState(
      checkbox.checked,
      checkbox.indeterminate,
    );
  };

  // Retained checkboxes still submit and reset while Activity is hidden.
  useInsertionEffect(sync);
  // Ref callbacks attach new checkboxes after insertion effects.
  useLayoutEffect(sync);

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
 * fieldsets around it and changes to their first legend. `false` on the server.
 */
export function useFieldsetDisabled() {
  const [disabled, setDisabled] = useState(false);

  const ref = useCallback((element: Element | null) => {
    if (!element) return;

    const update = () => setDisabled(isDisabledByFieldset(element));
    update();

    const observer = new MutationObserver(update);
    for (const fieldset of fieldsetsAround(element)) {
      // Inserting, removing or moving a direct child can change which
      // legend exempts its fields, without changing `disabled` or our ref.
      observer.observe(fieldset, {
        attributeFilter: ["disabled"],
        childList: true,
      });
    }

    return () => observer.disconnect();
  }, []);

  return [disabled, ref] as const;
}

/** The form with `formId` in the same document or shadow root as `element`. */
function findForm(element: Element, formId: string) {
  const root = element.getRootNode() as Document | ShadowRoot;
  const form = root.getElementById?.(formId);
  return form instanceof HTMLFormElement ? form : null;
}

/** An explicit form association, including none, overrides the ancestor form. */
function ownerFormOf(element: Element, formId?: string) {
  if (formId !== undefined) return findForm(element, formId);
  if ("form" in element) {
    return element.form instanceof HTMLFormElement ? element.form : null;
  }
  return element.closest("form");
}

/**
 * Leaves an internal field name out of submitted data. Put the ref on the
 * group whose radios share that name. Capture on the root follows a form
 * mounted later, replaced or renamed, including in a shadow root.
 * `undefined` keeps the data, for a group with a name supplied by the app.
 */
export function useOmitFormValue(name: string | undefined, formId?: string) {
  return useCallback(
    (element: Element | null) => {
      if (!element || name === undefined) return;

      const root = element.getRootNode();
      const dropValue = (event: Event) => {
        if (event.target === ownerFormOf(element, formId)) {
          (event as FormDataEvent).formData.delete(name);
        }
      };
      root.addEventListener("formdata", dropValue, true);
      return () => root.removeEventListener("formdata", dropValue, true);
    },
    [formId, name],
  );
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
  const latest = useRef({ formId, onReset });
  const retainWatch = useRetainedFieldWatch();

  useInsertionEffect(() => {
    latest.current = { formId, onReset };
  });

  // A reset fires an event on the form only, none on its fields
  return useCallback(
    (element: Element | null) => {
      if (!element) return;

      return retainWatch(element, () =>
        watchFormReset(
          element,
          () => latest.current.onReset(),
          () => latest.current.formId,
        ),
      );
    },
    [retainWatch],
  );
}
