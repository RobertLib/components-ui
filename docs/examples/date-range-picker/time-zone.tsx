import { DateRangePicker } from "components-ui";

// A hotel in Prague: today is that of Prague, wherever the guest books from
export default function TimeZone() {
  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <DateRangePicker
        disablePast
        endName="checkOut"
        label="Stay"
        minDays={2}
        presets={["today", "thisWeek", "thisMonth"]}
        startName="checkIn"
        timeZone="Europe/Prague"
      />
      <DateRangePicker
        disableFuture
        label="Sales of the Tokyo branch"
        presets={["today", "last7Days", "lastMonth"]}
        timeZone="Asia/Tokyo"
      />
    </div>
  );
}
