import { useState } from "react";
import { RangeCalendar, type DateRange } from "components-ui";

const isWeekend = (day: Date) => day.getDay() === 0 || day.getDay() === 6;

// Leave from a working day to a working day - a range may reach over a
// weekend, and the presets lose the weekends at their ends
export default function WorkingDays() {
  const [leave, setLeave] = useState<DateRange | null>(null);

  return (
    <div className="space-y-3">
      <RangeCalendar
        allowDisabledInRange
        isDateDisabled={isWeekend}
        label="Leave"
        maxDays={21}
        onChange={setLeave}
        presets={["thisWeek", "lastWeek", "thisMonth"]}
        value={leave}
      />
      <p className="text-sm">
        Value: <code>{JSON.stringify(leave)}</code>
      </p>
    </div>
  );
}
