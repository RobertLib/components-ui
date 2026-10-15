import { formatDate, getDayPeriods, parseISODate } from "../../../utils/date";
import { formatMessage, formatNumber } from "../../../i18n/ui/format";
import { toNumber, type DataTableFilterValue } from "./query";
import type { Column } from "./types";
import type { Locale } from "../../../i18n/ui/types";

const TIME = /^(\d{1,2}):(\d{2})/;
const DAY_TIME = /T(\d{1,2}):(\d{2})/;

/**
 * A day (`2026-09-24`), a moment (`2026-09-24T10:30`) or a time (`10:30`)
 * of a filter as the locale writes it - any other text as it is.
 */
function formatDateText(
  text: string,
  filter: Column<unknown>["filter"],
  locale: Locale,
) {
  const dayPeriods = getDayPeriods(locale.code);

  if (filter === "time") {
    const time = TIME.exec(text);
    return time
      ? formatDate(
          new Date(2000, 0, 1, Number(time[1]), Number(time[2])),
          locale.formats.time,
          dayPeriods,
        )
      : text;
  }

  const day = parseISODate(text);
  if (!day) return text;

  const time = DAY_TIME.exec(text);
  if (!time) return formatDate(day, locale.formats.date, dayPeriods);
  day.setHours(Number(time[1]), Number(time[2]));
  return formatDate(day, locale.formats.dateTime, dayPeriods);
}

/**
 * The value of a filter as its chip shows it - the column's
 * `formatFilterValue`, or by the filter type: the labels of the options,
 * days and times by the locale, numbers as the language writes them,
 * ranges as `100–500`, Yes / No. A value of no column (an old bookmark) is
 * shown as it is.
 */
export function formatFilterChipValue<T>(
  column: Column<T> | undefined,
  value: DataTableFilterValue,
  locale: Locale,
): string {
  if (column?.formatFilterValue) return column.formatFilterValue(value);

  const messages = locale.messages.ui;
  const filter = column?.filter;

  const formatItem = (item: string) => {
    switch (filter) {
      case "select":
      case "multiSelect":
        return (
          column?.filterSelectOptions?.find(
            (option) => String(option.value) === item,
          )?.label ?? item
        );
      case "boolean":
        return item === "true"
          ? messages.common.yes
          : item === "false"
            ? messages.common.no
            : item;
      case "date":
      case "datetime":
      case "time":
      case "dateRange":
        return formatDateText(item, filter, locale);
      case "numberRange": {
        const number = toNumber(item);
        return number === null ? item : formatNumber(locale.code, number);
      }
      default:
        return item;
    }
  };

  if (typeof value === "string") return formatItem(value);
  if (Array.isArray(value)) return value.map(formatItem).join(", ");

  const { activeFilters } = messages.dataTable;
  const from = value.from === undefined ? undefined : formatItem(value.from);
  const to = value.to === undefined ? undefined : formatItem(value.to);
  if (from !== undefined && to !== undefined) {
    return formatMessage(activeFilters.range, { from, to });
  }
  return from !== undefined
    ? formatMessage(activeFilters.from, { value: from })
    : formatMessage(activeFilters.to, { value: to ?? "" });
}
