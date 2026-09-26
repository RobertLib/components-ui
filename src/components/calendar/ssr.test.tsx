import { act, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
    "renders the view without its events, then hydrates them (%s view)",
    async (view) => {
      const calendar = (
        <Calendar events={events} initialDate={d(24)} initialView={view} />
      );

      // Next.js renders "use client" components on the server too
      vi.stubGlobal("DOMParser", undefined);
      const html = renderToString(calendar);
      vi.unstubAllGlobals();
      // The days of the events depend on the time zone of the browser
      expect(html).not.toContain("Team room 5");
      expect(html).not.toContain("No events");

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
      // The events right after it - the rich title sanitized
      expect(container).toHaveTextContent("Team room 5");
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
      expect(html).not.toContain("Weekly sync");
      if (view !== "agenda") expect(html).toContain("Room B");

      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const onRecoverableError = vi.fn();

      const root = await act(async () =>
        hydrateRoot(container, calendar, { onRecoverableError }),
      );
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container).toHaveTextContent("Weekly sync");

      act(() => root.unmount());
      container.remove();
    },
  );
});

describe("Calendar rendered in another time zone than the browser's", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  it.each(["month", "week", "day", "agenda"] as const)(
    "hydrates with the events of the browser's clock (%s view)",
    async (view) => {
      // An event of an API - 9:00 in Prague, 7:00 on a server in UTC
      const standup: CalendarEvent[] = [
        {
          end: new Date("2026-09-24T07:15:00Z"),
          id: "standup",
          start: new Date("2026-09-24T07:00:00Z"),
          title: "Standup",
        },
      ];
      const calendar = (
        <Calendar
          dayStartHour={8}
          events={standup}
          initialDate={new Date("2026-09-24T12:00:00Z")}
          initialView={view}
          onEventClick={() => {}}
        />
      );

      process.env.TZ = "UTC";
      const html = renderToString(calendar);
      process.env.TZ = "Europe/Prague";

      const container = document.createElement("div");
      container.innerHTML = html;
      document.body.append(container);
      const onRecoverableError = vi.fn();

      const root = await act(async () =>
        hydrateRoot(container, calendar, { onRecoverableError }),
      );
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(container).toHaveTextContent("Standup");
      // At 9:00 of Prague - in the hours shown from 8:00, not before them
      expect(
        within(container).getByRole("button", {
          // Intl writes thin and narrow spaces
          name: /^Standup, Thursday, September 24, 2026, 9:00\s–\s9:15\sAM$/,
        }),
      ).toBeInTheDocument();

      act(() => root.unmount());
      container.remove();
    },
  );
});

describe("Calendar navigation bounds on the server", () => {
  it("hydrates Today enabled, then disables it out of minDate - maxDate", async () => {
    // Today of the server and of the browser may differ - known once hydrated
    const calendar = (
      <Calendar
        initialDate={new Date(2100, 0, 15)}
        initialView="agenda"
        maxDate={new Date(2100, 11, 31)}
        minDate={new Date(2100, 0, 1)}
        viewOptions={["agenda", "month", "week", "day"]}
      />
    );
    const html = renderToString(calendar);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const root = await act(async () =>
      hydrateRoot(container, calendar, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(
      within(container).getByRole("button", { name: "Today" }),
    ).toBeDisabled();

    act(() => root.unmount());
    container.remove();
  });
});
