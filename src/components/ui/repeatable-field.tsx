import { useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  attachRef,
  isAriaInvalid,
  useFieldsetDisabled,
  useFormReset,
} from "../../hooks/use-form-control";
import createLatest from "../../hooks/create-latest";
import useCustomValidity from "../../hooks/use-custom-validity";
import { formatMessage, formatPlural } from "../../i18n/ui/format";
import { useLocale } from "../../providers/ui-context";
import cn, { joinTokens } from "../../utils/cn";
import Button from "./button";
import IconButton from "./icon-button";
import FormDescription from "./form-description";
import FormError from "./form-error";
import { getActiveElement } from "./overlay-stack";

// Lets the browser enforce the count without a field of its own to show
const hiddenValidationStyle: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 1,
  height: 1,
};

/** Stable identity and value of one repeated group. */
export interface RepeatableFieldItem<T> {
  id: string;
  value: T;
}

/** State passed to the renderer of one repeated group. */
export interface RepeatableFieldItemProps<T> extends RepeatableFieldItem<T> {
  /** Zero-based position; changes after reordering. */
  index: number;
  /** Dot-separated form path, such as contacts.0; append the field name. */
  name?: string;
  /** Explicit owner form; pass to controls rendered outside their form. */
  form?: string;
  /**
   * Replace this group's value - in the latest groups, so several groups
   * can change in one event, and one after an `await` keeps the others.
   */
  onChange: (value: T) => void;
  disabled: boolean;
  readOnly: boolean;
  dim: "xs" | "sm" | "md" | "lg";
}

export interface RepeatableFieldProps<T> extends Omit<
  React.ComponentProps<"div">,
  "children" | "defaultValue" | "onChange"
> {
  /** Controlled groups with unique stable ids. */
  value?: readonly RepeatableFieldItem<T>[];
  /** Initial groups, followed until interaction and restored on reset. */
  defaultValue?: readonly RepeatableFieldItem<T>[];
  /**
   * The groups after adding, removing, reordering or changing a value. A
   * controlled parent may decline them - the next change builds on `value`.
   * After an add, a remove or a move the form holds the groups of an
   * uncontrolled field - it can be submitted from here.
   */
  onChange?: (items: RepeatableFieldItem<T>[]) => void;
  /** Creates a value when Add is pressed; the component supplies its stable id. */
  createItem: () => T;
  /** Renders the fields of one group. Pass disabled/readOnly to custom controls. */
  renderItem: (item: RepeatableFieldItemProps<T>) => React.ReactNode;
  /** Visible label and accessible name. */
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  /** Form name prefix for rendered controls; the component does not serialize T. */
  name?: string;
  form?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /**
   * Minimum count checked on native submission - the message shows at a
   * submit or `reportValidity()`, not at `checkValidity()`. Defaults to zero.
   */
  min?: number;
  /** Maximum count; disables adding at this count. */
  max?: number;
  /** Offer Move up/down actions. Defaults to true. */
  reorderable?: boolean;
  /** Label of the Add button; localized by default. */
  addLabel?: React.ReactNode;
  /** Size passed to renderItem and the action buttons. Defaults to md. */
  dim?: "xs" | "sm" | "md" | "lg";
}

/** Repeated form groups with stable keys, add/remove, reordering and count validation. */
export default function RepeatableField<T>({
  addLabel,
  className,
  createItem,
  defaultValue = [],
  description,
  dim = "md",
  disabled: disabledProp,
  error,
  form,
  id: providedId,
  label,
  max,
  min = 0,
  name,
  onChange,
  readOnly = false,
  ref,
  renderItem,
  reorderable = true,
  required = false,
  value,
  ...props
}: RepeatableFieldProps<T>) {
  const locale = useLocale();
  const messages = locale.messages.ui.repeatableField;
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = !!disabledProp || fieldsetDisabled;
  const [draft, setDraft] = useState<RepeatableFieldItem<T>[]>();
  const items = value ?? draft ?? defaultValue;
  // The rows after the latest change - a change before the next render
  // (two rows at once, an upload finishing in one row while the user types
  // in another) builds on them, not on the rows its handler was rendered
  // with. No ref: the row handlers are created in `renderItem`'s render
  const [latest] = useState(() => createLatest(items));
  // A change renders also when a controlled parent declines it, so that
  // the layout effect puts `latest` back to the rows the parent keeps
  const [, renderChange] = useReducer((count: number) => count + 1, 0);
  const counter = useRef(0);
  const groupRef = useRef<HTMLDivElement | null>(null);
  // The rows an add, a remove or a move leaves, and the row to focus once
  // they render - null for the Add button
  const pendingFocus = useRef<{ ids: string[]; row: string | null } | null>(
    null,
  );
  const [validationShown, setValidationShown] = useState(false);
  const minimum = Math.max(
    required ? 1 : 0,
    Number.isFinite(min) ? Math.floor(min) : 0,
  );
  const maximum =
    max !== undefined && Number.isFinite(max)
      ? Math.max(0, Math.floor(max))
      : Infinity;
  const invalid =
    disabled || readOnly
      ? ""
      : items.length < minimum
        ? formatPlural(locale.code, messages.minimum, minimum)
        : items.length > maximum
          ? formatPlural(locale.code, messages.maximum, maximum)
          : "";
  const validationRef = useRef<HTMLInputElement | null>(null);
  useCustomValidity(validationRef, invalid);
  const resetRef = useFormReset(() => {
    setDraft(undefined);
    setValidationShown(false);
    pendingFocus.current = null;
  }, form);
  const shownError = error || (validationShown ? invalid : undefined);
  const canChange = !disabled && !readOnly;
  // `flush` - the rows render before `onChange`, which may submit the form
  const report = (next: RepeatableFieldItem<T>[], flush = false) => {
    if (!canChange) return;
    latest.set(next);
    if (value !== undefined) renderChange();
    else if (flush) flushSync(() => setDraft(next));
    else setDraft(next);
    onChange?.(next);
  };
  // `focus` - the id of the row to focus after the render, null for Add.
  // The rows of an uncontrolled field are in the form by `onChange`; a
  // group's own change is not flushed - it may come from an effect of the
  // app, where React cannot render at once.
  const commit = (next: RepeatableFieldItem<T>[], focus: string | null) => {
    if (!canChange) return;
    pendingFocus.current = { ids: next.map((item) => item.id), row: focus };
    report(next, true);
  };
  useLayoutEffect(() => {
    latest.set(items);
    const pending = pendingFocus.current;
    // Only the render of the change moves the focus, and only to the rows
    // it committed - a controlled parent that declined or deferred it
    // renders others, and a later render must not take the focus then
    pendingFocus.current = null;
    const group = groupRef.current;
    if (
      !pending ||
      !group ||
      pending.ids.length !== items.length ||
      items.some((item, index) => item.id !== pending.ids[index])
    )
      return;
    if (pending.row === null) {
      // Add was still disabled at `max` while the last row was removed
      (
        group.querySelector<HTMLElement>(
          "[data-repeatable-add]:not(:disabled)",
        ) ?? group
      ).focus();
      return;
    }
    const row = [
      ...group.querySelectorAll<HTMLElement>("[data-repeatable-item]"),
    ].find((element) => element.dataset.repeatableItem === pending.row);
    (
      row?.querySelector<HTMLElement>(
        "input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),[tabindex='0']",
      ) ?? row
    )?.focus();
  });
  const move = (rowId: string, offset: number) => {
    const next = [...latest.get()];
    const index = next.findIndex((entry) => entry.id === rowId);
    const other = index + offset;
    if (index < 0 || other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    commit(next, rowId);
  };
  return (
    <div
      {...props}
      aria-describedby={joinTokens(
        shownError ? `${id}-error` : undefined,
        description ? `${id}-description` : undefined,
        props["aria-describedby"],
      )}
      // Announced with the message - a count refused before any submit
      // marks only `data-invalid`
      aria-invalid={shownError ? "true" : props["aria-invalid"]}
      aria-labelledby={label ? `${id}-label` : props["aria-labelledby"]}
      className={cn("space-y-3", className)}
      data-disabled={disabled ? "" : undefined}
      data-invalid={
        shownError || invalid || isAriaInvalid(props["aria-invalid"])
          ? ""
          : undefined
      }
      data-readonly={readOnly ? "" : undefined}
      id={id}
      ref={(element) => {
        groupRef.current = element;
        const detach = attachRef(ref, element);
        const detachDisabled = fieldsetRef(element);
        const detachReset = resetRef(element);
        return () => {
          groupRef.current = null;
          detach();
          detachDisabled?.();
          detachReset?.();
        };
      }}
      role="group"
      tabIndex={props.tabIndex ?? -1}
    >
      {label && (
        <div className="text-sm font-medium" id={`${id}-label`}>
          {label}
        </div>
      )}
      {items.map((item, index) => (
        <div
          className="flex items-start gap-2"
          data-repeatable-item={item.id}
          key={item.id}
          tabIndex={-1}
        >
          <fieldset className="min-w-0 flex-1" disabled={disabled} form={form}>
            {renderItem({
              ...item,
              index,
              name: name ? `${name}.${index}` : undefined,
              dim,
              form,
              disabled,
              readOnly,
              onChange: (nextValue) => {
                const current = latest.get();
                // A row removed meanwhile stays removed
                if (!current.some((entry) => entry.id === item.id)) return;
                report(
                  current.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, value: nextValue }
                      : entry,
                  ),
                );
              },
            })}
          </fieldset>
          {!readOnly && (
            <div className="flex gap-1">
              {reorderable && (
                <>
                  <IconButton
                    aria-label={formatMessage(messages.moveUp, {
                      index: index + 1,
                    })}
                    disabled={!canChange || index === 0}
                    onClick={() => move(item.id, -1)}
                    size="sm"
                  >
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton
                    aria-label={formatMessage(messages.moveDown, {
                      index: index + 1,
                    })}
                    disabled={!canChange || index === items.length - 1}
                    onClick={() => move(item.id, 1)}
                    size="sm"
                  >
                    <ArrowDown size={16} />
                  </IconButton>
                </>
              )}
              <IconButton
                aria-label={formatMessage(messages.remove, {
                  index: index + 1,
                })}
                disabled={!canChange}
                onClick={() => {
                  const current = latest.get();
                  const position = current.findIndex(
                    (entry) => entry.id === item.id,
                  );
                  if (position < 0) return;
                  const next = current.filter((entry) => entry.id !== item.id);
                  // The row taking its place, or Add after the last one
                  commit(
                    next,
                    next[Math.min(position, next.length - 1)]?.id ?? null,
                  );
                }}
                size="sm"
              >
                <Trash2 size={16} />
              </IconButton>
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <Button
          data-repeatable-add=""
          disabled={!canChange || items.length >= maximum}
          onClick={() => {
            const current = latest.get();
            let nextId: string;
            do {
              nextId = `${id}-${++counter.current}`;
            } while (current.some((item) => item.id === nextId));
            commit([...current, { id: nextId, value: createItem() }], nextId);
          }}
          size={
            dim === "xs" || dim === "sm" ? "sm" : dim === "lg" ? "lg" : "md"
          }
          variant="outline"
          startIcon={<Plus size={16} />}
        >
          {addLabel ?? messages.add}
        </Button>
      )}
      <input
        disabled={disabled || readOnly}
        form={form}
        // Neither focusable nor seen by assistive technology - until the
        // browser reports it invalid (a submit, `reportValidity()`), then it
        // can take the focus the browser gives it, with the message
        inert
        onChange={() => {}}
        // The browser focuses the first invalid field of a submit or of
        // `reportValidity()` - not of `checkValidity()`, which shows nothing:
        // the message shows then, and the user belongs in the group
        onFocus={(event) => {
          const validationInput = event.currentTarget;
          setValidationShown(true);
          // Once the browser is done focusing this input - moved at once,
          // Firefox would not focus it at the next submit again
          queueMicrotask(() => {
            if (
              getActiveElement(validationInput.ownerDocument) ===
              validationInput
            ) {
              groupRef.current?.focus();
            }
          });
        }}
        onInvalid={(event) => {
          const validationInput = event.currentTarget;
          validationInput.removeAttribute("inert");
          // Laid out anew at once (a call, which the React Compiler keeps) -
          // Safari would focus it by its styles of before, inert, and so
          // report nothing
          validationInput.getBoundingClientRect();
          setTimeout(() => validationInput.setAttribute("inert", ""));
        }}
        ref={validationRef}
        style={hiddenValidationStyle}
        tabIndex={-1}
        value={items.length ? "items" : ""}
      />
      {description && (
        <FormDescription id={`${id}-description`}>
          {description}
        </FormDescription>
      )}
      {shownError && <FormError id={`${id}-error`}>{shownError}</FormError>}
    </div>
  );
}
