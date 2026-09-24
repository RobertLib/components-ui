import type { CalendarViewProps } from "./types";
import { useMemo } from "react";
import { daysIntoWeek, getCalendarDay } from "./date-utils";
import TimeGrid from "./time-grid";
import { useLocale } from "../../providers/ui-context";

/**
 * The week of the current date in half-hour slots - with `resources` a
 * column for each resource of each day.
 */
export default function WeekView(props: CalendarViewProps) {
  const { currentDate } = props;
  const { weekStartsOn } = useLocale();

  const days = useMemo(() => {
    // Each day at its own start - also after one a daylight saving change
    // starts at 1:00. A day the time zone skips has no column.
    const offset = daysIntoWeek(currentDate, weekStartsOn);
    return Array.from({ length: 7 }, (_, index) =>
      getCalendarDay(currentDate, index - offset),
    ).filter((day) => day !== null);
  }, [currentDate, weekStartsOn]);

  return (
    <TimeGrid
      {...props}
      className="week-view"
      days={days}
      slotDuration={30}
      slotHeight={64}
      tileClassName="px-1 outline-[1.5px] outline-surface dark:outline-surface-dark"
    />
  );
}
