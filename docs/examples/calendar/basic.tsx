import { Calendar, useSnackbar } from "components-ui";
import { sampleEvents } from "./events";

export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <Calendar
      events={sampleEvents}
      onDateClick={(date) =>
        enqueueSnackbar(`Clicked ${date.toLocaleString()}`)
      }
      onEventClick={(event) =>
        enqueueSnackbar(`Opened "${event.title}"`, "info")
      }
    />
  );
}
