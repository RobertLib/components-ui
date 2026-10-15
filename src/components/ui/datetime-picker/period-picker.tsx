import cn from "../../../utils/cn";
import PeriodGrid, { type PeriodGridProps } from "./period-grid";
import PickerField from "./picker-field";
import PresetList from "./preset-list";
import {
  getRangeMessage,
  isInRange,
  parseDisplayValue,
  parseMonth,
  parseQuarter,
  parseYear,
} from "./parse";
import usePickerPopup from "./use-picker-popup";
import { areMonthsUnavailable } from "./availability";
import useIsMobile from "../../../hooks/use-is-mobile";
import { formatMessage } from "../../../i18n/ui/format";
import {
  formatPattern,
  formatPlaceholder,
  getDatePattern,
  getMonthNames,
  pad2,
  padYear,
  quarterOfMonth,
  withoutYear,
} from "../../../utils/date";
import { inTimeZone } from "../../../utils/time-zone";
import { useLocale } from "../../../providers/ui-context";
import type { Locale } from "../../../i18n/ui/types";
import type { CustomPickerProps } from "./types";

/** The pickers of whole periods - their values are `YYYY-MM`, `YYYY-Qq`, `YYYY`. */
export type PeriodType = "month" | "quarter" | "year";

// The last year a value can write - four digits
const LAST_YEAR = 9999;

// Years on a page of the year popup - a decade with the years around it
const YEARS_PER_PAGE = 12;

/**
 * How a picker of `type` reads, writes and lays out its periods - see
 * `PeriodGridProps` for the keys.
 */
interface Period extends Pick<
  PeriodGridProps,
  "columns" | "content" | "label" | "lastKey" | "pageLabel" | "pageSize"
> {
  /** The first and the last month (1 - 12) of a period, and its year. */
  monthsOf: (key: number) => { first: number; last: number; year: number };
  /** The page that shows a period as the popup opens. */
  pageStartOf: (key: number) => number;
  /** The display pattern of the locale. */
  pattern: string;
  /** The key of the period `date` lies in. */
  keyOf: (date: Date) => number;
  /** The key of a value - `null` for none or one of another shape. */
  toKey: (value: string | undefined) => number | null;
  /** The value of a key. */
  toValue: (key: number) => string;
  /** The value as the field shows it. */
  write: (key: number) => string;
}

/** The periods of a picker of `type` in `locale`. */
function getPeriod(type: PeriodType, locale: Locale): Period {
  const pattern = getDatePattern(locale.formats, type);

  switch (type) {
    case "month": {
      const monthNames = getMonthNames(locale.code);
      const yearOf = (key: number) => Math.floor(key / 12);
      return {
        columns: 3,
        content: (key) => monthNames[key % 12],
        keyOf: (date) => date.getFullYear() * 12 + date.getMonth(),
        label: (key) => `${monthNames[key % 12]} ${yearOf(key)}`,
        lastKey: LAST_YEAR * 12 + 11,
        monthsOf: (key) => ({
          first: (key % 12) + 1,
          last: (key % 12) + 1,
          year: yearOf(key),
        }),
        pageLabel: (start) => String(yearOf(start)),
        pageSize: 12,
        pageStartOf: (key) => key - (key % 12),
        pattern,
        toKey: (value) => {
          const month = parseMonth(value);
          return month && month.year * 12 + month.month - 1;
        },
        toValue: (key) => `${padYear(yearOf(key))}-${pad2((key % 12) + 1)}`,
        write: (key) =>
          formatPattern(pattern, {
            month: (key % 12) + 1,
            quarter: quarterOfMonth((key % 12) + 1),
            year: yearOf(key),
          }),
      };
    }
    case "quarter": {
      const shortMonthNames = getMonthNames(locale.code, "short");
      // The buttons show the quarter as the quarter format of the locale
      // does - without the year: "Q3", "3. čtvrtletí"
      const quarterPattern = withoutYear(pattern);
      const yearOf = (key: number) => Math.floor(key / 4);
      const write = (key: number) =>
        formatPattern(pattern, { quarter: (key % 4) + 1, year: yearOf(key) });
      return {
        columns: 2,
        content: (key) => (
          <>
            <span className="block font-medium">
              {formatPattern(quarterPattern, { quarter: (key % 4) + 1 })}
            </span>
            {/* Its months - "Jul – Sep" */}
            <span className="block text-xs opacity-75">
              {shortMonthNames[(key % 4) * 3]} –{" "}
              {shortMonthNames[(key % 4) * 3 + 2]}
            </span>
          </>
        ),
        keyOf: (date) =>
          date.getFullYear() * 4 + Math.floor(date.getMonth() / 3),
        label: write,
        lastKey: LAST_YEAR * 4 + 3,
        monthsOf: (key) => ({
          first: (key % 4) * 3 + 1,
          last: (key % 4) * 3 + 3,
          year: yearOf(key),
        }),
        pageLabel: (start) => String(yearOf(start)),
        pageSize: 4,
        pageStartOf: (key) => key - (key % 4),
        pattern,
        toKey: (value) => {
          const quarter = parseQuarter(value);
          return quarter && quarter.year * 4 + quarter.quarter - 1;
        },
        toValue: (key) => `${padYear(yearOf(key))}-Q${(key % 4) + 1}`,
        write,
      };
    }
    case "year":
      return {
        columns: 3,
        content: (key) => key,
        keyOf: (date) => date.getFullYear(),
        label: (key) => String(key),
        lastKey: LAST_YEAR,
        monthsOf: (key) => ({ first: 1, last: 12, year: key }),
        // "2020 – 2031"
        pageLabel: (start) =>
          `${start} – ${Math.min(start + YEARS_PER_PAGE - 1, LAST_YEAR)}`,
        pageSize: YEARS_PER_PAGE,
        // The decade of the year first, the years after it on the page
        pageStartOf: (key) => key - (key % 10),
        pattern,
        toKey: (value) => parseYear(value)?.year ?? null,
        toValue: padYear,
        write: (key) => formatPattern(pattern, { year: key }),
      };
  }
}

/**
 * `type="month"` (value `YYYY-MM`), `type="quarter"` (value `YYYY-Qq`) and
 * `type="year"` (value `YYYY`) - a grid of the periods of a year (of years
 * for a year), with the `presets` beside it.
 */
export default function PeriodPicker({
  isDateDisabled,
  max,
  min,
  minuteStep: _minuteStep,
  onValueChange,
  placeholder,
  // Of the date popup only
  popupActions: _popupActions,
  presets,
  timeZone,
  type,
  value,
  ...props
}: CustomPickerProps & { type: PeriodType }) {
  const locale = useLocale();
  const messages = locale.messages.ui.dateTimePicker;
  const isMobile = useIsMobile();
  const {
    close,
    contentRef,
    inputRef,
    isOpen,
    markPicked,
    onOpenChange,
    openedByKeyboard,
    pickCount,
  } = usePickerPopup(!props.disabled && !props.readOnly);

  const period = getPeriod(type, locale);
  const selected = period.toKey(value);
  const minKey = period.toKey(min);
  const maxKey = period.toKey(max);
  const { popupLabel, previousPage, nextPage } = {
    month: {
      nextPage: messages.nextYear,
      popupLabel: messages.selectMonth,
      previousPage: messages.previousYear,
    },
    quarter: {
      nextPage: messages.nextYear,
      popupLabel: messages.selectQuarter,
      previousPage: messages.previousYear,
    },
    year: {
      nextPage: messages.nextYears,
      popupLabel: messages.selectYear,
      previousPage: messages.previousYears,
    },
  }[type];

  /** A value as the field shows it. */
  const formatValue = (value: string) => {
    const key = period.toKey(value);
    return key === null ? value : period.write(key);
  };

  // Every day of the period disabled
  const isUnavailable = (key: number) => {
    if (!isDateDisabled) return false;
    const { first, last, year } = period.monthsOf(key);
    return areMonthsUnavailable(year, first, last, isDateDisabled);
  };

  const getUnavailableMessage = (value: string) => {
    const key = period.toKey(value);
    return key !== null && isUnavailable(key)
      ? formatMessage(messages.unavailable, { value: formatValue(value) })
      : "";
  };

  // A picked period or a preset - the popup closes first: the field takes
  // the focus while the button pressed is still there
  const pick = (picked: string) => {
    markPicked();
    close();
    onValueChange(picked);
  };

  const presetItems = (presets ?? []).map((preset) => {
    const key = period.toKey(preset.value);
    const disabled =
      key === null || !isInRange(preset.value, min, max) || isUnavailable(key);
    return {
      current: !disabled && selected !== null && preset.value === value,
      disabled,
      label: preset.label,
    };
  });
  const hasPresets = presetItems.length > 0;

  return (
    <PickerField
      {...props}
      ariaLabel={props.ariaLabel ?? popupLabel}
      contentRef={contentRef}
      displayValue={selected === null ? "" : period.write(selected)}
      format={formatPlaceholder(period.pattern, messages.placeholderTokens)}
      icon="calendar"
      inputRef={inputRef}
      isOpen={isOpen}
      onClear={() => onValueChange("")}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
      // Wider with the presets beside the grid
      panelClassName={hasPresets && !isMobile ? undefined : "w-64"}
      parseText={(text) => {
        // A year left out is the one of today of `timeZone`
        const typed = parseDisplayValue(
          text,
          period.pattern,
          type,
          undefined,
          inTimeZone(new Date(), timeZone),
        );
        if (!typed) return { error: "format" };
        return isInRange(typed, min, max)
          ? { value: typed, validityMessage: getUnavailableMessage(typed) }
          : { error: "range" };
      }}
      pickCount={pickCount}
      placeholder={placeholder}
      popupLabel={popupLabel}
      validityMessage={
        getRangeMessage(
          messages,
          selected === null ? undefined : period.toValue(selected),
          { max, min },
          formatValue,
        ) ||
        // A period with no day left - one typed too, which is kept (the
        // form cannot be submitted with it)
        getUnavailableMessage(value)
      }
      value={value}
    >
      <div
        className={cn(
          hasPresets && (isMobile ? "flex flex-col gap-2" : "flex gap-3"),
        )}
      >
        {hasPresets && (
          <PresetList
            compact={isMobile}
            items={presetItems}
            label={messages.presetsLabel}
            onPick={(index) => pick(presets?.[index]?.value ?? "")}
          />
        )}

        <div className={cn(hasPresets && !isMobile && "w-60")}>
          <PeriodGrid
            autoFocus={openedByKeyboard}
            columns={period.columns}
            content={period.content}
            getTodayKey={() => period.keyOf(inTimeZone(new Date(), timeZone))}
            isUnavailable={isDateDisabled ? isUnavailable : undefined}
            label={period.label}
            lastKey={period.lastKey}
            max={maxKey}
            min={minKey}
            nextPageLabel={nextPage}
            onEscape={close}
            onSelect={(key) => pick(period.toValue(key))}
            pageLabel={period.pageLabel}
            pageSize={period.pageSize}
            pageStartOf={period.pageStartOf}
            previousPageLabel={previousPage}
            selected={selected}
          />
        </div>
      </div>
    </PickerField>
  );
}
