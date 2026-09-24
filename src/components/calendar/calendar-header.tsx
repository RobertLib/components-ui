import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "../button";
import cn from "../../utils/cn";
import DateTimePicker from "../datetime-picker";
import type { CalendarAgendaPeriod, CalendarView } from "./types";
import {
  addCalendarDays,
  getVisibleRange,
  getWeekStartEnd,
} from "./date-utils";
import { createDayFormat } from "./utils";
import {
  capitalize,
  formatDate,
  formatMonthYear,
  parseISODate,
  toISODate,
} from "../../utils/date";
import { useLocale } from "../../providers/ui-context";

export interface CalendarHeaderProps {
  /** What the agenda view lists - its period label. */
  agendaPeriod: CalendarAgendaPeriod;
  /** The day the calendar shows - in the date field and the period label. */
  currentDate: Date;
  /** The latest date the date field offers. */
  maxDate?: Date;
  /** The earliest date the date field offers. */
  minDate?: Date;
  /** A date was picked in the date field. */
  onDateSelect?: (date: Date) => void;
  /** The next period (month, week or day) was asked for. */
  onNext: () => void;
  /** The previous period was asked for. */
  onPrevious: () => void;
  /** Today was asked for. */
  onToday: () => void;
  /** Another view was picked in the view switcher. */
  onViewChange: (view: CalendarView) => void;
  /** The view shown. */
  view: CalendarView;
  /** Views offered by the view switcher - none with only one. */
  viewOptions: CalendarView[];
}

export default function CalendarHeader({
  agendaPeriod,
  currentDate,
  maxDate,
  minDate,
  onDateSelect,
  onNext,
  onPrevious,
  onToday,
  onViewChange,
  view,
  viewOptions,
}: CalendarHeaderProps) {
  const locale = useLocale();
  const { messages } = locale;
  // The agenda shows a period of its own
  const period = view === "agenda" ? agendaPeriod : view;

  const formattedDate = (() => {
    switch (period) {
      case "month":
        return formatMonthYear(currentDate, locale.code);
      case "week": {
        const { start, end } = getWeekStartEnd(
          currentDate,
          locale.weekStartsOn,
        );
        return `${formatDate(start, locale.formats.date)} - ${formatDate(end, locale.formats.date)}`;
      }
      case "day":
        // The full day - for screen readers, the date field shows it
        return capitalize(
          createDayFormat(locale).format(currentDate),
          locale.code,
        );
      default: {
        // Days of the agenda from the current date - the end is exclusive
        const { start, end } = getVisibleRange(
          currentDate,
          "agenda",
          locale.weekStartsOn,
          { agendaPeriod: period },
        );
        return `${formatDate(start, locale.formats.date)} - ${formatDate(addCalendarDays(end, -1), locale.formats.date)}`;
      }
    }
  })();

  return (
    // A calendar narrower than the screen (a sidebar next to it) wraps the
    // view switcher into a row of its own
    <div className="flex flex-col gap-2 border-b border-neutral-200 p-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 dark:border-neutral-800">
      <div className="flex items-center gap-2">
        <div className="w-36 sm:w-44">
          <DateTimePicker
            aria-label={messages.calendar.goToDate}
            max={maxDate && toISODate(maxDate)}
            min={minDate && toISODate(minDate)}
            onChange={(event) => {
              const selectedDate = parseISODate(event.target.value);
              if (selectedDate) onDateSelect?.(selectedDate);
            }}
            // The calendar always shows a date
            clearable={false}
            type="date"
            value={toISODate(currentDate)}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            aria-label={messages.calendar.previous}
            onClick={onPrevious}
            size="icon"
            variant="ghost"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button className="px-2!" onClick={onToday} variant="ghost">
            {messages.calendar.today}
          </Button>
          <Button
            aria-label={messages.calendar.next}
            onClick={onNext}
            size="icon"
            variant="ghost"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      {/* On mobile this is a second row - the period label on the left, the view
          switcher on the right; `lg:contents` dissolves it so both sit directly
          in the header row on large screens. */}
      <div className="flex flex-wrap items-center gap-2 lg:contents">
        {/* Says the period a Previous, Next or Today button moved to - a
            day only to screen readers, the date field shows it */}
        <h2
          aria-live="polite"
          className={cn(
            "text-sm font-semibold whitespace-nowrap sm:text-base lg:text-lg",
            period === "day" && "sr-only",
          )}
        >
          {formattedDate}
        </h2>
        {viewOptions.length > 1 && (
          <div className="btn-group ml-auto shrink-0">
            {viewOptions.map((viewOption) => (
              <Button
                aria-pressed={viewOption === view}
                color={viewOption === view ? "default" : undefined}
                key={viewOption}
                onClick={() => onViewChange(viewOption)}
                size="sm"
                variant={viewOption === view ? undefined : "outline"}
              >
                {messages.calendar[viewOption]}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
