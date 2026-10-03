import { act, fireEvent, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { describe, expect, it, vi } from "vitest";
import Calendar, {
  type CalendarEvent,
  type CalendarEventRenderContext,
  type CalendarProps,
} from ".";

const d = (day: number, hour = 0) => new Date(2026, 8, day, hour);
const review: CalendarEvent = {
  end: d(24, 10),
  id: "review",
  start: d(24, 9),
  title: "Review",
};
const other: CalendarEvent = {
  end: d(24, 13),
  id: "other",
  start: d(24, 12),
  title: "Other",
};

const views = [
  { view: "month", distance: 100, steps: 1 },
  { view: "week", distance: 100, steps: 1 },
  // Fifteen hour slots take the timeline from 09:00 to the next day's 09:00.
  { view: "timelineWeek", distance: 600, steps: 15 },
] as const;
const modes = ["pointer", "keyboard"] as const;
type Mode = (typeof modes)[number];

const press = { clientX: 400, clientY: 100, isPrimary: true };
const tile = (title = "Review") =>
  screen.getByText(title).closest<HTMLElement>(".group\\/event")!;
const tileButton = () => screen.getByRole("button", { name: /^Review,/ });
const renderEvent = (
  event: CalendarEvent,
  context: CalendarEventRenderContext,
) => (
  <span>
    {event.title}
    <span data-testid={`${event.id}-dragging`}>
      {context.dragging ? "moving" : "idle"}
    </span>
  </span>
);

function beginMove(mode: Mode, distance: number, steps: number) {
  if (mode === "pointer") {
    fireEvent.pointerDown(tile(), press);
    fireEvent.pointerMove(document, {
      buttons: 1,
      clientX: press.clientX + distance,
      clientY: press.clientY,
    });
  } else {
    act(() => tileButton().focus());
    fireEvent.keyDown(tileButton(), { ctrlKey: true, key: "x" });
    for (let index = 0; index < steps; index++) {
      fireEvent.keyDown(tileButton(), { key: "ArrowRight" });
    }
  }
  expect(screen.getByTestId("review-dragging")).toHaveTextContent("moving");
}

function release(mode: Mode) {
  if (mode === "pointer") fireEvent.pointerUp(document);
  else fireEvent.keyDown(tileButton(), { key: "Enter" });
}

describe.each(views)(
  "Calendar move lifecycle in $view",
  ({ view, distance, steps }) => {
    it.each(modes)(
      "cancels a %s move when a new date limit excludes its target",
      (mode) => {
        vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
          700,
        );
        const onEventDrop = vi.fn();
        const props: CalendarProps = {
          events: [review],
          initialDate: d(24),
          initialView: view,
          maxDate: d(30),
          onEventClick: vi.fn(),
          onEventDrop,
          renderEvent,
        };
        const { rerender } = render(<Calendar {...props} />);
        beginMove(mode, distance, steps);

        rerender(<Calendar {...props} maxDate={d(24)} />);
        expect(screen.getByTestId("review-dragging")).toHaveTextContent("idle");
        release(mode);
        expect(onEventDrop).not.toHaveBeenCalled();

        // Expanding the limit again does not revive the cancelled move.
        rerender(<Calendar {...props} />);
        beginMove(mode, distance, steps);
        release(mode);
        expect(onEventDrop).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ newEnd: d(25, 10), newStart: d(25, 9) }),
        );
      },
    );

    it.each(modes)("cancels a %s move when its event is removed", (mode) => {
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
        700,
      );
      const onEventDrop = vi.fn();
      const props: CalendarProps = {
        events: [review, other],
        initialDate: d(24),
        initialView: view,
        onEventClick: vi.fn(),
        onEventDrop,
        renderEvent,
      };
      const { rerender } = render(<Calendar {...props} />);
      beginMove(mode, distance, steps);
      rerender(<Calendar {...props} events={[other]} />);
      expect(tile("Other")).not.toHaveClass("pointer-events-none");
      fireEvent.pointerUp(document);

      // Restoring the event cannot commit the removed one's old session.
      rerender(<Calendar {...props} />);
      expect(screen.getByTestId("review-dragging")).toHaveTextContent("idle");
      release(mode);
      expect(onEventDrop).not.toHaveBeenCalled();
    });

    it.each(modes)(
      "keeps a %s move through a refetch of equal times and uses the current event",
      (mode) => {
        vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
          700,
        );
        const onEventDrop = vi.fn();
        const props: CalendarProps = {
          events: [review],
          initialDate: d(24),
          initialView: view,
          onEventClick: vi.fn(),
          onEventDrop,
          renderEvent,
        };
        const { rerender } = render(<Calendar {...props} />);
        beginMove(mode, distance, steps);
        const refreshed = {
          ...review,
          end: new Date(review.end),
          start: new Date(review.start),
          description: "Updated by a refetch",
        };
        const onLatestDrop = vi.fn();
        rerender(
          <Calendar
            {...props}
            events={[refreshed]}
            onEventDrop={onLatestDrop}
          />,
        );
        expect(screen.getByTestId("review-dragging")).toHaveTextContent(
          "moving",
        );
        release(mode);
        expect(onEventDrop).not.toHaveBeenCalled();
        expect(onLatestDrop).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ event: refreshed, newStart: d(25, 9) }),
        );
        expect(onLatestDrop.mock.calls[0][0].event).toBe(refreshed);
      },
    );

    it.each(modes)(
      "clears a %s move when Activity hides and shows the calendar",
      async (mode) => {
        vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
          700,
        );
        const onEventClick = vi.fn();
        const onEventDrop = vi.fn();
        const calendar = (
          <Calendar
            events={[review, other]}
            initialDate={d(24)}
            initialView={view}
            onEventClick={onEventClick}
            onEventDrop={onEventDrop}
            renderEvent={renderEvent}
          />
        );
        const { rerender } = render(
          <Activity mode="visible">{calendar}</Activity>,
        );
        beginMove(mode, distance, steps);
        await act(async () =>
          rerender(<Activity mode="hidden">{calendar}</Activity>),
        );
        await act(async () =>
          rerender(<Activity mode="visible">{calendar}</Activity>),
        );

        expect(screen.getByTestId("review-dragging")).toHaveTextContent("idle");
        expect(tile("Other")).not.toHaveClass("pointer-events-none");
        release(mode);
        expect(onEventDrop).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("Other"));
        expect(onEventClick).toHaveBeenCalledWith(other);

        beginMove(mode, distance, steps);
        release(mode);
        expect(onEventDrop).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ newStart: d(25, 9) }),
        );
      },
    );
  },
);

describe("Calendar geometry and event updates during a move", () => {
  it.each([
    { update: { dayEndHour: 10 }, name: "hours" },
    { update: { slotDuration: 30 }, name: "slot size" },
    {
      update: { resources: [{ id: "a", title: "Room A" }] },
      name: "resources",
    },
    {
      update: { events: [{ ...review, resourceId: "a", start: d(24, 8) }] },
      name: "event times",
    },
    { update: { onEventDrop: undefined }, name: "disabled moving" },
  ] satisfies { update: Partial<CalendarProps>; name: string }[])(
    "cancels when $name changes after a pointer press",
    ({ update }) => {
      const onEventDrop = vi.fn();
      const props: CalendarProps = {
        events: [{ ...review, resourceId: "a" }],
        initialDate: d(24),
        initialView: "day",
        onEventDrop,
        renderEvent,
        resources: [
          { id: "a", title: "Room A" },
          { id: "b", title: "Room B" },
        ],
      };
      const { rerender } = render(<Calendar {...props} />);
      // Even a press below the threshold has a session to discard.
      fireEvent.pointerDown(tile(), press);
      rerender(<Calendar {...props} {...update} />);
      fireEvent.pointerMove(document, {
        buttons: 1,
        clientX: 400,
        clientY: 228,
      });
      fireEvent.pointerUp(document);
      expect(onEventDrop).not.toHaveBeenCalled();
      expect(screen.getByTestId("review-dragging")).toHaveTextContent("idle");
    },
  );

  it("clears the resize cursor and preview across Activity hiding", async () => {
    const onEventResize = vi.fn();
    const calendar = (
      <Calendar
        events={[review]}
        initialDate={d(24)}
        initialView="day"
        onEventResize={onEventResize}
        renderEvent={renderEvent}
      />
    );
    const { rerender } = render(<Activity mode="visible">{calendar}</Activity>);
    fireEvent.pointerDown(
      tile().querySelectorAll(".cursor-ns-resize")[1],
      press,
    );
    fireEvent.pointerMove(document, { buttons: 1, clientX: 400, clientY: 228 });
    expect(document.getElementById("calendar-resize-cursor")).not.toBeNull();

    await act(async () =>
      rerender(<Activity mode="hidden">{calendar}</Activity>),
    );
    expect(document.getElementById("calendar-resize-cursor")).toBeNull();
    await act(async () =>
      rerender(<Activity mode="visible">{calendar}</Activity>),
    );
    expect(screen.getByTestId("review-dragging")).toHaveTextContent("idle");
    fireEvent.pointerUp(document);
    expect(onEventResize).not.toHaveBeenCalled();
  });
});
