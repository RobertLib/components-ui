import { toISODate, toISOTime } from "../../../utils/date";
import { foldSearchText } from "../../../utils/remove-diacritics";
import { toNumber, toText } from "../data-table/query";
import {
  getOperatorArity,
  hasValue,
  isConditionComplete,
  isFilterGroup,
} from "./operators";
import type {
  FilterCondition,
  FilterField,
  FilterFieldType,
  FilterGroup,
  FilterNode,
  FilterRange,
} from "./types";

type Predicate<T> = (row: T) => boolean;

// `2026-09-24T22:30:00Z`, `2026-09-24T22:30+02:00` - a moment in another zone
const ZONED_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:?\d{2})$/i;

/** No value - also an empty text, an invalid date and an empty list. */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  if (value instanceof Date) return Number.isNaN(value.getTime());
  if (Array.isArray(value)) return value.every(isEmptyValue);
  return false;
}

/** The items of a value - a list is matched when one of its items is. */
const itemsOf = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [value];

/** A moment as local `YYYY-MM-DDTHH:mm` - `""` for an invalid one. */
const localDateTime = (date: Date) =>
  Number.isNaN(date.getTime()) ? "" : `${toISODate(date)}T${toISOTime(date)}`;

/**
 * A date value of a record as the local `YYYY-MM-DD…` text the conditions
 * compare - a `Date` and an ISO text with a time zone in the local time, a
 * timestamp as its moment, a day or a local time as it is written.
 */
function toDateText(value: unknown): string {
  if (value instanceof Date) return localDateTime(value);
  if (typeof value === "number") return localDateTime(new Date(value));
  if (typeof value === "string") {
    const text = value.trim();
    return ZONED_DATE_TIME.test(text) ? localDateTime(new Date(text)) : text;
  }
  return "";
}

/**
 * Compares a date text with a day or a moment by as many characters as it
 * has - a day compares only the day of a moment.
 */
const compareDate = (text: string, bound: string) => {
  const part = text.slice(0, bound.length);
  return part < bound ? -1 : part > bound ? 1 : 0;
};

/** A boolean value - also `"true"`, `1`, … - `null` for none. */
function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

/** A comparison of a value of a record with one of a condition. */
type Compare = (item: unknown, bound: string | number) => number | null;

/** The order of two numbers - `null` when one is not a number. */
const compareNumbers: Compare = (item, bound) => {
  const value = toNumber(item);
  const limit = toNumber(bound);
  if (value === null || limit === null) return null;
  return value < limit ? -1 : value > limit ? 1 : 0;
};

const compareDates: Compare = (item, bound) => {
  const text = toDateText(item);
  return text ? compareDate(text, String(bound)) : null;
};

/** Texts as the searches of the library compare them. */
const compareTexts: Compare = (item, bound) => {
  if (isEmptyValue(item)) return null;
  const text = foldSearchText(toText(item).trim());
  const limit = foldSearchText(String(bound).trim());
  return text < limit ? -1 : text > limit ? 1 : 0;
};

/** Values of a `select` - by their text, `1` is `"1"`. */
const compareExact: Compare = (item, bound) =>
  isEmptyValue(item) ? null : toText(item) === String(bound) ? 0 : 1;

const comparators: Record<FilterFieldType, Compare> = {
  boolean: (item, bound) => {
    const value = toBoolean(item);
    return value === null ? null : value === toBoolean(bound) ? 0 : 1;
  },
  custom: compareTexts,
  date: compareDates,
  datetime: compareDates,
  multiSelect: compareExact,
  number: (item, bound) =>
    compareNumbers(item, bound) ??
    // Numbers stored as other text compare as text
    compareTexts(item, bound),
  select: compareExact,
  text: compareTexts,
};

/** The single values of a condition - of a list, or the one. */
const valuesOf = (condition: FilterCondition) =>
  itemsOf(condition.value).filter(hasValue) as (string | number)[];

/** Whether the value of a record matches the positive form of a condition. */
function matchesPositive(
  value: unknown,
  condition: FilterCondition,
  type: FilterFieldType,
): boolean {
  const compare = comparators[type] ?? compareTexts;
  const items = itemsOf(value);
  const bound = condition.value as string | number | boolean;
  const some = (test: (item: unknown) => boolean) => items.some(test);
  const is = (item: unknown, limit: unknown, order: (n: number) => boolean) => {
    const result = compare(item, limit as string | number);
    return result !== null && order(result);
  };

  switch (condition.operator) {
    case "contains":
    case "notContains":
    case "startsWith":
    case "endsWith": {
      const term = foldSearchText(String(bound).trim());
      return some((item) => {
        if (isEmptyValue(item)) return false;
        const text = foldSearchText(toText(item));
        return condition.operator === "startsWith"
          ? text.trimStart().startsWith(term)
          : condition.operator === "endsWith"
            ? text.trimEnd().endsWith(term)
            : text.includes(term);
      });
    }
    case "equals":
    case "notEquals":
    case "on":
      return some((item) => is(item, bound, (order) => order === 0));
    case "in":
    case "notIn":
    case "hasAny":
    case "hasNone": {
      const values = valuesOf(condition);
      return some((item) =>
        values.some((limit) => is(item, limit, (order) => order === 0)),
      );
    }
    case "hasAll":
      return valuesOf(condition).every((limit) =>
        some((item) => is(item, limit, (order) => order === 0)),
      );
    case "greaterThan":
    case "after":
      return some((item) => is(item, bound, (order) => order > 0));
    case "greaterThanOrEqual":
    case "onOrAfter":
      return some((item) => is(item, bound, (order) => order >= 0));
    case "lessThan":
    case "before":
      return some((item) => is(item, bound, (order) => order < 0));
    case "lessThanOrEqual":
    case "onOrBefore":
      return some((item) => is(item, bound, (order) => order <= 0));
    case "between": {
      const { from, to } = (condition.value ?? {}) as FilterRange;
      return some(
        (item) =>
          (!hasValue(from) || is(item, from, (order) => order >= 0)) &&
          (!hasValue(to) || is(item, to, (order) => order <= 0)) &&
          !isEmptyValue(item),
      );
    }
    default:
      return false;
  }
}

const NEGATIVE = new Set(["notEquals", "notContains", "notIn", "hasNone"]);

/** Whether the value of a record matches a complete condition. */
function matchesCondition(
  value: unknown,
  condition: FilterCondition,
  type: FilterFieldType,
): boolean {
  if (getOperatorArity(condition.operator) === "none") {
    return isEmptyValue(value) === (condition.operator === "isEmpty");
  }
  const matches = matchesPositive(value, condition, type);
  return NEGATIVE.has(condition.operator) ? !matches : matches;
}

/**
 * The test of a node - `null` for one that does not filter: a condition
 * that is not complete, of an unknown field, or a group of only such.
 */
function compileNode<T>(
  node: FilterNode,
  fields: ReadonlyMap<string, FilterField<T>>,
): Predicate<T> | null {
  if (isFilterGroup(node)) {
    const tests = node.conditions
      .map((child) => compileNode(child, fields))
      .filter((test): test is Predicate<T> => test !== null);
    if (tests.length === 0) return null;
    return node.combinator === "or"
      ? (row) => tests.some((test) => test(row))
      : (row) => tests.every((test) => test(row));
  }

  const field = fields.get(node.field);
  if (!field || !isConditionComplete(node)) return null;

  const getValue =
    field.getValue ??
    ((row: T) =>
      row === null || row === undefined
        ? undefined
        : (row as Record<string, unknown>)[field.key]);

  return field.match
    ? (row) => field.match!(getValue(row), node, row)
    : (row) => matchesCondition(getValue(row), node, field.type);
}

// The tests of the filters matched last - a list of thousands of rows
// matches each with the same filter and fields
const compiled = new WeakMap<
  FilterGroup,
  WeakMap<readonly FilterField<never>[], Predicate<never>>
>();

/**
 * Whether a record matches a filter (the value of a `FilterBuilder`) - in
 * the browser, e.g. `rows.filter((row) => matchesFilter(row, filter,
 * fields))`. The value of a field is `row[key]` (or its `getValue`). Text
 * ignores case and accents, as the searches of the library do; a list of
 * the record matches when one of its items does (`hasAll`: when its items
 * include all the values). Conditions that are not complete yet, or of a
 * field not in `fields`, are left out - an empty filter matches every
 * record. Dates compare as local days and moments: `Date`s, ISO texts
 * (with a time zone in the local time) and timestamps.
 */
export function matchesFilter<T>(
  row: T,
  filter: FilterGroup | null | undefined,
  fields: readonly FilterField<T>[],
): boolean {
  if (!filter) return true;

  let byFields = compiled.get(filter);
  if (!byFields) {
    byFields = new WeakMap();
    compiled.set(filter, byFields);
  }

  let test = byFields.get(fields as readonly FilterField<never>[]) as
    Predicate<T> | undefined;
  if (!test) {
    const byKey = new Map(fields.map((field) => [field.key, field]));
    test = compileNode(filter, byKey) ?? (() => true);
    byFields.set(
      fields as readonly FilterField<never>[],
      test as Predicate<never>,
    );
  }

  return test(row);
}
