import { useState } from "react";
import {
  Calendar,
  Select,
  useSnackbar,
  type CalendarAgendaPeriod,
} from "components-ui";
import { sampleEvents } from "./events";

const periods = [
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
  { label: "Next 14 days", value: "14" },
];

// The events by day - the view of choice on phones
export default function Agenda() {
  const { enqueueSnackbar } = useSnackbar();
  const [period, setPeriod] = useState("month");
  const agendaPeriod = (period === "14" ? 14 : period) as CalendarAgendaPeriod;

  return (
    <div className="space-y-3">
      <div className="max-w-48">
        <Select
          dim="sm"
          label="Agenda period"
          onChange={(event) => setPeriod(event.target.value)}
          options={periods}
          value={period}
        />
      </div>
      <Calendar
        agendaPeriod={agendaPeriod}
        events={sampleEvents}
        initialView="agenda"
        onDateClick={(date) =>
          enqueueSnackbar(`Picked ${date.toLocaleDateString()}`)
        }
        onEventClick={(event) =>
          enqueueSnackbar(`Opened "${event.title}"`, "info")
        }
        viewOptions={["agenda", "month", "week", "day"]}
      />
    </div>
  );
}
