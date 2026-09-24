import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent } from ".";

/** A day of September 2026 - the 24th is a Thursday. */
const d = (day: number, hours = 0, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes);

const events: CalendarEvent[] = [
  {
    end: d(24, 10),
    htmlTitle: "<b>Team</b> <i>room 5</i>",
    id: "team",
    start: d(24, 9),
    title: "Team room 5",
  },
];

describe("Calendar on the server", () => {
  it.each(["month", "week", "day", "agenda"] as const)(
    "renders an htmlTitle without DOMParser, then hydrates it (%s view)",
    async (view) => {
      const calendar = (
        <Calendar events={events} initialDate={d(24)} initialView={view} />
      );

      // Next.js renders "use client" components on the server too
      vi.stubGlobal("DOMParser", undefined);
      const html = renderToString(calendar);
      vi.unstubAllGlobals();
      expect(html).toContain("Team room 5");

      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const onRecoverableError = vi.fn();

      // The first render in the browser matches the server's - the
      // sanitized HTML comes right after it
      const root = await act(async () =>
        hydrateRoot(container, calendar, { onRecoverableError }),
      );
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container.querySelector("i")).toHaveTextContent("room 5");

      act(() => root.unmount());
      container.remove();
    },
  );
});

describe("Calendar with resources and recurring events on the server", () => {
  const resources = [
    { color: "blue", id: "a", title: "Room A" },
    { color: "green", id: "b", title: "Room B" },
  ];
  const planned: CalendarEvent[] = [
    ...events.map((event) => ({ ...event, resourceId: "a" })),
    {
      end: d(3, 11),
      id: "weekly",
      recurrence: "FREQ=WEEKLY;BYDAY=TH",
      resourceId: "b",
      start: d(3, 10),
      title: "Weekly sync",
    },
  ];

  it.each(["week", "day", "agenda"] as const)(
    "renders the same markup the browser hydrates (%s view)",
    async (view) => {
      const calendar = (
        <Calendar
          events={planned}
          initialDate={d(24)}
          initialView={view}
          onDateClick={() => {}}
          onEventClick={() => {}}
          resources={resources}
        />
      );

      vi.stubGlobal("DOMParser", undefined);
      const html = renderToString(calendar);
      vi.unstubAllGlobals();
      expect(html).toContain("Weekly sync");
      if (view !== "agenda") expect(html).toContain("Room B");

      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const onRecoverableError = vi.fn();

      const root = await act(async () =>
        hydrateRoot(container, calendar, { onRecoverableError }),
      );
      expect(onRecoverableError).not.toHaveBeenCalled();

      act(() => root.unmount());
      container.remove();
    },
  );
});
