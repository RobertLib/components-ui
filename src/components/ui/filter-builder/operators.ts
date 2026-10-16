import type {
  FilterCondition,
  FilterField,
  FilterFieldType,
  FilterGroup,
  FilterNode,
  FilterOperator,
  FilterRange,
  FilterValue,
} from "./types";

/** The operators of each type of field, the first for a new condition. */
export const DEFAULT_OPERATORS: Readonly<
  Record<FilterFieldType, readonly FilterOperator[]>
> = {
  boolean: ["equals"],
  custom: ["equals", "notEquals", "isEmpty", "isNotEmpty"],
  date: [
    "on",
    "before",
    "after",
    "onOrBefore",
    "onOrAfter",
    "between",
    "isEmpty",
    "isNotEmpty",
  ],
  datetime: ["on", "before", "after", "between", "isEmpty", "isNotEmpty"],
  multiSelect: ["hasAny", "hasAll", "hasNone", "isEmpty", "isNotEmpty"],
  number: [
    "equals",
    "notEquals",
    "greaterThan",
    "greaterThanOrEqual",
    "lessThan",
    "lessThanOrEqual",
    "between",
    "isEmpty",
    "isNotEmpty",
  ],
  select: ["equals", "notEquals", "in", "notIn", "isEmpty", "isNotEmpty"],
  text: [
    "contains",
    "notContains",
    "equals",
    "notEquals",
    "startsWith",
    "endsWith",
    "isEmpty",
    "isNotEmpty",
  ],
};

/**
 * What an operator takes: no value, one, a list of them or a range.
 */
export type OperatorArity = "none" | "single" | "list" | "range";

export function getOperatorArity(operator: FilterOperator): OperatorArity {
  switch (operator) {
    case "isEmpty":
    case "isNotEmpty":
      return "none";
    case "between":
      return "range";
    case "in":
    case "notIn":
    case "hasAny":
    case "hasAll":
    case "hasNone":
      return "list";
    default:
      return "single";
  }
}

/** The operators a field offers - its own or those of its type. */
export const getFieldOperators = (
  field: Pick<FilterField<never>, "operators" | "type">,
): readonly FilterOperator[] =>
  field.operators?.length
    ? field.operators
    : (DEFAULT_OPERATORS[field.type] ?? DEFAULT_OPERATORS.text);

/** Whether a node of a filter is a group (else a condition). */
export const isFilterGroup = (node: FilterNode): node is FilterGroup =>
  typeof node === "object" &&
  node !== null &&
  Array.isArray((node as FilterGroup).conditions);

/** Whether a single value is there - `false` and `0` are values. */
export const hasValue = (value: unknown) =>
  value !== undefined &&
  value !== null &&
  !(typeof value === "string" && value.trim() === "") &&
  !(typeof value === "number" && Number.isNaN(value));

const isRange = (value: unknown): value is FilterRange =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether a condition has all it needs to filter - a value for its
 * operator. One that has not is left out of `matchesFilter`,
 * `describeFilter` and `compactFilter`.
 */
export function isConditionComplete(condition: FilterCondition) {
  const { value } = condition;

  switch (getOperatorArity(condition.operator)) {
    case "none":
      return true;
    case "list":
      return Array.isArray(value) && value.some(hasValue);
    case "range":
      return isRange(value) && (hasValue(value.from) || hasValue(value.to));
    default:
      return !Array.isArray(value) && !isRange(value) && hasValue(value);
  }
}

/** A day of a moment (`YYYY-MM-DDTHH:mm` → `YYYY-MM-DD`), the rest as it is. */
const toDay = (value: string | number) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)
    ? value.slice(0, 10)
    : value;

/** A moment of a day (`YYYY-MM-DD` → `YYYY-MM-DDT00:00`), the rest as it is. */
const toMoment = (value: string | number) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00`
    : value;

/**
 * The value of a condition carried over to another operator - one value
 * becomes a list of it or the start of a range and back, a moment the day
 * of `on` (`datetime`) and back. `undefined` when nothing carries over.
 */
export function convertValue(
  value: FilterValue | undefined,
  from: FilterOperator,
  to: FilterOperator,
  type: FilterFieldType,
): FilterValue | undefined {
  const target = getOperatorArity(to);
  if (target === "none" || value === undefined || value === null) {
    return undefined;
  }

  // The single values of the old operator
  let values: (string | number | boolean)[];
  switch (getOperatorArity(from)) {
    case "list":
      values = Array.isArray(value) ? value : [];
      break;
    case "range":
      values = isRange(value)
        ? [value.from, value.to].filter(
            (end): end is string | number => end !== undefined && end !== null,
          )
        : [];
      break;
    case "none":
      values = [];
      break;
    default:
      values = Array.isArray(value) || isRange(value) ? [] : [value as string];
  }

  // A `datetime` field takes a day for `on`, a moment otherwise
  const adapt = (item: string | number) =>
    type !== "datetime" ? item : to === "on" ? toDay(item) : toMoment(item);

  const scalar = values.filter(
    (item): item is string | number => typeof item !== "boolean",
  );

  switch (target) {
    case "list":
      return scalar.length ? scalar.map(adapt) : undefined;
    case "range":
      return getOperatorArity(from) === "range" && isRange(value)
        ? {
            from: hasValue(value.from) ? adapt(value.from!) : value.from,
            to: hasValue(value.to) ? adapt(value.to!) : value.to,
          }
        : scalar.length
          ? { from: adapt(scalar[0]) }
          : undefined;
    default:
      if (values.length === 0) return undefined;
      return typeof values[0] === "boolean" ? values[0] : adapt(values[0]);
  }
}

/** A value without the empty items of a list and empty ends of a range. */
function compactValue(value: FilterValue | undefined): FilterValue | undefined {
  if (Array.isArray(value)) return value.filter(hasValue);
  if (!isRange(value)) return value;
  const range: FilterRange = {};
  if (hasValue(value.from)) range.from = value.from;
  if (hasValue(value.to)) range.to = value.to;
  return range;
}

/** Removes what `compactFilter` leaves out of a group, `null` for nothing. */
function compactGroup(
  group: FilterGroup,
  fields: ReadonlyMap<string, FilterField<never>> | null,
): FilterGroup | null {
  const conditions: FilterNode[] = [];

  for (const node of group.conditions) {
    if (isFilterGroup(node)) {
      const nested = compactGroup(node, fields);
      if (nested) conditions.push(nested);
    } else if (
      isConditionComplete(node) &&
      (!fields || fields.has(node.field))
    ) {
      const condition: FilterCondition = {
        field: node.field,
        operator: node.operator,
      };
      if (getOperatorArity(node.operator) !== "none") {
        condition.value = compactValue(node.value);
      }
      conditions.push(condition);
    }
  }

  return conditions.length
    ? { combinator: group.combinator === "or" ? "or" : "and", conditions }
    : null;
}

/**
 * The filter as a server wants it: without the conditions that are not
 * complete yet (no value), the empty items of lists and ends of ranges,
 * the groups left empty and the `id`s of the builder - and, with `fields`,
 * without the conditions of fields not among them (e.g. of an old saved
 * filter). Always a group, with no conditions for none.
 */
export function compactFilter<T>(
  filter: FilterGroup | null | undefined,
  fields?: readonly FilterField<T>[],
): FilterGroup {
  const byKey = fields
    ? new Map(fields.map((field) => [field.key, field as FilterField<never>]))
    : null;
  const compacted = filter ? compactGroup(filter, byKey) : null;

  return compacted ?? { combinator: "and", conditions: [] };
}
