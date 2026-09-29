import { MapPin, Users } from "lucide-react";
import { Calendar, useSnackbar, type CalendarEvent } from "components-ui";
import { at } from "./events";

/** An event with data of the app - the tiles show it. */
interface Meeting extends CalendarEvent {
  attendees?: string[];
  room?: string;
}

const meetings: Meeting[] = [
  {
    attendees: ["Jana", "Petr", "Eva"],
    color: "blue",
    end: at(0, 10, 30),
    id: "planning",
    room: "Aurora",
    start: at(0, 9),
    title: "Sprint planning",
  },
  {
    attendees: ["Tomáš"],
    color: "green",
    end: at(1, 14),
    id: "one-on-one",
    room: "Delta",
    start: at(1, 13),
    title: "1:1 Tomáš",
  },
  {
    allDay: true,
    color: "purple",
    end: at(3, 0),
    id: "offsite",
    start: at(2, 0),
    title: "Team offsite",
  },
];

export default function CustomTiles() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <Calendar
      events={meetings}
      initialView="week"
      onEventClick={(event) => enqueueSnackbar(`Opened "${event.title}"`)}
      renderEvent={(event, { compact, timeText, title }) => {
        const { attendees = [], room } = event as Meeting;

        // One line in the month, the all-day row and the lists
        if (compact) {
          return (
            <>
              {title}
              {attendees.length > 0 && (
                <span className="ms-1 opacity-70">· {attendees.length}</span>
              )}
            </>
          );
        }

        return (
          <span className="flex flex-col gap-0.5">
            <span className="truncate font-medium">{title}</span>
            <span className="truncate opacity-80">{timeText}</span>
            {room && (
              <span className="flex items-center gap-1 truncate opacity-80">
                <MapPin className="shrink-0" size={12} /> {room}
              </span>
            )}
            {attendees.length > 0 && (
              <span className="flex items-center gap-1 truncate opacity-80">
                <Users className="shrink-0" size={12} /> {attendees.join(", ")}
              </span>
            )}
          </span>
        );
      }}
    />
  );
}
