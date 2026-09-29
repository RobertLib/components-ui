import { useState } from "react";
import { Button, DateCalendar } from "components-ui";

/** `YYYY-MM-DD` of the day `days` days from today, in local time. */
function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// No state for the calendar: the day goes to the form as `pickup`
export default function Form() {
  const [submitted, setSubmitted] = useState<Record<string, unknown>>();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-4"
        onReset={() => setSubmitted(undefined)}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(Object.fromEntries(new FormData(event.currentTarget)));
        }}
      >
        <DateCalendar
          description="Within the next 30 days, on a working day."
          isDateDisabled={(day) => day.getDay() === 0 || day.getDay() === 6}
          label="Pickup day"
          max={inDays(30)}
          min={inDays(0)}
          name="pickup"
          required
        />
        <div className="flex gap-2">
          <Button type="submit">Book</Button>
          <Button type="reset" variant="outline">
            Reset
          </Button>
        </div>
      </form>
      <pre className="h-fit overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {submitted
          ? JSON.stringify(submitted, null, 2)
          : "Submit the form to see its FormData"}
      </pre>
    </div>
  );
}
