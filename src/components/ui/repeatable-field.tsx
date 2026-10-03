import { useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  attachRef,
  isAriaInvalid,
  useFieldsetDisabled,
  useFormReset,
} from "../../hooks/use-form-control";
import useCustomValidity from "../../hooks/use-custom-validity";
import { formatMessage, formatPlural } from "../../i18n/format";
import { useLocale } from "../../providers/ui-context";
import cn, { joinTokens } from "../../utils/cn";
import Button from "./button";
import IconButton from "./icon-button";
import FormDescription from "./form-description";
import FormError from "./form-error";

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
  /** Replace this group's value. */
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
  /** The groups after adding, removing, reordering or changing a value. */
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
  /** Minimum count checked on native submission. Defaults to zero. */
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
  const messages = locale.messages.repeatableField;
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = !!disabledProp || fieldsetDisabled;
  const [draft, setDraft] = useState<RepeatableFieldItem<T>[]>();
  const items = value ?? draft ?? defaultValue;
  const counter = useRef(0);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<string | null>(null);
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
  const changeValue = (next: RepeatableFieldItem<T>[]) => {
    if (!canChange) return;
    if (value === undefined) setDraft(next);
    onChange?.(next);
  };
  const commit = (next: RepeatableFieldItem<T>[], focus?: string) => {
    if (!canChange) return;
    if (value === undefined) setDraft(next);
    pendingFocus.current = focus ?? null;
    onChange?.(next);
  };
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const row = [
      ...(groupRef.current?.querySelectorAll<HTMLElement>(
        "[data-repeatable-item]",
      ) ?? []),
    ].find((element) => element.dataset.repeatableItem === target);
    if (!row) return;
    pendingFocus.current = null;
    (
      row.querySelector<HTMLElement>(
        "input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),[tabindex='0']",
      ) ?? row
    ).focus();
  });
  const move = (index: number, offset: number) => {
    const next = [...items];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    commit(next, items[index].id);
  };
  return (
    <div
      {...props}
      aria-describedby={joinTokens(
        shownError ? `${id}-error` : undefined,
        description ? `${id}-description` : undefined,
        props["aria-describedby"],
      )}
      aria-invalid={
        !!shownError || !!invalid || props["aria-invalid"] || undefined
      }
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
              onChange: (nextValue) =>
                changeValue(
                  items.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, value: nextValue }
                      : entry,
                  ),
                ),
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
                    onClick={() => move(index, -1)}
                    size="sm"
                  >
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton
                    aria-label={formatMessage(messages.moveDown, {
                      index: index + 1,
                    })}
                    disabled={!canChange || index === items.length - 1}
                    onClick={() => move(index, 1)}
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
                  const next = items.filter((entry) => entry.id !== item.id);
                  commit(next, next[Math.min(index, next.length - 1)]?.id);
                  if (!next.length)
                    groupRef.current
                      ?.querySelector<HTMLElement>("[data-repeatable-add]")
                      ?.focus();
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
            let nextId: string;
            do {
              nextId = `${id}-${++counter.current}`;
            } while (items.some((item) => item.id === nextId));
            commit([...items, { id: nextId, value: createItem() }], nextId);
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
        aria-hidden="true"
        disabled={disabled || readOnly}
        form={form}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          setValidationShown(true);
          groupRef.current?.focus();
        }}
        ref={validationRef}
        style={{
          position: "absolute",
          opacity: 0,
          width: 1,
          height: 1,
          pointerEvents: "none",
        }}
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
