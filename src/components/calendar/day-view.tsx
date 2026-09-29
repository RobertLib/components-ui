import type { CalendarViewProps } from "./types";
import { useMemo } from "react";
import { getSlotHeight } from "./utils";
import { startOfDay } from "../../utils/date";
import TimeGrid from "./time-grid";

/**
 * The current date in hour slots (`slotDuration`) - with `resources` a
 * column for each resource, else its all-day events above its one column.
 */
export default function DayView(props: CalendarViewProps) {
  const { currentDate, resources, slotDuration = 60 } = props;
  const days = useMemo(() => [startOfDay(currentDate)], [currentDate]);
  const hasResources = !!resources && resources.length > 0;

  return (
    <TimeGrid
      {...props}
      className="day-view"
      days={days}
      slotHeight={getSlotHeight(slotDuration)}
      slotMinutes={slotDuration}
      tileClassName={
        hasResources
          ? "px-2 outline-[1.5px] outline-surface dark:outline-surface-dark"
          : "px-2"
      }
    />
  );
}
