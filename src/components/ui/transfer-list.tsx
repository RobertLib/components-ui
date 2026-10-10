import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import useCustomValidity from "../../hooks/use-custom-validity";
import cn, { joinTokens } from "../../utils/cn";
import { foldSearchText } from "../../utils/remove-diacritics";
import {
  attachRef,
  isAriaInvalid,
  useFieldsetDisabled,
  useFormReset,
} from "../../hooks/use-form-control";
import { formatPlural } from "../../i18n/ui/format";
import { useLocale } from "../../providers/ui-context";
import Input from "./input";
import { getActiveElement } from "./overlay-stack";
import Checkbox from "./checkbox";
import IconButton from "./icon-button";
import FormDescription from "./form-description";
import FormError from "./form-error";
import RequiredMark from "./required-mark";

export type TransferListValue = string | number;

export interface TransferListOption {
  /** Stable submitted value; numeric and string values are distinct. */
  value: TransferListValue;
  /** Label displayed and searched. */
  label: string;
  /** Optional explanation under the label. */
  description?: React.ReactNode;
  /** This option cannot be moved between the lists. */
  disabled?: boolean;
}

export interface TransferListProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "defaultValue" | "onChange" | "ref"
> {
  /** All choices, in available-list order. */
  options: readonly TransferListOption[];
  /** Controlled values in the selected list. */
  value?: readonly TransferListValue[];
  /** Initial selected values; followed until the user transfers items. */
  defaultValue?: readonly TransferListValue[];
  /** Values after a transfer, retaining items hidden by a search. */
  onChange?: (values: TransferListValue[]) => void;
  /** Label of the complete field. */
  label?: React.ReactNode;
  /** Label above the available list. Defaults to the localized text. */
  availableLabel?: React.ReactNode;
  /** Label above the selected list. Defaults to the localized text. */
  selectedLabel?: React.ReactNode;
  /** Help text under the lists. */
  description?: React.ReactNode;
  /** Size of the searches, checkboxes and transfer buttons. Defaults to md. */
  dim?: "xs" | "sm" | "md" | "lg";
  /** Validation message, also marking the field invalid. */
  error?: string;
  /** Disable interaction, validation and submission. */
  disabled?: boolean;
  /** Show and submit the values, with no transfers allowed. */
  readOnly?: boolean;
  /** One hidden input per selected value. An empty list submits an empty value. */
  name?: string;
  /** Form id, including when the field is outside the form. */
  form?: string;
  /** At least one selected value is required. */
  required?: boolean;
  /** Minimum selected values, checked on native form submission. */
  min?: number;
  /** Maximum selected values. A transfer stops at this limit. */
  max?: number;
  /** Show independent searches above the lists. Defaults to true. */
  searchable?: boolean;
  /** The outer group; validation errors focus its first enabled control. */
  ref?: React.Ref<HTMLDivElement>;
}

const valueKey = (value: TransferListValue) => `${typeof value}:${value}`;
const uniqueOptions = (options: readonly TransferListOption[]) => [
  ...new Map(options.map((option) => [option.value, option])).values(),
];

/** Two searchable lists for assigning choices, with native checkboxes and form values. */
export default function TransferList({
  availableLabel,
  className,
  defaultValue = [],
  description,
  dim = "md",
  disabled: disabledProp,
  error,
  form,
  id,
  label,
  max,
  min = 0,
  name,
  onChange,
  options,
  readOnly = false,
  ref,
  required = false,
  searchable = true,
  selectedLabel,
  value,
  ...props
}: TransferListProps) {
  const locale = useLocale();
  const messages = locale.messages.ui.transferList;
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const [fieldsetDisabled, fieldsetRef] = useFieldsetDisabled();
  const disabled = !!disabledProp || fieldsetDisabled;
  const canChange = !disabled && !readOnly;
  const [picked, setPicked] = useState<TransferListValue[]>();
  const [validationShown, setValidationShown] = useState(false);
  const values = [...new Set(value ?? picked ?? defaultValue)];
  const chosen = new Set(values);
  const choices = uniqueOptions(options);
  const byValue = new Map(choices.map((option) => [option.value, option]));
  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");
  const [markedAvailable, setMarkedAvailable] = useState<
    ReadonlySet<TransferListValue>
  >(() => new Set());
  const [markedSelected, setMarkedSelected] = useState<
    ReadonlySet<TransferListValue>
  >(() => new Set());
  // Spaces around the term are no part of it - a phone keyboard adds one
  // after a word it completes
  const matches = (option: TransferListOption, search: string) =>
    foldSearchText(option.label).includes(foldSearchText(search.trim()));
  const available = choices.filter(
    (option) => !chosen.has(option.value) && matches(option, availableSearch),
  );
  const selected = values
    .map((value) => byValue.get(value) ?? { value, label: String(value) })
    .filter((option) => matches(option, selectedSearch));
  const eligibleAvailable = available.filter((option) => !option.disabled);
  const eligibleSelected = selected.filter((option) => !option.disabled);
  const minimum = Math.max(
    required ? 1 : 0,
    Number.isFinite(min) ? Math.max(0, Math.floor(min)) : 0,
  );
  const maximum =
    max !== undefined && Number.isFinite(max)
      ? Math.max(0, Math.floor(max))
      : Infinity;
  const validationMessage =
    disabled || readOnly
      ? ""
      : values.length < minimum
        ? formatPlural(locale.code, messages.minimum, minimum)
        : values.length > maximum
          ? formatPlural(locale.code, messages.maximum, maximum)
          : "";
  const shownError = error || (validationShown ? validationMessage : "");
  const validationRef = useRef<HTMLInputElement | null>(null);
  useCustomValidity(validationRef, validationMessage);
  const resetRef = useFormReset(() => {
    setPicked(undefined);
    setValidationShown(false);
    setMarkedAvailable(new Set());
    setMarkedSelected(new Set());
    setAvailableSearch("");
    setSelectedSearch("");
  }, form);
  const commit = (next: TransferListValue[]) => {
    if (!canChange) return;
    // The hidden inputs hold the values before `onChange`, which may submit
    // the form. A controlled parent can only render them after `onChange`.
    flushSync(() => {
      if (value === undefined) setPicked(next);
      setMarkedAvailable(new Set());
      setMarkedSelected(new Set());
    });
    onChange?.(next);
  };
  const add = (all: boolean) => {
    const added = eligibleAvailable
      .filter((option) => all || markedAvailable.has(option.value))
      .slice(0, Math.max(0, maximum - values.length));
    if (added.length)
      commit([...values, ...added.map((option) => option.value)]);
  };
  const remove = (all: boolean) => {
    const removed = new Set(
      eligibleSelected
        .filter((option) => all || markedSelected.has(option.value))
        .map((option) => option.value),
    );
    if (removed.size) commit(values.filter((value) => !removed.has(value)));
  };
  // The focus goes from the validation input to the first control
  const focusControl = (validationInput: HTMLElement) => {
    const group = validationInput.parentElement;
    const controls = group?.querySelectorAll<HTMLElement>(
      "input:not(:disabled):not([type=hidden]),button:not(:disabled):not([aria-disabled=true])",
    );
    (
      [...(controls ?? [])].find((control) => control !== validationInput) ??
      group
    )?.focus();
  };
  // A button with nothing to transfer - `aria-disabled` keeps the focus of
  // the button just pressed, which a native `disabled` would drop to the
  // page. A field that takes no changes disables them.
  const transferButtonProps = (canTransfer: boolean) => ({
    "aria-disabled": canChange && !canTransfer ? true : undefined,
    className: "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    disabled: !canChange,
    size:
      dim === "xs" || dim === "sm"
        ? ("sm" as const)
        : dim === "lg"
          ? ("lg" as const)
          : ("md" as const),
  });
  const list = (
    side: "available" | "selected",
    items: TransferListOption[],
    title: React.ReactNode,
    search: string,
    setSearch: (search: string) => void,
    marked: ReadonlySet<TransferListValue>,
    setMarked: (values: ReadonlySet<TransferListValue>) => void,
  ) => {
    const eligible = items.filter((option) => !option.disabled);
    const checked =
      eligible.length > 0 &&
      eligible.every((option) => marked.has(option.value));
    const partial =
      !checked && eligible.some((option) => marked.has(option.value));
    return (
      <fieldset
        className="min-w-0 flex-1 rounded border border-neutral-200 p-3 dark:border-neutral-700"
        disabled={!canChange}
      >
        <legend className="px-1 text-sm font-medium">
          {title} <span className="text-neutral-500">({items.length})</span>
        </legend>
        {searchable && (
          <Input
            dim={dim}
            aria-label={
              side === "available"
                ? messages.searchAvailable
                : messages.searchSelected
            }
            className="mb-2"
            onChange={(event) => setSearch(event.target.value)}
            // It filters as it is typed - Enter submits no form from here
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
              }
            }}
            type="search"
            value={search}
          />
        )}
        <Checkbox
          dim={dim}
          disabled={eligible.length === 0}
          indeterminate={partial}
          checked={checked}
          label={messages.selectVisible}
          onChange={() => {
            const next = new Set(marked);
            eligible.forEach((option) =>
              checked ? next.delete(option.value) : next.add(option.value),
            );
            setMarked(next);
          }}
        />
        <ul
          aria-label={
            side === "available" ? messages.available : messages.selected
          }
          className="mt-2 max-h-64 min-h-32 overflow-auto"
          tabIndex={disabled ? undefined : 0}
        >
          {items.length === 0 && (
            <li className="py-4 text-center text-sm text-neutral-500">
              {messages.noItems}
            </li>
          )}
          {items.map((option) => (
            <li className="py-1" key={valueKey(option.value)}>
              <Checkbox
                dim={dim}
                checked={marked.has(option.value)}
                description={option.description}
                disabled={option.disabled}
                label={option.label}
                onChange={() => {
                  const next = new Set(marked);
                  if (next.has(option.value)) next.delete(option.value);
                  else next.add(option.value);
                  setMarked(next);
                }}
              />
            </li>
          ))}
        </ul>
      </fieldset>
    );
  };
  return (
    <div
      {...props}
      aria-describedby={joinTokens(
        shownError ? `${groupId}-error` : undefined,
        description ? `${groupId}-description` : undefined,
        props["aria-describedby"],
      )}
      aria-invalid={shownError ? "true" : props["aria-invalid"]}
      aria-labelledby={label ? `${groupId}-label` : props["aria-labelledby"]}
      className={cn("flex flex-col gap-2", className)}
      data-invalid={
        shownError || validationMessage || isAriaInvalid(props["aria-invalid"])
          ? ""
          : undefined
      }
      data-disabled={disabled ? "" : undefined}
      data-readonly={readOnly ? "" : undefined}
      id={groupId}
      tabIndex={props.tabIndex ?? -1}
      ref={(element) => {
        const detachFieldset = fieldsetRef(element);
        const detachReset = resetRef(element);
        const detach = attachRef(ref, element);
        return () => {
          detachFieldset?.();
          detachReset?.();
          detach?.();
        };
      }}
      role="group"
    >
      {label && (
        <div className="text-sm font-medium" id={`${groupId}-label`}>
          {label}
          {required && (
            <>
              {" "}
              <RequiredMark />
            </>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        {list(
          "available",
          available,
          availableLabel ?? messages.available,
          availableSearch,
          setAvailableSearch,
          markedAvailable,
          setMarkedAvailable,
        )}
        <div className="flex items-center justify-center gap-2 sm:flex-col">
          <IconButton
            {...transferButtonProps(
              values.length < maximum &&
                eligibleAvailable.some((option) =>
                  markedAvailable.has(option.value),
                ),
            )}
            aria-label={messages.addSelected}
            onClick={() => add(false)}
          >
            <ArrowRight
              className="rotate-90 sm:rotate-0 sm:rtl:rotate-180"
              size={18}
            />
          </IconButton>
          <IconButton
            {...transferButtonProps(
              values.length < maximum && eligibleAvailable.length > 0,
            )}
            aria-label={messages.addAll}
            onClick={() => add(true)}
          >
            <ChevronsRight
              className="rotate-90 sm:rotate-0 sm:rtl:rotate-180"
              size={18}
            />
          </IconButton>
          <IconButton
            {...transferButtonProps(
              eligibleSelected.some((option) =>
                markedSelected.has(option.value),
              ),
            )}
            aria-label={messages.removeSelected}
            onClick={() => remove(false)}
          >
            <ArrowLeft
              className="rotate-90 sm:rotate-0 sm:rtl:rotate-180"
              size={18}
            />
          </IconButton>
          <IconButton
            {...transferButtonProps(eligibleSelected.length > 0)}
            aria-label={messages.removeAll}
            onClick={() => remove(true)}
          >
            <ChevronsLeft
              className="rotate-90 sm:rotate-0 sm:rtl:rotate-180"
              size={18}
            />
          </IconButton>
        </div>
        {list(
          "selected",
          selected,
          selectedLabel ?? messages.selected,
          selectedSearch,
          setSelectedSearch,
          markedSelected,
          setMarkedSelected,
        )}
      </div>
      {values.length ? (
        values.map((value) => (
          <input
            disabled={disabled}
            form={form}
            key={valueKey(value)}
            name={name}
            type="hidden"
            value={value}
          />
        ))
      ) : (
        <input
          disabled={disabled}
          form={form}
          name={name}
          type="hidden"
          value=""
        />
      )}
      <input
        disabled={disabled || readOnly}
        form={form}
        // Neither focusable nor seen by assistive technology - until the
        // browser reports it invalid (a submit, `reportValidity()`), then
        // it can take the focus the browser gives it
        inert
        onChange={() => {}}
        // The browser focuses it for a submit or `reportValidity()` only -
        // not for a `checkValidity()` of the page, which must neither take
        // the focus from the field the user is in nor show the error. The
        // focus moves on once the browser is done focusing it: moved at
        // once, Firefox would not focus it at the next submit again.
        onFocus={(event) => {
          const validationInput = event.currentTarget;
          setValidationShown(true);
          queueMicrotask(() => {
            if (
              getActiveElement(validationInput.ownerDocument) ===
              validationInput
            ) {
              focusControl(validationInput);
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
        required={minimum > 0}
        style={{
          position: "absolute",
          opacity: 0,
          width: 1,
          height: 1,
          pointerEvents: "none",
        }}
        tabIndex={-1}
        value={values.length ? "selected" : ""}
      />
      {description && (
        <FormDescription id={`${groupId}-description`}>
          {description}
        </FormDescription>
      )}
      {shownError && (
        <FormError id={`${groupId}-error`}>{shownError}</FormError>
      )}
    </div>
  );
}
