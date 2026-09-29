import { useState } from "react";
import { Button, RangeCalendar, useIsMobile } from "components-ui";

/** `YYYY-MM-DD` of the day `days` days from today, in local time. */
function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Booked nights - e.g. loaded from an API
const booked = new Set([inDays(5), inDays(6), inDays(20)]);

/** `YYYY-MM-DD` of a date in local time. */
const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// A stay of at least one night that cannot reach over a booked one - the
// days go to the form as `checkIn` and `checkOut`
export default function Booking() {
  const isMobile = useIsMobile();
  const [submitted, setSubmitted] = useState<Record<string, unknown>>();

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onReset={() => setSubmitted(undefined)}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(Object.fromEntries(new FormData(event.currentTarget)));
        }}
      >
        <RangeCalendar
          description="Check-in and check-out day - booked nights are struck through."
          endName="checkOut"
          isDateDisabled={(day) => booked.has(toISODate(day))}
          label="Stay"
          min={inDays(0)}
          minDays={2}
          months={isMobile ? 1 : 2}
          required
          startName="checkIn"
        />
        <div className="flex gap-2">
          <Button type="submit">Book</Button>
          <Button type="reset" variant="outline">
            Reset
          </Button>
        </div>
      </form>
      <pre className="overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {submitted
          ? JSON.stringify(submitted, null, 2)
          : "Submit the form to see its FormData"}
      </pre>
    </div>
  );
}
