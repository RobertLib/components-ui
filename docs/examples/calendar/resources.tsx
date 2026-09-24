import { useState } from "react";
import {
  Calendar,
  type CalendarEvent,
  type CalendarResource,
  type EventTimeChange,
  type NewEventTimeRange,
} from "components-ui";
import { at } from "./events";

// A column per meeting room - its color is that of its bookings
const rooms: CalendarResource[] = [
  { color: "blue", id: "aurora", title: "Aurora · 8 seats" },
  { color: "green", id: "borealis", title: "Borealis · 4 seats" },
  { color: "purple", id: "cosmos", title: "Cosmos · 12 seats" },
  { color: "yellow", id: "delta", title: "Delta · 2 seats" },
  { color: "red", id: "eclipse", title: "Eclipse · 20 seats" },
];

const initialBookings: CalendarEvent[] = [
  {
    end: at(0, 10),
    id: "b1",
    resourceId: "aurora",
    start: at(0, 9),
    title: "Sales sync",
  },
  {
    end: at(0, 12, 30),
    id: "b2",
    resourceId: "borealis",
    start: at(0, 11),
    title: "Interview",
  },
  {
    end: at(0, 16),
    id: "b3",
    resourceId: "cosmos",
    start: at(0, 13),
    title: "Quarterly review",
  },
  {
    end: at(0, 9, 30),
    id: "b4",
    resourceId: "delta",
    start: at(0, 8),
    title: "1:1 Jana",
  },
  {
    allDay: true,
    end: at(1, 0),
    id: "b5",
    resourceId: "eclipse",
    start: at(0, 0),
    title: "Board day",
  },
  {
    end: at(1, 15),
    id: "b6",
    resourceId: "aurora",
    start: at(1, 14),
    title: "Design critique",
  },
];

let nextId = 1;

export default function Resources() {
  const [bookings, setBookings] = useState(initialBookings);

  // A move to another time or room, or a resize - `newResourceId` is the
  // room of the column it was dropped in
  const update = ({
    event,
    newEnd,
    newResourceId,
    newStart,
  }: EventTimeChange) =>
    setBookings((current) =>
      current.map((item) =>
        item.id === event.id
          ? { ...item, end: newEnd, resourceId: newResourceId, start: newStart }
          : item,
      ),
    );

  // A range dragged over the slots of a room
  const book = ({ end, resourceId, start }: NewEventTimeRange) =>
    setBookings((current) => [
      ...current,
      { end, id: `new-${nextId++}`, resourceId, start, title: "New booking" },
    ]);

  return (
    <Calendar
      events={bookings}
      initialView="day"
      onEventDrop={update}
      onEventResize={update}
      onSlotDragEnd={book}
      resources={rooms}
      viewOptions={["day", "week", "agenda"]}
    />
  );
}
