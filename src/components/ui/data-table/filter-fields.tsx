import { ChevronDown } from "lucide-react";
import { useId } from "react";
import CheckboxGroup from "../checkbox-group";
import cn from "../../../utils/cn";
import DateRangePicker from "../date-range-picker";
import Input from "../input";
import NumberInput from "../number-input";
import Popover from "../popover";
import useDebouncedField from "./use-debounced-field";
import { isEscapeKey } from "../overlay-stack";
import type { DataTableRangeFilter } from "./query";

interface FilterInputProps {
  /** Accessible name of the field. */
  label: string;
  /** Called with the typed text once typing pauses. */
  onChange: (value: string) => void;
  /** Placeholder of the empty field. */
  placeholder: string;
  /** Changes when the filters are cleared - a text on its way is dropped. */
  resetKey: number;
  /** The filter value of the query. */
  value: string;
}

/** A text filter that updates the query once typing pauses. */
export function FilterInput({
  label,
  onChange,
  placeholder,
  resetKey,
  value,
}: FilterInputProps) {
  const field = useDebouncedField(value, onChange, undefined, resetKey);

  return (
    <Input
      aria-label={label}
      dim="sm"
      onChange={({ target }) => field.change(target.value)}
      onKeyDown={(event) => {
        // Escape empties the field - by the field alone, not also leaving
        // the full screen or a dialog around the table, which take a key
        // no one used, and alike in all browsers (not all clear a search
        // field). An empty field leaves the key to them, and so does an
        // input method whose composition the key ends.
        if (isEscapeKey(event.nativeEvent) && field.value) {
          event.preventDefault();
          field.commitNow("");
        }
      }}
      placeholder={placeholder}
      type="search"
      value={field.value}
    />
  );
}

interface MultiSelectFilterProps {
  /** Accessible name of the field and of its panel. */
  label: string;
  /** Called with the picked values - `[]` for none. */
  onChange: (values: string[]) => void;
  /** The choices. */
  options: { label: string; value: string | number }[];
  /** Shown while nothing is picked. */
  placeholder: string;
  /** The picked values. */
  value: string[];
}

/**
 * A filter of several options - a field showing the picked ones that opens
 * a panel of checkboxes. As high as the other filter fields.
 */
export function MultiSelectFilter({
  label,
  onChange,
  options,
  placeholder,
  value,
}: MultiSelectFilterProps) {
  const valueId = useId();
  // Values of no option (from a URL) show as they are
  const text = value
    .map(
      (item) =>
        options.find((option) => String(option.value) === item)?.label ?? item,
    )
    .join(", ");

  return (
    <Popover
      buttonTrigger
      contentClassName="p-2"
      contentLabel={label}
      position="bottom"
      trigger={
        <button
          aria-describedby={text ? valueId : undefined}
          aria-label={label}
          className="flex form-control cursor-pointer items-center gap-1 px-1 py-0 text-start text-sm"
          title={text || undefined}
          type="button"
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              !text && "text-neutral-500 dark:text-neutral-400",
            )}
            id={valueId}
          >
            {text || placeholder}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="shrink-0 text-neutral-500 dark:text-neutral-400"
            size={14}
          />
        </button>
      }
      triggerType="click"
      width="auto"
    >
      <CheckboxGroup
        aria-label={label}
        className="min-w-32"
        dim="sm"
        onChange={(values) => onChange(values.map(String))}
        options={options.map((option) => ({
          label: option.label,
          value: String(option.value),
        }))}
        value={value}
      />
    </Popover>
  );
}

interface NumberRangeFilterProps {
  /** Accessible name of the first field. */
  fromLabel: string;
  /** Called with the range once typing pauses. */
  onChange: (value: DataTableRangeFilter) => void;
  /** Changes when the filters are cleared - numbers on their way are dropped. */
  resetKey: number;
  /** Accessible name of the second field. */
  toLabel: string;
  /** The range of the query. */
  value: DataTableRangeFilter;
}

/** The bounds as one text - what the debounced field keeps. */
const encodeBounds = (from = "", to = "") => JSON.stringify([from, to]);

const decodeBounds = (text: string) => {
  const [from = "", to = ""] = JSON.parse(text) as string[];
  return { from, to };
};

/** A number of a bound - `null` for none, also for one that is no number. */
const toBoundNumber = (text: string) => {
  const number = text === "" ? null : Number(text);
  return number !== null && Number.isFinite(number) ? number : null;
};

/**
 * Two number fields, from and to - the query follows once typing pauses,
 * like a text filter. An empty field leaves its side of the range open.
 */
export function NumberRangeFilter({
  fromLabel,
  onChange,
  resetKey,
  toLabel,
  value,
}: NumberRangeFilterProps) {
  const field = useDebouncedField(
    encodeBounds(value.from, value.to),
    (next) => onChange(decodeBounds(next)),
    undefined,
    resetKey,
  );
  const { from, to } = decodeBounds(field.value);

  const change = (bound: "from" | "to", number: number | null) => {
    const text = number === null ? "" : String(number);
    field.change(
      bound === "from" ? encodeBounds(text, to) : encodeBounds(from, text),
    );
  };

  return (
    <div className="flex items-center gap-1">
      <div className="min-w-14 flex-1">
        <NumberInput
          aria-label={fromLabel}
          dim="sm"
          hideStepper
          onChange={(number) => change("from", number)}
          value={toBoundNumber(from)}
        />
      </div>
      <span
        aria-hidden="true"
        className="text-neutral-500 dark:text-neutral-400"
      >
        –
      </span>
      <div className="min-w-14 flex-1">
        <NumberInput
          aria-label={toLabel}
          dim="sm"
          hideStepper
          onChange={(number) => change("to", number)}
          value={toBoundNumber(to)}
        />
      </div>
    </div>
  );
}

interface DateRangeFilterProps {
  /** Accessible name of the field. */
  label: string;
  /** Called with the picked range - `null` when it is cleared. */
  onChange: (value: DataTableRangeFilter | null) => void;
  /** The range of the query. */
  value: DataTableRangeFilter;
}

/**
 * A range of days - a range open on one side (from a URL) shows no days,
 * but filters.
 */
export function DateRangeFilter({
  label,
  onChange,
  value,
}: DateRangeFilterProps) {
  return (
    <DateRangePicker
      aria-label={label}
      dim="sm"
      onChange={(range) =>
        onChange(range ? { from: range.start, to: range.end } : null)
      }
      value={
        value.from && value.to ? { end: value.to, start: value.from } : null
      }
    />
  );
}
