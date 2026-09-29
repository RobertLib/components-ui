import type { CalendarViewProps } from "./types";
import { useMemo } from "react";
import { daysIntoWeek, getCalendarDay } from "./date-utils";
import { getSlotHeight } from "./utils";
import TimeGrid from "./time-grid";
import { useLocale } from "../../providers/ui-context";

/**
 * The week of the current date in half-hour slots (`slotDuration`) - with
 * `resources` a column for each resource of each day. The `hiddenDays` have
 * no column.
 */
export default function WeekView(props: CalendarViewProps) {
  const { currentDate, hiddenDays, slotDuration = 30 } = props;
  const { weekStartsOn } = useLocale();

  const days = useMemo(() => {
    // Each day at its own start - also after one a daylight saving change
    // starts at 1:00. A day the time zone skips has no column.
    const offset = daysIntoWeek(currentDate, weekStartsOn);
    return Array.from({ length: 7 }, (_, index) =>
      getCalendarDay(currentDate, index - offset),
    )
      .filter((day) => day !== null)
      .filter((day) => !hiddenDays.has(day.getDay()));
  }, [currentDate, hiddenDays, weekStartsOn]);

  return (
    <TimeGrid
      {...props}
      className="week-view"
      days={days}
      slotHeight={getSlotHeight(slotDuration)}
      slotMinutes={slotDuration}
      tileClassName="px-1 outline-[1.5px] outline-surface dark:outline-surface-dark"
    />
  );
}
