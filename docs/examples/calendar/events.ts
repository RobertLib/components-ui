import type { CalendarEvent } from "components-ui";

/** A date `dayOffset` days from today at the given time. */
export const at = (dayOffset: number, hours: number, minutes = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/** Sample events around today, shared by the Calendar examples. */
export const sampleEvents: CalendarEvent[] = [
  {
    color: "blue",
    end: at(0, 9, 30),
    id: "standup",
    start: at(0, 9),
    timeText: "9:00 – 9:30",
    title: "Team stand-up",
  },
  {
    color: "green",
    end: at(0, 12),
    id: "call",
    start: at(0, 11),
    timeText: "11:00 – 12:00",
    title: "Customer call",
  },
  {
    color: "gray",
    end: at(0, 12, 30),
    id: "retro",
    start: at(0, 11, 30),
    timeText: "11:30 – 12:30",
    title: "Retrospective",
  },
  {
    color: "yellow",
    end: at(0, 14),
    id: "review",
    start: at(0, 13),
    timeText: "13:00 – 14:00",
    title: "Code review",
  },
  {
    color: "purple",
    end: at(1, 15, 30),
    id: "design",
    start: at(1, 14),
    timeText: "14:00 – 15:30",
    title: "Design review",
  },
  {
    allDay: true,
    color: "red",
    end: at(2, 23, 59),
    id: "release",
    start: at(2, 0),
    title: "Release day",
  },
  {
    color: "yellow",
    end: at(-1, 13),
    id: "lunch",
    start: at(-1, 12),
    timeText: "12:00 – 13:00",
    title: "Lunch with Jana",
  },
  {
    color: "primary",
    end: at(3, 16),
    id: "workshop",
    start: at(3, 10),
    timeText: "10:00 – 16:00",
    title: "Workshop",
  },
  {
    color: "lightgreen",
    end: at(-3, 10),
    id: "onboarding",
    start: at(-3, 8, 30),
    timeText: "8:30 – 10:00",
    title: "Onboarding",
  },
  {
    color: "blue",
    end: at(6, 17),
    id: "planning",
    start: at(6, 15),
    timeText: "15:00 – 17:00",
    title: "Sprint planning",
  },
];
