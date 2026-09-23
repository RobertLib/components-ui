import { Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Calendar,
  IconButton,
  type CalendarEvent,
  type EventTimeChange,
} from "components-ui";
import { sampleEvents } from "./events";

let nextId = 1;

export default function Editable() {
  const [events, setEvents] = useState<CalendarEvent[]>(sampleEvents);

  // Move or resize: store the new times (and save them to your API)
  const updateTimes = ({ event, newEnd, newStart }: EventTimeChange) =>
    setEvents((current) =>
      current.map((item) =>
        item.id === event.id ? { ...item, end: newEnd, start: newStart } : item,
      ),
    );

  return (
    <Calendar
      events={events}
      initialView="week"
      onEventDrop={updateTimes}
      onEventResize={updateTimes}
      // Dragging over empty slots picks a range for a new event
      onSlotDragEnd={({ end, start }) =>
        setEvents((current) => [
          ...current,
          {
            color: "green",
            end,
            id: `new-${nextId++}`,
            start,
            title: "New event",
          },
        ])
      }
      renderEventActions={(event) => (
        <IconButton
          aria-label={`Delete ${event.title}`}
          className="m-0 p-0.5"
          onClick={() =>
            setEvents((current) =>
              current.filter((item) => item.id !== event.id),
            )
          }
          variant="danger"
        >
          <Trash2 size={12} />
        </IconButton>
      )}
      renderEventIcon={(event) =>
        event.id === "standup" ? (
          <Repeat className="mr-1 inline" size={12} />
        ) : null
      }
    />
  );
}
