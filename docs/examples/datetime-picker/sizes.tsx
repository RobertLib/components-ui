import { DateTimePicker } from "components-ui";

// The heights of Input - and a label of any content
export default function Sizes() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <DateTimePicker dim="xs" label="Extra small" type="date" />
      <DateTimePicker dim="sm" label="Small" type="time" />
      <DateTimePicker dim="md" label="Medium" type="date" />
      <DateTimePicker
        dim="lg"
        label={
          <>
            Large{" "}
            <span className="font-normal text-neutral-600 dark:text-neutral-400">
              (optional)
            </span>
          </>
        }
        type="month"
      />
    </div>
  );
}
