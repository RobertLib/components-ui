import { DateCalendar } from "components-ui";

export default function States() {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <DateCalendar error="Pick the day of the visit." label="With an error" />
      <DateCalendar defaultValue="2026-09-24" label="Read-only" readOnly />
      <DateCalendar defaultValue="2026-09-24" disabled label="Disabled" />
    </div>
  );
}
