import type { AutocompleteItem, AutocompleteValue } from "../autocomplete";
import type {
  LoadOptionsParams,
  LoadOptionsResult,
} from "../autocomplete/load-options";

/**
 * The kind of value of a field - it decides the operators and the field
 * the value is entered in: `text` (`Input`), `number` (`NumberInput`),
 * `date` / `datetime` (`DateTimePicker`), `select` (one of the `options`),
 * `multiSelect` (a list of them, e.g. tags), `boolean` (Yes / No) or
 * `custom` (`render`).
 */
export type FilterFieldType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "multiSelect"
  | "boolean"
  | "custom";

/**
 * How a condition compares the value of a record:
 *
 * - `equals`, `notEquals` - is (not) the value; text ignores case and
 *   accents
 * - `contains`, `notContains`, `startsWith`, `endsWith` - text
 * - `isEmpty`, `isNotEmpty` - no value (`null`, `""`, an empty list) - they
 *   take none
 * - `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual` -
 *   numbers
 * - `between` - a range `{ from, to }`, both ends included; one end alone
 *   is "at least" / "at most"
 * - `in`, `notIn` - is (not) one of a list of values
 * - `on`, `before`, `after`, `onOrBefore`, `onOrAfter` - days (`YYYY-MM-DD`)
 *   and moments (`YYYY-MM-DDTHH:mm`); `on` takes a day also for a
 *   `datetime` field
 * - `hasAny`, `hasAll`, `hasNone` - a list of the record (`multiSelect`)
 *   has any, all or none of the values
 *
 * A negative operator (`notEquals`, `notContains`, `notIn`, `hasNone`)
 * matches every record the positive one does not - also one without a
 * value.
 */
export type FilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "between"
  | "in"
  | "notIn"
  | "on"
  | "before"
  | "after"
  | "onOrBefore"
  | "onOrAfter"
  | "hasAny"
  | "hasAll"
  | "hasNone";

/** The value of `between` - an end left out (`null`) is open. */
export interface FilterRange {
  /** The lower end, included. */
  from?: string | number | null;
  /** The upper end, included - a day includes all its times. */
  to?: string | number | null;
}

/**
 * The value of a condition - a text, a number, a day (`YYYY-MM-DD`), a
 * moment (`YYYY-MM-DDTHH:mm`), a boolean, a list of values (`in`, `hasAny`,
 * …) or a range (`between`). `null` (or none) for no value yet.
 */
export type FilterValue =
  string | number | boolean | (string | number)[] | FilterRange | null;

/** One condition of a filter - "Status is Paid". */
export interface FilterCondition {
  /** The `key` of the field it compares. */
  field: string;
  /**
   * Identifies the condition while it is edited - the builder gives each
   * condition it adds one. Left out by `compactFilter`.
   */
  id?: string;
  /** How it compares the value of the field. */
  operator: FilterOperator;
  /** The value it compares with - none for `isEmpty` / `isNotEmpty`. */
  value?: FilterValue;
}

/** How the conditions of a group are joined - all or any of them match. */
export type FilterCombinator = "and" | "or";

/**
 * Conditions - and groups of them - joined by `and` or `or`. The value of
 * the `FilterBuilder` is a group, JSON-serializable as it is - send it to
 * a server, or match records in the browser with `matchesFilter`.
 */
export interface FilterGroup {
  /** `and` - all of the conditions match, `or` - any of them. */
  combinator: FilterCombinator;
  /** The conditions and the nested groups, in their order. */
  conditions: FilterNode[];
  /**
   * Identifies the group while it is edited - the builder gives each group
   * it adds one. Left out by `compactFilter`.
   */
  id?: string;
}

/** A condition or a nested group. */
export type FilterNode = FilterCondition | FilterGroup;

/** One of the values a `select` or `multiSelect` field offers. */
export interface FilterFieldOption {
  /** The option cannot be picked. */
  disabled?: boolean;
  /** Text of the option. */
  label: string;
  /** The value - in the filter, and compared with the value of a record. */
  value: string | number;
}

/** What the `render` of a field gets. */
export interface FilterValueEditorProps {
  /** Accessible name of the field - "Value", "From", … of the locale. */
  "aria-label": string;
  /** The condition being edited. */
  condition: FilterCondition;
  /** Size of the fields of the builder. */
  dim: "xs" | "sm" | "md" | "lg";
  /** The builder is disabled. */
  disabled: boolean;
  /** The field of the condition. */
  field: FilterField<never>;
  /** Call it with the new value. */
  onChange: (value: FilterValue | undefined) => void;
  /** The operator of the condition. */
  operator: FilterOperator;
  /** The value of the condition - `undefined` for none yet. */
  value: FilterValue | undefined;
}

/** A field the conditions of a filter can compare. */
export interface FilterField<T = unknown> {
  /**
   * Formats a value of the field for `describeFilter` - a single value, an
   * item of a list or an end of a range. By default the label of an option,
   * a number, day or moment by the locale, a text in quotes.
   */
  formatValue?: (value: string | number | boolean) => string;
  /**
   * `matchesFilter`: the value of the field in a record - `row[key]` by
   * default.
   */
  getValue?: (row: T) => unknown;
  /**
   * A heading the field is listed under in the field select, e.g.
   * "Customer" - fields of a heading are best given one after another.
   */
  group?: string;
  /** Key of the field - in the conditions, and of the record. */
  key: string;
  /** Name of the field, e.g. "Invoice number". */
  label: string;
  /**
   * `select` / `multiSelect`: loads the options from an API instead of
   * `options` - the `loadOptions` of `Autocomplete`, called with the typed
   * term. Its items need a `label` and a `value` (or `name` / `id`).
   * `describeFilter` knows no labels of loaded options - give the field a
   * `formatValue` to write them.
   */
  loadOptions?: (
    params: LoadOptionsParams,
  ) => Promise<LoadOptionsResult<AutocompleteItem>>;
  /**
   * With `loadOptions`: loads the items of the values of a filter given
   * before (`defaultValue`), so their labels show - the
   * `loadSelectedOptions` of `Autocomplete`.
   */
  loadSelectedOptions?: (
    values: AutocompleteValue[],
    params: { signal: AbortSignal },
  ) => Promise<AutocompleteItem[]>;
  /**
   * `matchesFilter`: decides whether the value of a record matches a
   * condition - replaces the default comparison, e.g. for a `custom` field.
   */
  match?: (value: unknown, condition: FilterCondition, row: T) => boolean;
  /**
   * The operators offered, in their order - the first is the operator of a
   * new condition. By default the operators of the `type`.
   */
  operators?: FilterOperator[];
  /** `select` / `multiSelect`: the values offered. */
  options?: FilterFieldOption[];
  /** Placeholder of the value field. */
  placeholder?: string;
  /**
   * Renders the value field of a condition - for a `custom` field, or in
   * place of the built-in one of another type. Called for each field of a
   * range (`between`).
   */
  render?: (props: FilterValueEditorProps) => React.ReactNode;
  /** The kind of value - see `FilterFieldType`. */
  type: FilterFieldType;
}
