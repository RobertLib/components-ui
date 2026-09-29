import { useState } from "react";
import {
  Calendar,
  type CalendarEvent,
  type CalendarResource,
  type EventTimeChange,
  type NewEventTimeRange,
} from "components-ui";
import { at } from "./events";

// A row per vehicle - its color is that of its trips
const vans: CalendarResource[] = [
  { color: "blue", id: "van-1", title: "Van 1 · Prague" },
  { color: "green", id: "van-2", title: "Van 2 · Prague" },
  { color: "purple", id: "van-3", title: "Van 3 · Brno" },
  { color: "yellow", id: "van-4", title: "Van 4 · Brno" },
];

const initialTrips: CalendarEvent[] = [
  {
    end: at(0, 11),
    id: "t1",
    resourceId: "van-1",
    start: at(0, 8),
    title: "Delivery Kladno",
  },
  {
    end: at(0, 16, 30),
    id: "t2",
    resourceId: "van-1",
    start: at(0, 13),
    title: "Pick-up Mělník",
  },
  {
    end: at(0, 12),
    id: "t3",
    resourceId: "van-2",
    start: at(0, 9, 30),
    title: "Delivery Beroun",
  },
  {
    end: at(0, 14),
    id: "t4",
    resourceId: "van-2",
    start: at(0, 11),
    title: "Moving an office",
  },
  {
    allDay: true,
    end: at(2, 0),
    id: "t5",
    resourceId: "van-3",
    start: at(0, 0),
    title: "Service",
  },
  {
    end: at(1, 18),
    id: "t6",
    resourceId: "van-4",
    start: at(1, 10),
    title: "Trade fair Ostrava",
  },
];

let nextId = 1;

export default function Timeline() {
  const [trips, setTrips] = useState(initialTrips);

  // A move to another time or van, or a resize by an edge
  const update = ({
    event,
    newEnd,
    newResourceId,
    newStart,
  }: EventTimeChange) =>
    setTrips((current) =>
      current.map((trip) =>
        trip.id === event.id
          ? { ...trip, end: newEnd, resourceId: newResourceId, start: newStart }
          : trip,
      ),
    );

  // A range dragged over the slots of a van
  const plan = ({ end, resourceId, start }: NewEventTimeRange) =>
    setTrips((current) => [
      ...current,
      { end, id: `trip-${nextId++}`, resourceId, start, title: "New trip" },
    ]);

  return (
    <Calendar
      businessHours={{ end: "18:00", start: "07:00" }}
      dayEndHour={20}
      dayStartHour={6}
      events={trips}
      initialView="timelineDay"
      onEventDrop={update}
      onEventResize={update}
      onSlotDragEnd={plan}
      resources={vans}
      slotDuration={30}
      viewOptions={["timelineDay", "timelineWeek", "agenda"]}
    />
  );
}
