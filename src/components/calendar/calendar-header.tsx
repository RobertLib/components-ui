import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "../button";
import DateTimePicker from "../datetime-picker";
import type { CalendarView } from "./types";
import { getWeekStartEnd } from "./date-utils";
import {
  formatDate,
  formatMonthYear,
  parseISODate,
  toISODate,
} from "../../utils/date";
import { useLocale } from "../../providers/ui-context";

export interface CalendarHeaderProps {
  currentDate: Date;
  onDateSelect?: (date: Date) => void;
  onNext: () => void;
  onPrevious: () => void;
  onViewChange: (view: CalendarView) => void;
  view: CalendarView;
  viewOptions: CalendarView[];
}

export default function CalendarHeader({
  currentDate,
  onDateSelect,
  onNext,
  onPrevious,
  onViewChange,
  view,
  viewOptions,
}: CalendarHeaderProps) {
  const locale = useLocale();
  const { messages } = locale;

  const formattedDate = (() => {
    switch (view) {
      case "month":
        return formatMonthYear(currentDate, locale.code);
      case "week": {
        const { start, end } = getWeekStartEnd(
          currentDate,
          locale.weekStartsOn,
        );
        return `${formatDate(start, locale.formats.date)} - ${formatDate(end, locale.formats.date)}`;
      }
      default:
        return formatDate(currentDate, locale.formats.date);
    }
  })();

  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 p-2 lg:flex-row lg:items-center lg:gap-4 dark:border-neutral-800">
      <div className="flex items-center gap-2">
        <div className="w-40 sm:w-44">
          <DateTimePicker
            aria-label={messages.calendar.goToDate}
            onChange={(event) => {
              const selectedDate = parseISODate(event.target.value);
              if (selectedDate) onDateSelect?.(selectedDate);
            }}
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
        {view !== "day" && (
          <h2
            aria-live="polite"
            className="text-sm font-semibold whitespace-nowrap sm:text-base lg:text-lg"
          >
            {formattedDate}
          </h2>
        )}
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
