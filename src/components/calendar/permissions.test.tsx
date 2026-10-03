import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Calendar, { type EventTimeChange } from ".";

const date = (day: number, hour = 0) => new Date(2026, 8, day, hour);
const events = [
  { id: "open", title: "Editable", start: date(24, 9), end: date(24, 10) },
  { id: "locked", title: "Locked", start: date(24, 11), end: date(24, 12) },
];
const tile = (title: string) =>
  screen.getByRole("button", { name: new RegExp(`^${title},`) });

describe("Calendar event permissions", () => {
  it.each(["month", "week", "day", "timelineDay"] as const)(
    "does not move a forbidden event in %s",
    async (view) => {
      const onEventDrop = vi.fn();
      render(
        <Calendar
          onEventClick={() => {}}
          slotDuration={30}
          canMoveEvent={(event) => event.id !== "locked"}
          events={events}
          initialDate={date(24)}
          initialView={view}
          onEventDrop={onEventDrop}
        />,
      );
      tile("Locked").focus();
      await userEvent
        .setup()
        .keyboard("{Control>}x{/Control}{ArrowRight}{ArrowDown}{Enter}");
      expect(onEventDrop).not.toHaveBeenCalled();
    },
  );

  it("allows resizing independently of moving", async () => {
    const onEventDrop = vi.fn();
    const onEventResize = vi.fn();
    render(
      <Calendar
        onEventClick={() => {}}
        slotDuration={30}
        canMoveEvent={() => false}
        canResizeEvent={(event) => event.id === "open"}
        events={events}
        initialDate={date(24)}
        initialView="day"
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
      />,
    );
    tile("Editable").focus();
    await userEvent.setup().keyboard("{Control>}x{/Control}{ArrowDown}{Enter}");
    expect(onEventDrop).not.toHaveBeenCalled();
    expect(onEventResize).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ id: "open" }),
        newStart: date(24, 9),
        newEnd: new Date(2026, 8, 24, 10, 30),
      }),
    );
  });

  it("rejects destinations for keyboard moves and permits a valid destination", async () => {
    const onEventDrop = vi.fn();
    const permitted = ({ newStart }: EventTimeChange) =>
      newStart.getDate() === 23;
    render(
      <Calendar
        onEventClick={() => {}}
        slotDuration={30}
        canDropEvent={permitted}
        events={events}
        initialDate={date(24)}
        onEventDrop={onEventDrop}
      />,
    );
    const user = userEvent.setup();
    tile("Editable").focus();
    await user.keyboard("{Control>}x{/Control}{ArrowRight}{Enter}");
    expect(onEventDrop).not.toHaveBeenCalled();
    await user.keyboard("{Control>}x{/Control}{ArrowLeft}{Enter}");
    expect(onEventDrop).toHaveBeenCalledWith(
      expect.objectContaining({ newStart: date(23, 9) }),
    );
  });

  it("rechecks destination permission at keyboard commit", async () => {
    const onEventDrop = vi.fn();
    const props = { events, initialDate: date(24), onEventDrop };
    const { rerender, container } = render(
      <Calendar
        onEventClick={() => {}}
        slotDuration={30}
        {...props}
        canDropEvent={() => true}
      />,
    );
    tile("Editable").focus();
    const user = userEvent.setup();
    await user.keyboard("{Control>}x{/Control}{ArrowRight}");
    rerender(
      <Calendar
        onEventClick={() => {}}
        slotDuration={30}
        {...props}
        canDropEvent={() => false}
      />,
    );
    await user.keyboard("{Enter}");
    expect(onEventDrop).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/Editable moved to/);
  });

  it("rejects a forbidden pointer destination", () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(700);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(768);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        onEventClick={() => {}}
        slotDuration={30}
        canDropEvent={() => false}
        events={events}
        initialDate={date(24)}
        onEventDrop={onEventDrop}
      />,
    );
    fireEvent.pointerDown(
      screen.getByText("Editable").closest(".group\\/event")!,
      { clientX: 400, clientY: 100, isPrimary: true },
    );
    fireEvent.pointerMove(document, { buttons: 1, clientX: 500, clientY: 100 });
    fireEvent.pointerUp(document);
    expect(onEventDrop).not.toHaveBeenCalled();
  });
});
