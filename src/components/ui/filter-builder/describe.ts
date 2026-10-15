import { en } from "../../../i18n/ui/en";
import { formatMessage, formatNumber } from "../../../i18n/ui/format";
import type { Locale } from "../../../i18n/ui/types";
import { formatPattern, getDayPeriods, isValidDay } from "../../../utils/date";
import {
  getOperatorArity,
  hasValue,
  isConditionComplete,
  isFilterGroup,
} from "./operators";
import type {
  FilterCondition,
  FilterField,
  FilterGroup,
  FilterNode,
  FilterRange,
} from "./types";

// `2026-10-15`, `2026-10-15T14:30` - the values of the date pickers
const PICKER_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/** A day or a moment of a picker as the locale writes it - else `null`. */
function formatPickerDate(value: string, locale: Locale) {
  const match = PICKER_DATE.exec(value);
  if (!match) return null;

  const [, year, month, day, hours, minutes] = match.map(Number);
  if (!isValidDay(year, month, day)) return null;

  const hasTime = match[4] !== undefined;
  return formatPattern(
    hasTime ? locale.formats.dateTime : locale.formats.date,
    { day, hours, minutes, month, year },
    getDayPeriods(locale.code),
  );
}

/** A single value of a condition as the summary writes it. */
export function formatFilterValue(
  value: string | number | boolean,
  field: FilterField<never>,
  locale: Locale,
): string {
  if (field.formatValue) return field.formatValue(value);

  const messages = locale.messages.ui;
  if (typeof value === "boolean") {
    return value ? messages.common.yes : messages.common.no;
  }

  const option = field.options?.find(
    (candidate) => String(candidate.value) === String(value),
  );
  if (option) return option.label;

  switch (field.type) {
    case "number": {
      const number = typeof value === "number" ? value : Number(value);
      return Number.isFinite(number)
        ? formatNumber(locale.code, number)
        : String(value);
    }
    case "date":
    case "datetime":
      return formatPickerDate(String(value), locale) ?? String(value);
    case "select":
    case "multiSelect":
      return String(value);
    default:
      return formatMessage(messages.filterBuilder.quoted, {
        value: String(value),
      });
  }
}

/** A condition as words - `null` for one that does not filter. */
function describeCondition(
  condition: FilterCondition,
  fields: ReadonlyMap<string, FilterField<never>>,
  locale: Locale,
) {
  const field = fields.get(condition.field);
  if (!field || !isConditionComplete(condition)) return null;

  const messages = locale.messages.ui.filterBuilder;
  const write = (value: string | number | boolean) =>
    formatFilterValue(value, field, locale);
  const { operator } = condition;

  switch (getOperatorArity(operator)) {
    case "none":
      return `${field.label} ${messages.operators[operator]}`;
    case "list": {
      const values = (condition.value as (string | number)[]).filter(hasValue);
      return `${field.label} ${messages.operators[operator]} ${values
        .map(write)
        .join(", ")}`;
    }
    case "range": {
      const { from, to } = condition.value as FilterRange;
      const isDate = field.type === "date" || field.type === "datetime";
      if (hasValue(from) && hasValue(to)) {
        return `${field.label} ${messages.operators.between} ${formatMessage(
          messages.range,
          { from: write(from!), to: write(to!) },
        )}`;
      }
      // One end alone - at least, or at most
      return hasValue(from)
        ? `${field.label} ${
            messages.operators[isDate ? "onOrAfter" : "greaterThanOrEqual"]
          } ${write(from!)}`
        : `${field.label} ${
            messages.operators[isDate ? "onOrBefore" : "lessThanOrEqual"]
          } ${write(to!)}`;
    }
    default:
      return `${field.label} ${messages.operators[operator]} ${write(
        condition.value as string | number | boolean,
      )}`;
  }
}

/** A node as words - a nested group of several in parentheses. */
function describeNode(
  node: FilterNode,
  fields: ReadonlyMap<string, FilterField<never>>,
  locale: Locale,
  nested: boolean,
): string | null {
  if (!isFilterGroup(node)) return describeCondition(node, fields, locale);

  const parts = node.conditions
    .map((child) => describeNode(child, fields, locale, true))
    .filter((part): part is string => !!part);
  if (parts.length === 0) return null;

  const messages = locale.messages.ui.filterBuilder;
  const joined = parts.join(
    ` ${node.combinator === "or" ? messages.wordOr : messages.wordAnd} `,
  );
  return nested && parts.length > 1 ? `(${joined})` : joined;
}

/**
 * A filter (the value of a `FilterBuilder`) as a sentence of the language
 * of `locale` - e.g. "Status is Paid and (Total at least 10,000 or
 * Customer contains “Acme”)", for a summary of the filter applied or a
 * saved filter. Values are written by the locale: the labels of options,
 * numbers, days and moments - or by the `formatValue` of their field.
 * Conditions that are not complete, or of a field not in `fields`, are
 * left out; `""` for a filter without any.
 */
export function describeFilter<T>(
  filter: FilterGroup | null | undefined,
  fields: readonly FilterField<T>[],
  locale: Locale = en,
): string {
  if (!filter) return "";
  const byKey = new Map(
    fields.map((field) => [field.key, field as FilterField<never>]),
  );
  return describeNode(filter, byKey, locale, false) ?? "";
}
