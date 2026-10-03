import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarEvent, type CalendarProps } from ".";
import { createLocale } from "../../../i18n/format";
import { en } from "../../../i18n/en";
import UIProvider from "../../../providers/ui-provider";

/** A day of September 2026 - the 24th is a Thursday. */
const d = (day: number, hours = 0, minutes = 0) =>
  new Date(2026, 8, day, hours, minutes);

const event = (title: string, start: Date, end: Date): CalendarEvent => ({
  end,
  id: title,
  start,
  title,
});

/** A press of the primary mouse button. */
const press = { clientX: 400, clientY: 100, isPrimary: true };

/** Presses and moves the pointer by the given pixels - without letting go. */
function pressAndMove(target: Element, deltaY: number, deltaX = 0) {
  fireEvent.pointerDown(target, press);
  fireEvent.pointerMove(document, {
    buttons: 1,
    clientX: 400 + deltaX,
    clientY: 100 + deltaY,
  });
}

/** Drags from the press point by the given pixels and lets go. */
function drag(target: Element, deltaY: number, deltaX = 0) {
  pressAndMove(target, deltaY, deltaX);
  fireEvent.pointerUp(document);
}

/** The top and bottom resize handles of a tile. */
const handles = (tile: HTMLElement) => {
  const [top, bottom] = tile.querySelectorAll(".cursor-ns-resize");
  return { bottom, top };
};

/** The half-hour rows of a day column of the week view (Sunday first). */
const weekSlots = (container: HTMLElement, dayIndex: number) =>
  container
    .querySelectorAll(".day-column")
    [dayIndex].querySelectorAll<HTMLElement>(":scope > .h-16");

const change = (newStart: Date, newEnd: Date) =>
  expect.objectContaining({ newEnd, newStart });

/** Lets the task that ends a drag finish. */
const nextTask = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve)));

describe("Calendar resizing", () => {
  it("changes only the dragged edge, not a part out of view", () => {
    const onEventResize = vi.fn();
    render(
      <Calendar
        events={[event("Late", d(24, 20), d(24, 23))]}
        initialDate={d(24)}
        initialView="day"
        onEventResize={onEventResize}
      />,
    );

    // The end is out of view past 22:00 - dragging down past the grid
    // keeps it
    drag(handles(screen.getByTitle("Late")).bottom, 500);
    expect(onEventResize).not.toHaveBeenCalled();

    // An hour up from the edge drawn at 22:00
    drag(handles(screen.getByTitle("Late")).bottom, -128);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 20), d(24, 21)),
    );

    // The top edge leaves the end alone
    drag(handles(screen.getByTitle("Late")).top, -128);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 19), d(24, 23)),
    );
  });

  it("keeps a start out of view when its edge is dragged above the grid", () => {
    const onEventResize = vi.fn();
    render(
      <Calendar
        events={[event("Early", d(24, 6), d(24, 9))]}
        initialDate={d(24)}
        initialView="day"
        onEventResize={onEventResize}
      />,
    );

    drag(handles(screen.getByTitle("Early")).top, -300);
    expect(onEventResize).not.toHaveBeenCalled();

    // From the top of the grid (7:00) an hour down
    drag(handles(screen.getByTitle("Early")).top, 128);
    expect(onEventResize).toHaveBeenLastCalledWith(change(d(24, 8), d(24, 9)));
  });

  it("keeps the minimum length", () => {
    const onEventResize = vi.fn();
    render(
      <Calendar
        events={[event("Short", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
        onEventResize={onEventResize}
      />,
    );

    drag(handles(screen.getByTitle("Short")).bottom, -1000);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 9), d(24, 9, 15)),
    );
  });
});

describe("Calendar moving", () => {
  it("moves an event to another day with its time, also out of view", () => {
    // jsdom has no layout - 100px per day column
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(700);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Early", d(24, 6), d(24, 8))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    drag(screen.getByTitle("Early"), 0, 100);
    expect(onEventDrop).toHaveBeenLastCalledWith(change(d(25, 6), d(25, 8)));
  });

  it("keeps the length of an event moved against the day hours", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Long", d(24, 8), d(24, 21, 30))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    // An hour down - only the half hour left to 22:00 fits
    drag(screen.getByTitle("Long"), 128);
    expect(onEventDrop).toHaveBeenLastCalledWith(
      change(d(24, 8, 30), d(24, 22)),
    );

    // Far up - to the start hour
    drag(screen.getByTitle("Long"), -1000);
    expect(onEventDrop).toHaveBeenLastCalledWith(
      change(d(24, 7), d(24, 20, 30)),
    );
  });

  it("moves an event longer than the day hours by nothing up or down", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("All day long", d(24, 6), d(24, 23))]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={onEventDrop}
      />,
    );

    drag(screen.getByTitle("All day long"), 256);
    drag(screen.getByTitle("All day long"), -256);
    expect(onEventDrop).not.toHaveBeenCalled();
  });

  it("drops nothing when the browser cancels the pointer", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={onEventDrop}
      />,
    );

    pressAndMove(screen.getByTitle("Review"), 128);
    fireEvent.pointerCancel(document);
    expect(onEventDrop).not.toHaveBeenCalled();
  });

  it("lays out overlapping tiles by where an event is dragged to", () => {
    render(
      <Calendar
        events={[
          event("A", d(24, 9), d(24, 10)),
          event("B", d(24, 12), d(24, 13)),
        ]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={() => {}}
      />,
    );

    expect(screen.getByTitle("A")).toHaveStyle({
      insetInlineStart: "calc(0% + 2px)",
    });
    expect(screen.getByTitle("B")).toHaveStyle({
      insetInlineStart: "calc(0% + 2px)",
    });

    // B dragged over A - three hours up
    pressAndMove(screen.getByTitle("B"), -384);
    const lefts = ["A", "B"].map(
      (title) => screen.getByTitle(title).style.insetInlineStart,
    );
    expect(lefts).toContain("calc(50% + 2px)");
    fireEvent.pointerUp(document);
  });

  it("lets a finger drag the tiles, but scroll over the slots", () => {
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={() => {}}
        onEventResize={() => {}}
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    const tile = screen.getByTitle("Review");
    expect(tile).toHaveClass("touch-none");
    expect(handles(tile).top).toHaveClass("touch-none");

    const slot = weekSlots(container, 4)[10];
    fireEvent.pointerDown(slot, { ...press, pointerType: "touch" });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 300 });
    fireEvent.pointerUp(document);
    expect(onSlotDragEnd).not.toHaveBeenCalled();
  });
});

describe("Calendar clicks after a drag", () => {
  it("does not swallow the next click when the drag ends elsewhere", async () => {
    const onEventClick = vi.fn();
    render(
      <Calendar
        events={[
          event("Review", d(24, 9), d(24, 10)),
          event("Night shift", d(24, 20), d(25, 6)),
        ]}
        dayEndHour={24}
        initialDate={d(24)}
        initialView="day"
        onEventClick={onEventClick}
        onEventDrop={() => {}}
      />,
    );

    // The release lands elsewhere - no click on the tile follows
    drag(screen.getByTitle("Review"), 128);
    await nextTask();

    // A tile that cannot be dragged - its press starts no drag
    fireEvent.click(screen.getByTitle("Night shift"));
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it("does not swallow the next slot click after a slot drag", async () => {
    const onDateClick = vi.fn();
    const onSlotDragEnd = vi.fn();
    render(
      <Calendar
        initialDate={d(24)}
        initialView="day"
        onDateClick={onDateClick}
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    const rows = document.querySelectorAll<HTMLElement>(
      ".day-view .relative > .h-32",
    );
    drag(rows[2], 200);
    expect(onSlotDragEnd).toHaveBeenCalledTimes(1);
    await nextTask();

    // An assistive click - no press before it
    fireEvent.click(rows[4]);
    expect(onDateClick).toHaveBeenCalledWith(d(24, 11));
  });
});

describe("Calendar slot ranges", () => {
  it("ends a range from the end hour row by the end hour", () => {
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        initialDate={d(24)}
        initialView="week"
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    // The 22:00 row of Thursday - the last slot before it is 21:30
    const slots = weekSlots(container, 4);
    drag(slots[slots.length - 1], 200);
    expect(onSlotDragEnd).toHaveBeenLastCalledWith({
      end: d(24, 22),
      start: d(24, 21, 30),
    });
  });
});

describe("Calendar navigation", () => {
  it("stays within the next month from its last days", async () => {
    const user = userEvent.setup();
    render(<Calendar initialDate={new Date(2026, 0, 31)} />);

    const date = screen.getByRole("combobox", { name: "Go to date" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(date).toHaveValue("02/28/2026");
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(date).toHaveValue("01/28/2026");
  });
});

/** Moves the pressed pointer to the given pixels from the press point. */
const moveTo = (deltaY: number, deltaX = 0) =>
  fireEvent.pointerMove(document, {
    buttons: 1,
    clientX: 400 + deltaX,
    clientY: 100 + deltaY,
  });

describe("Calendar event actions", () => {
  it("runs an action of a draggable event - a wobbly press moves nothing", () => {
    const onAction = vi.fn();
    const onEventClick = vi.fn();
    const onEventDrop = vi.fn();
    const setPointerCapture = vi.fn();
    Element.prototype.setPointerCapture = setPointerCapture;
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={onEventClick}
        onEventDrop={onEventDrop}
        renderEventActions={(item) => (
          <button onClick={() => onAction(item.id)} type="button">
            Delete {item.title}
          </button>
        )}
      />,
    );

    const action = screen.getByRole("button", { name: "Delete Review" });
    drag(action, 40);
    fireEvent.click(action);
    delete (Element.prototype as Partial<Element>).setPointerCapture;

    // The tile took no pointer capture - a browser would send it the click
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(onEventDrop).not.toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith("Review");
    expect(onEventClick).not.toHaveBeenCalled();
  });

  it("starts no drag on a link of the title", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[
          {
            ...event("Review", d(24, 9), d(24, 10)),
            htmlTitle: 'Review <a href="https://example.com/doc">doc</a>',
          },
        ]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    drag(screen.getByRole("link", { name: "doc" }), 64);
    expect(onEventDrop).not.toHaveBeenCalled();
  });
});

describe("Calendar drag gestures", () => {
  it("follows only the pointer that pressed - not a second finger", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    const finger = { pointerId: 1, pointerType: "touch" };
    fireEvent.pointerDown(screen.getByTitle("Review"), { ...press, ...finger });
    fireEvent.pointerMove(document, {
      ...finger,
      buttons: 1,
      clientX: 400,
      clientY: 164,
    });
    // A second finger moves and lifts
    fireEvent.pointerMove(document, {
      buttons: 1,
      clientX: 400,
      clientY: 700,
      pointerId: 2,
    });
    fireEvent.pointerUp(document, { pointerId: 2 });
    expect(onEventDrop).not.toHaveBeenCalled();

    fireEvent.pointerUp(document, finger);
    expect(onEventDrop).toHaveBeenCalledWith(
      change(d(24, 9, 30), d(24, 10, 30)),
    );
  });

  it("counts scrolling during a drag as moving over the slots", () => {
    const onEventDrop = vi.fn();
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    // jsdom has no layout - the grid moves up as the view scrolls
    const grid = container.querySelector(".day-column")!.parentElement!;
    let gridTop = 0;
    vi.spyOn(grid, "getBoundingClientRect").mockImplementation(
      () => ({ bottom: 0, left: 0, right: 0, top: gridTop }) as DOMRect,
    );
    const scroll = (top: number) => {
      gridTop = -top;
      fireEvent.scroll(container.querySelector(".week-view")!);
    };

    // An hour down, then the wheel scrolls 256px - the pointer is over 11:30
    pressAndMove(screen.getByTitle("Review"), 64);
    scroll(256);
    fireEvent.pointerUp(document);
    expect(onEventDrop).toHaveBeenCalledWith(
      change(d(24, 11, 30), d(24, 12, 30)),
    );

    // A range too - from 12:00 of Thursday
    scroll(0);
    pressAndMove(weekSlots(container, 4)[10], 64);
    scroll(128);
    fireEvent.pointerUp(document);
    expect(onSlotDragEnd).toHaveBeenCalledWith({
      end: d(24, 14),
      start: d(24, 12),
    });
  });

  it("takes a press that leaves the event where it was for a click", () => {
    const onEventClick = vi.fn();
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={onEventClick}
        onEventDrop={onEventDrop}
      />,
    );

    // Past the threshold of a drag, but not to another slot
    const tile = screen.getByTitle("Review");
    drag(tile, 20);
    fireEvent.click(tile);

    expect(onEventDrop).not.toHaveBeenCalled();
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it("drops at the last move before the release", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="day"
        onEventDrop={onEventDrop}
      />,
    );

    pressAndMove(screen.getByTitle("Review"), 128);
    // Another move and the release before React renders
    act(() => {
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          buttons: 1,
          clientX: 400,
          clientY: 100 + 256,
        }),
      );
      document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });

    expect(onEventDrop).toHaveBeenCalledWith(change(d(24, 11), d(24, 12)));
  });

  it("renders a drag only when the event gets to another slot", () => {
    const onRender = vi.fn();
    render(
      <Profiler id="calendar" onRender={onRender}>
        <Calendar
          events={[event("Review", d(24, 9), d(24, 10))]}
          initialDate={d(24)}
          initialView="week"
          onEventResize={() => {}}
        />
      </Profiler>,
    );

    fireEvent.pointerDown(handles(screen.getByTitle("Review")).bottom, press);
    moveTo(40);
    const cursorStyle = document.getElementById("calendar-resize-cursor");
    expect(cursorStyle).not.toBeNull();

    // Within the slot of 10:30
    onRender.mockClear();
    moveTo(50);
    moveTo(60);
    expect(onRender).not.toHaveBeenCalled();

    moveTo(100);
    expect(onRender).toHaveBeenCalledTimes(1);
    // The resize cursor stays for the whole drag
    expect(document.getElementById("calendar-resize-cursor")).toBe(cursorStyle);

    fireEvent.pointerUp(document);
    expect(document.getElementById("calendar-resize-cursor")).toBeNull();
  });
});

describe("Calendar cancelled drags", () => {
  it("puts a moved event back on Escape and swallows only its click", async () => {
    const onEventClick = vi.fn();
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={onEventClick}
        onEventDrop={onEventDrop}
      />,
    );

    pressAndMove(screen.getByTitle("Review"), 128);
    expect(screen.getByTitle("Review")).toHaveStyle({ top: "384px" });

    const escape = createEvent.keyDown(document, { key: "Escape" });
    fireEvent(document, escape);
    // Only the drag is cancelled - not a Dialog around
    expect(escape.defaultPrevented).toBe(true);
    expect(screen.getByTitle("Review")).toHaveStyle({ top: "256px" });

    // The release and its click do nothing
    moveTo(256);
    fireEvent.pointerUp(document);
    fireEvent.click(screen.getByTitle("Review"));
    expect(onEventDrop).not.toHaveBeenCalled();
    expect(onEventClick).not.toHaveBeenCalled();

    // The next click is one again
    await nextTask();
    fireEvent.click(screen.getByTitle("Review"));
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it("cancels a resize and a range on Escape", () => {
    const onEventResize = vi.fn();
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventResize={onEventResize}
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    pressAndMove(handles(screen.getByTitle("Review")).bottom, 128);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerUp(document);
    expect(onEventResize).not.toHaveBeenCalled();
    expect(document.getElementById("calendar-resize-cursor")).toBeNull();

    pressAndMove(weekSlots(container, 4)[12], 128);
    expect(container.querySelector(".border-dashed")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector(".border-dashed")).toBeNull();
    fireEvent.pointerUp(document);
    expect(onSlotDragEnd).not.toHaveBeenCalled();
  });

  it("starts no drag on the Ctrl + click that opens the context menu of a Mac", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    );
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    fireEvent.pointerDown(screen.getByTitle("Review"), {
      ...press,
      ctrlKey: true,
    });
    moveTo(128);
    fireEvent.pointerUp(document);
    expect(onEventDrop).not.toHaveBeenCalled();
  });

  it("lets go of the pointer on Escape - also when its release gets lost", () => {
    const onEventClick = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventClick={onEventClick}
        onEventDrop={() => {}}
      />,
    );

    pressAndMove(screen.getByTitle("Review"), 128);
    const removeListener = vi.spyOn(document, "removeEventListener");
    fireEvent.keyDown(document, { key: "Escape" });
    // No listeners of the drag wait for the release - an unmount before it
    // leaves none behind
    expect(removeListener).toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function),
    );

    // The release went elsewhere - the next click is one
    fireEvent.pointerMove(document, { buttons: 0, clientX: 400, clientY: 400 });
    fireEvent.pointerUp(document);
    fireEvent.click(screen.getByTitle("Review"));
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it("ends a drag whose release got lost, e.g. to a context menu", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9), d(24, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
      />,
    );

    // A move without a pressed button - the release went elsewhere
    pressAndMove(screen.getByTitle("Review"), 128);
    fireEvent.pointerMove(document, { buttons: 0, clientX: 400, clientY: 400 });
    expect(screen.getByTitle("Review")).toHaveStyle({ top: "256px" });
    fireEvent.pointerUp(document);

    // A context menu opening during a drag
    pressAndMove(screen.getByTitle("Review"), 128);
    fireEvent.contextMenu(document);
    fireEvent.pointerUp(document);

    expect(onEventDrop).not.toHaveBeenCalled();
  });
});

describe("Calendar edges of events", () => {
  it("resizes by whole slots from where the edge is", () => {
    const onEventResize = vi.fn();
    render(
      <Calendar
        events={[event("Review", d(24, 9, 10), d(24, 10, 10))]}
        initialDate={d(24)}
        initialView="week"
        onEventResize={onEventResize}
      />,
    );

    // A few pixels move neither edge - least of all the wrong way
    drag(handles(screen.getByTitle("Review")).bottom, 10);
    drag(handles(screen.getByTitle("Review")).top, 10);
    expect(onEventResize).not.toHaveBeenCalled();

    drag(handles(screen.getByTitle("Review")).bottom, 64);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 9, 10), d(24, 10, 40)),
    );
    drag(handles(screen.getByTitle("Review")).top, -64);
    expect(onEventResize).toHaveBeenLastCalledWith(
      change(d(24, 8, 40), d(24, 10, 10)),
    );
  });

  it("shows events without a length and keeps short ones grabbable", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[
          event("Reminder", d(24, 7), d(24, 7)),
          event("Call", d(24, 9), d(24, 9, 5)),
        ]}
        initialDate={d(24)}
        initialView="week"
        onEventDrop={onEventDrop}
        onEventResize={() => {}}
      />,
    );

    // At the start hour - the top of the grid
    expect(screen.getByTitle("Reminder")).toHaveStyle({
      height: "24px",
      top: "0px",
    });

    const call = screen.getByTitle("Call");
    expect(call).toHaveStyle({ height: "24px" });
    // Thin handles leave the middle of the tile to grab
    expect(handles(call).top).toHaveClass("h-1");
    expect(handles(call).bottom).toHaveClass("h-1");

    drag(call, 64);
    expect(onEventDrop).toHaveBeenCalledWith(
      change(d(24, 9, 30), d(24, 9, 35)),
    );
  });

  it("lays out a crowded hour in columns", () => {
    render(
      <Calendar
        events={["A", "B", "C", "D", "E", "F"].map((title) =>
          event(title, d(24, 9), d(24, 10)),
        )}
        initialDate={d(24)}
        initialView="day"
      />,
    );

    for (const [column, title] of ["A", "B", "C", "D", "E", "F"].entries()) {
      expect(screen.getByTitle(title)).toHaveStyle({
        insetInlineStart: `calc(${(column * 100) / 6}% + 2px)`,
        width: `calc(${100 / 6}% - 4px)`,
      });
    }
  });
});

describe("Calendar disabled days", () => {
  it("moves and resizes no events of a disabled day in the week view", () => {
    // jsdom has no layout - 100px per day column
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(700);
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Monday", d(21, 9), d(21, 10))]}
        initialDate={d(24)}
        initialView="week"
        minDate={d(23, 12)}
        onEventDrop={onEventDrop}
        onEventResize={() => {}}
      />,
    );

    const tile = screen.getByTitle("Monday");
    expect(tile.querySelector(".cursor-ns-resize")).toBeNull();
    drag(tile, 64);
    drag(tile, 0, 300);
    expect(onEventDrop).not.toHaveBeenCalled();
  });

  it("moves and resizes no events of a disabled day in the day view", () => {
    const onEventDrop = vi.fn();
    render(
      <Calendar
        events={[event("Monday", d(21, 9), d(21, 10))]}
        initialDate={d(21)}
        initialView="day"
        maxDate={d(20)}
        onEventDrop={onEventDrop}
        onEventResize={() => {}}
      />,
    );

    const tile = screen.getByTitle("Monday");
    expect(tile.querySelector(".cursor-ns-resize")).toBeNull();
    drag(tile, 128);
    expect(onEventDrop).not.toHaveBeenCalled();
  });
});

describe("Calendar ranges upward", () => {
  it("picks the slots from the pressed one up to the pointer", () => {
    const onSlotDragEnd = vi.fn();
    const { container } = render(
      <Calendar
        initialDate={d(24)}
        initialView="week"
        onSlotDragEnd={onSlotDragEnd}
      />,
    );

    // From 10:00 of Thursday up to 8:00
    drag(weekSlots(container, 4)[6], -256);
    expect(onSlotDragEnd).toHaveBeenLastCalledWith({
      end: d(24, 10, 30),
      start: d(24, 8),
    });

    // Far above the grid - from the start hour
    drag(weekSlots(container, 4)[6], -2000);
    expect(onSlotDragEnd).toHaveBeenLastCalledWith({
      end: d(24, 10, 30),
      start: d(24, 7),
    });
  });
});

// The rows of the grid are clock times - on the days the clocks change,
// a row is not 30 minutes of absolute time around the change
describe.each([
  {
    fallBack: [2026, 9, 25],
    repeatedHour: 2,
    springForward: [2026, 2, 29],
    timeZone: "Europe/Prague",
  },
  {
    fallBack: [2026, 10, 1],
    repeatedHour: 1,
    springForward: [2026, 2, 8],
    timeZone: "America/New_York",
  },
])(
  "Calendar over a daylight saving change ($timeZone)",
  ({ fallBack, repeatedHour, springForward, timeZone }) => {
    let previousTZ: string | undefined;

    beforeAll(() => {
      previousTZ = process.env.TZ;
      process.env.TZ = timeZone;
    });

    afterAll(() => {
      if (previousTZ === undefined) delete process.env.TZ;
      else process.env.TZ = previousTZ;
    });

    it.each([
      ["forward", springForward],
      ["back", fallBack],
    ])(
      "moves an event by rows of the clock when the clocks go %s",
      (_, [year, month, day]) => {
        const at = (hours: number, minutes = 0) =>
          new Date(year, month, day, hours, minutes);
        const onEventDrop = vi.fn();
        render(
          <Calendar
            dayStartHour={0}
            events={[event("Night", at(1), at(1, 30))]}
            initialDate={at(12)}
            initialView="week"
            onEventDrop={onEventDrop}
          />,
        );

        // Four rows down from 1:00
        drag(screen.getByTitle("Night"), 256);
        const { newEnd, newStart } = onEventDrop.mock.calls[0][0];
        expect([newStart.getHours(), newStart.getMinutes()]).toEqual([3, 0]);
        expect([newEnd.getHours(), newEnd.getMinutes()]).toEqual([3, 30]);
      },
    );

    it("moves an event into the skipped hour with its length", () => {
      const [year, month, day] = springForward;
      const at = (hours: number, minutes = 0) =>
        new Date(year, month, day, hours, minutes);
      const onEventDrop = vi.fn();
      render(
        <Calendar
          dayStartHour={0}
          events={[event("Night", at(1), at(1, 30))]}
          initialDate={at(12)}
          initialView="week"
          onEventDrop={onEventDrop}
        />,
      );

      // Two rows down from 1:00 - to 2:00, which is 3:00
      drag(screen.getByTitle("Night"), 128);
      const { newEnd, newStart } = onEventDrop.mock.calls[0][0];
      expect([newStart.getHours(), newStart.getMinutes()]).toEqual([3, 0]);
      expect(newEnd.getTime() - newStart.getTime()).toBe(30 * 60_000);
    });

    it.each([
      { initialView: "day", offset: 0, deltaX: 0, seconds: 0 },
      { initialView: "week", offset: 0, deltaX: 0, seconds: 0 },
      { initialView: "week", offset: -2, deltaX: 200, seconds: 0 },
      { initialView: "week", offset: 0, deltaX: 0, seconds: 30 },
    ] as const)(
      "stops a move at the end hour after a skipped hour ($initialView, day $offset, $seconds seconds)",
      ({ initialView, offset, deltaX, seconds }) => {
        const [year, month, day] = springForward;
        const at = (offset: number, hours: number, minutes = 0, seconds = 0) =>
          new Date(year, month, day + offset, hours, minutes, seconds);
        vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
          700,
        );
        const onEventDrop = vi.fn();
        render(
          <UIProvider locale={createLocale(en, { weekStartsOn: 1 })}>
            <Calendar
              dayEndHour={3}
              dayStartHour={0}
              events={[
                event(
                  "Night",
                  at(offset, 1, 0, seconds),
                  at(offset, 1, 30, seconds),
                ),
              ]}
              initialDate={at(0, 12)}
              initialView={initialView}
              onEventDrop={onEventDrop}
              slotDuration={30}
            />
          </UIProvider>,
        );

        // Three rows down request 2:30, which resolves to 3:00. The
        // thirty-minute event must stop at the last start that still fits.
        drag(screen.getByTitle("Night"), 192, deltaX);
        expect(onEventDrop).toHaveBeenCalledOnce();
        expect(onEventDrop).toHaveBeenLastCalledWith(
          change(at(0, 1, 30), at(0, 3)),
        );
      },
    );

    it("stops a move at the end hour after a repeated hour", () => {
      const [year, month, day] = fallBack;
      const at = (hours: number) => new Date(year, month, day, hours);
      const onEventDrop = vi.fn();
      render(
        <Calendar
          dayEndHour={4}
          dayStartHour={0}
          events={[event("Night", at(repeatedHour), at(3))]}
          initialDate={at(12)}
          initialView="week"
          onEventDrop={onEventDrop}
        />,
      );

      // After the repeated hour the same absolute duration takes more
      // clock rows. The last fitting start is its second occurrence.
      drag(screen.getByTitle("Night"), 128);
      expect(onEventDrop).toHaveBeenCalledOnce();
      expect(onEventDrop).toHaveBeenLastCalledWith(
        change(new Date(at(repeatedHour).getTime() + 3_600_000), at(4)),
      );
    });

    it("keeps an already clipped end in the second run of a repeated hour", () => {
      const [year, month, day] = fallBack;
      const at = (hours: number, minutes = 0) =>
        new Date(year, month, day, hours, minutes);
      const onEventDrop = vi.fn();
      render(
        <Calendar
          dayEndHour={repeatedHour}
          dayStartHour={0}
          events={[
            event(
              "Night",
              at(repeatedHour - 1, 30),
              new Date(at(repeatedHour, 30).getTime() + 3_600_000),
            ),
          ]}
          initialDate={at(12)}
          initialView="week"
          onEventDrop={onEventDrop}
        />,
      );

      // One row up keeps the original duration, without snapping the end
      // from the second run of the repeated hour to its first one.
      drag(screen.getByTitle("Night"), -64);
      expect(onEventDrop).toHaveBeenCalledOnce();
      expect(onEventDrop).toHaveBeenLastCalledWith(
        change(
          at(repeatedHour - 1),
          new Date(at(repeatedHour).getTime() + 3_600_000),
        ),
      );
    });

    it.each([
      { endHour: 3, seconds: 0 },
      { endHour: 4, seconds: 0 },
      { endHour: 4, seconds: 30 },
    ])(
      "moves an event from a longer day only when it fits before $endHour:00 ($seconds seconds)",
      ({ endHour, seconds }) => {
        const [year, month, day] = fallBack;
        const at = (offset: number, hours: number, seconds = 0) =>
          new Date(year, month, day + offset, hours, 0, seconds);
        vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
          700,
        );
        const onEventDrop = vi.fn();
        render(
          <UIProvider locale={createLocale(en, { weekStartsOn: 0 })}>
            <Calendar
              dayEndHour={endHour}
              dayStartHour={0}
              events={[event("Night", at(0, 0, seconds), at(0, 3, seconds))]}
              initialDate={at(0, 12)}
              initialView="week"
              onEventDrop={onEventDrop}
            />
          </UIProvider>,
        );

        // The original day includes the repeated hour: 0:00–3:00 is
        // four hours, which needs 0:00–4:00 on the following day.
        drag(screen.getByTitle("Night"), 0, 100);
        if (endHour === 3) {
          expect(onEventDrop).not.toHaveBeenCalled();
        } else {
          expect(onEventDrop).toHaveBeenCalledOnce();
          expect(onEventDrop).toHaveBeenLastCalledWith(
            change(at(1, 0), at(1, 4)),
          );
        }
      },
    );

    it("preserves seconds of already clipped edges when moving to another day", () => {
      const [year, month, day] = fallBack;
      const at = (offset: number, hours: number, seconds = 0) =>
        new Date(year, month, day + offset, hours, 0, seconds);
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
        700,
      );
      const onEventDrop = vi.fn();
      render(
        <UIProvider locale={createLocale(en, { weekStartsOn: 0 })}>
          <Calendar
            events={[event("Long", at(1, 6, 30), at(1, 23, 30))]}
            initialDate={at(0, 12)}
            initialView="week"
            onEventDrop={onEventDrop}
          />
        </UIProvider>,
      );

      // Both days have ordinary hours, and the original event already
      // extends past both edges of the grid. A sideways move keeps them.
      drag(screen.getByTitle("Long"), 0, 100);
      expect(onEventDrop).toHaveBeenCalledOnce();
      expect(onEventDrop).toHaveBeenLastCalledWith(
        change(at(2, 6, 30), at(2, 23, 30)),
      );
    });

    it.each([
      ["forward", springForward],
      ["back", fallBack],
    ])(
      "bounds a clipped timeline start by clock slots when the clocks go %s",
      (_, [year, month, day]) => {
        const at = (hours: number, minutes = 0) =>
          new Date(year, month, day, hours, minutes);
        const start = at(1);
        const end = at(8);
        const onEventDrop = vi.fn();
        render(
          <Calendar
            events={[event("Night", start, end)]}
            initialDate={at(12)}
            initialView="timelineDay"
            maxDate={at(0)}
            minDate={at(0)}
            onEventDrop={onEventDrop}
            slotDuration={30}
          />,
        );

        drag(screen.getByTitle("Night"), 0, -4000);
        expect(onEventDrop).not.toHaveBeenCalled();

        drag(screen.getByTitle("Night"), 0, 4000);
        const { newEnd, newStart } = onEventDrop.mock.calls[0][0];
        expect(newStart).toEqual(at(21, 30));
        expect(newEnd.getTime() - newStart.getTime()).toBe(
          end.getTime() - start.getTime(),
        );
      },
    );

    it("preserves a clipped start in the second repeated hour at the lower bound", () => {
      const [year, month, day] = fallBack;
      const start = new Date(
        new Date(year, month, day, repeatedHour, 30).getTime() + 3_600_000,
      );
      const onEventDrop = vi.fn();
      render(
        <Calendar
          events={[event("Night", start, new Date(year, month, day, 8))]}
          initialDate={start}
          initialView="timelineDay"
          maxDate={start}
          minDate={start}
          onEventDrop={onEventDrop}
        />,
      );

      drag(screen.getByTitle("Night"), 0, -4000);
      expect(onEventDrop).not.toHaveBeenCalled();
    });

    it.each([
      { distance: 128, initialView: "week", selector: ".cursor-ns-resize" },
      {
        distance: 96,
        initialView: "timelineDay",
        selector: ".cursor-ew-resize",
      },
      {
        distance: 40,
        initialView: "timelineWeek",
        selector: ".cursor-ew-resize",
      },
    ] as const)(
      "resizes the start into the skipped hour to no empty event ($initialView)",
      ({ distance, initialView, selector }) => {
        const [year, month, day] = springForward;
        const at = (hours: number, minutes = 0) =>
          new Date(year, month, day, hours, minutes);
        const onEventResize = vi.fn();
        render(
          <Calendar
            dayEndHour={6}
            dayStartHour={0}
            events={[event("Night", at(1, 30), at(3))]}
            initialDate={at(12)}
            initialView={initialView}
            onEventResize={onEventResize}
          />,
        );

        // An hour later by the clock - the skipped 2:30 resolves to the end
        const startHandle = screen
          .getByTitle("Night")
          .querySelectorAll(selector)[0];
        drag(
          startHandle,
          initialView === "week" ? distance : 0,
          initialView === "week" ? 0 : distance,
        );
        expect(onEventResize).toHaveBeenCalledOnce();
        const { newEnd, newStart } = onEventResize.mock.calls[0][0];
        expect(newEnd).toEqual(at(3));
        // The shortest length before the end
        expect(newEnd.getTime() - newStart.getTime()).toBe(15 * 60_000);
      },
    );

    it.each([
      { distance: 128, initialView: "week", selector: ".cursor-ns-resize" },
      {
        distance: 96,
        initialView: "timelineDay",
        selector: ".cursor-ew-resize",
      },
      {
        distance: 40,
        initialView: "timelineWeek",
        selector: ".cursor-ew-resize",
      },
    ] as const)(
      "resizes the end in the repeated hour to no negative length ($initialView)",
      ({ distance, initialView, selector }) => {
        const [year, month, day] = fallBack;
        // The half past in the second run of the hour
        const start = new Date(
          new Date(year, month, day, repeatedHour, 30).getTime() + 3_600_000,
        );
        const onEventResize = vi.fn();
        render(
          <Calendar
            dayEndHour={6}
            dayStartHour={0}
            events={[
              event("Night", start, new Date(start.getTime() + 3_600_000)),
            ]}
            initialDate={start}
            initialView={initialView}
            onEventResize={onEventResize}
          />,
        );

        // An hour earlier by the clock - in the first run, before the start
        const endHandle = screen
          .getByTitle("Night")
          .querySelectorAll(selector)[1];
        drag(
          endHandle,
          initialView === "week" ? -distance : 0,
          initialView === "week" ? 0 : -distance,
        );
        expect(onEventResize).toHaveBeenCalledOnce();
        const { newEnd, newStart } = onEventResize.mock.calls[0][0];
        expect(newStart).toEqual(start);
        expect(newEnd.getTime() - newStart.getTime()).toBe(15 * 60_000);
      },
    );

    it("keeps a short timeline event when its start enters the skipped hour", () => {
      const [year, month, day] = springForward;
      const start = new Date(year, month, day, 1, 55);
      const onEventResize = vi.fn();
      render(
        <Calendar
          dayEndHour={6}
          dayStartHour={0}
          events={[
            event("Short", start, new Date(start.getTime() + 10 * 60_000)),
          ]}
          initialDate={start}
          initialView="timelineDay"
          onEventResize={onEventResize}
        />,
      );

      const startHandle = screen
        .getByTitle("Short")
        .querySelectorAll(".cursor-ew-resize")[0];
      drag(startHandle, 0, 96);
      expect(onEventResize).not.toHaveBeenCalled();
    });

    it("keeps a short timeline event when its end enters the earlier repeated hour", () => {
      const [year, month, day] = fallBack;
      const start = new Date(
        new Date(year, month, day, repeatedHour, 30).getTime() + 3_600_000,
      );
      const onEventResize = vi.fn();
      render(
        <Calendar
          dayEndHour={6}
          dayStartHour={0}
          events={[
            event("Short", start, new Date(start.getTime() + 10 * 60_000)),
          ]}
          initialDate={start}
          initialView="timelineDay"
          onEventResize={onEventResize}
        />,
      );

      const endHandle = screen
        .getByTitle("Short")
        .querySelectorAll(".cursor-ew-resize")[1];
      drag(endHandle, 0, -96);
      expect(onEventResize).not.toHaveBeenCalled();
    });

    it("names the rows of the skipped hour by their own time", () => {
      const [year, month, day] = springForward;
      const { container } = render(
        <Calendar
          dayStartHour={0}
          initialDate={new Date(year, month, day, 12)}
          initialView="week"
          onDateClick={() => {}}
        />,
      );

      // A Sunday - the first column
      const labels = [...weekSlots(container, 0)]
        .slice(4, 7)
        .map((slot) => slot.getAttribute("aria-label"));
      expect(labels[0]).toMatch(/ 2:00\sAM$/);
      expect(labels[1]).toMatch(/ 2:30\sAM$/);
      expect(labels[2]).toMatch(/ 3:00\sAM$/);
    });

    it("lays out events at the same clock time side by side", () => {
      const [year, month, day] = fallBack;
      // The same quarter past twice - before the clocks go back and after
      const first = new Date(year, month, day, repeatedHour, 15);
      const second = new Date(first.getTime() + 3_600_000);
      expect([second.getHours(), second.getMinutes()]).toEqual([
        repeatedHour,
        15,
      ]);

      const halfHourFrom = (start: Date) =>
        new Date(start.getTime() + 30 * 60_000);
      render(
        <Calendar
          dayStartHour={0}
          events={[
            event("Before", first, halfHourFrom(first)),
            event("After", second, halfHourFrom(second)),
          ]}
          initialDate={first}
          initialView="day"
        />,
      );

      expect(
        ["Before", "After"].map(
          (title) => screen.getByTitle(title).style.insetInlineStart,
        ),
      ).toEqual(["calc(0% + 2px)", "calc(50% + 2px)"]);
    });
  },
);

describe("Calendar slot limits after a skipped daylight saving hour", () => {
  let previousTZ: string | undefined;

  beforeAll(() => {
    previousTZ = process.env.TZ;
    process.env.TZ = "Europe/Prague";
  });

  afterAll(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  });

  const at = (hour: number, minute = 0) => new Date(2026, 2, 29, hour, minute);
  const props: CalendarProps = {
    dayEndHour: 5,
    dayStartHour: 1,
    nowIndicator: false,
    resources: [{ id: "room", title: "Room" }],
    slotDuration: 60,
  };
  const slotAt = (container: HTMLElement, time = "2:00") =>
    [...container.querySelectorAll<HTMLElement>("[data-slot]")].find((slot) => {
      const label = slot.getAttribute("aria-label") ?? "";
      return label.includes("March 29, 2026") && label.includes(` ${time}`);
    })!;
  const pointerRange = (slot: HTMLElement, x: number, y: number) => {
    const pointer = { ...press, button: 0, pointerId: 1, pointerType: "mouse" };
    fireEvent.pointerDown(slot, pointer);
    fireEvent.pointerMove(document, {
      buttons: 1,
      clientX: press.clientX + x,
      clientY: press.clientY + y,
      pointerId: 1,
    });
    fireEvent.pointerUp(document, { pointerId: 1 });
  };

  describe.each([
    { view: "day", x: 0, y: 128, arrow: "ArrowDown" },
    { view: "week", x: 0, y: 128, arrow: "ArrowDown" },
    { view: "timelineDay", x: 96, y: 0, arrow: "ArrowRight" },
    { view: "timelineWeek", x: 40, y: 0, arrow: "ArrowRight" },
  ] as const)("$view", ({ view, x, y, arrow }) => {
    const limits: { name: string; update: Partial<CalendarProps> }[] = [
      { name: "the end hour", update: { dayEndHour: 3 } },
      {
        name: "working hours ending at the gap",
        update: {
          businessHours: { days: [0], start: "02:00", end: "03:00" },
          restrictToBusinessHours: true,
        },
      },
      {
        name: "a working-hours break after the gap",
        update: {
          businessHours: [
            { days: [0], start: "02:00", end: "02:30" },
            { days: [0], start: "03:30", end: "05:00" },
          ],
          restrictToBusinessHours: true,
          slotDuration: 30,
        },
      },
    ];

    describe.each(["date", "range"] as const)("%s activation", (activation) => {
      it.each(limits)(
        "cannot normalize a selection past $name",
        ({ update }) => {
          const onDateClick = vi.fn();
          const onSlotDragEnd = vi.fn();
          const { container } = render(
            <Calendar
              {...props}
              {...update}
              initialDate={at(1)}
              initialView={view}
              onDateClick={activation === "date" ? onDateClick : undefined}
              onSlotDragEnd={onSlotDragEnd}
            />,
          );
          const slot = slotAt(container);
          expect(slot).toHaveAttribute("aria-disabled", "true");

          fireEvent.click(slot);
          fireEvent.keyDown(slot, { key: "Enter" });
          fireEvent.keyDown(slot, { key: arrow, shiftKey: true });
          fireEvent.keyDown(slot, { key: "Enter" });
          pointerRange(slot, x, y);
          expect(onDateClick).not.toHaveBeenCalled();
          expect(onSlotDragEnd).not.toHaveBeenCalled();
        },
      );

      it("keeps a positive range after the gap when the limits permit it", () => {
        const onDateClick = vi.fn();
        const onSlotDragEnd = vi.fn();
        const { container } = render(
          <Calendar
            {...props}
            businessHours={{ days: [0], start: "02:00", end: "04:00" }}
            dayEndHour={4}
            initialDate={at(1)}
            initialView={view}
            onDateClick={activation === "date" ? onDateClick : undefined}
            onSlotDragEnd={onSlotDragEnd}
            restrictToBusinessHours
          />,
        );
        const slot = slotAt(container);
        const expected = { end: at(4), resourceId: "room", start: at(3) };
        expect(slot).not.toHaveAttribute("aria-disabled", "true");

        fireEvent.click(slot);
        fireEvent.keyDown(slot, { key: "Enter" });
        if (activation === "date") {
          expect(onDateClick).toHaveBeenCalledTimes(2);
          expect(onDateClick).toHaveBeenLastCalledWith(at(3), "room");
          expect(onSlotDragEnd).not.toHaveBeenCalled();
        } else {
          expect(onSlotDragEnd).toHaveBeenCalledTimes(2);
          expect(onSlotDragEnd).toHaveBeenLastCalledWith(expected);
        }
        onSlotDragEnd.mockClear();

        fireEvent.keyDown(slot, { key: arrow, shiftKey: true });
        fireEvent.keyDown(slotAt(container, "3:00"), { key: "Enter" });
        expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith(expected);
        onSlotDragEnd.mockClear();

        pointerRange(slot, x, y);
        expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith(expected);
      });
    });

    it("stops a combined skipped-row range at the last allowed whole slot", () => {
      const onSlotDragEnd = vi.fn();
      const { container } = render(
        <Calendar
          {...props}
          businessHours={{ days: [0], start: "02:00", end: "03:30" }}
          dayEndHour={4}
          initialDate={at(1)}
          initialView={view}
          onSlotDragEnd={onSlotDragEnd}
          restrictToBusinessHours
          slotDuration={30}
        />,
      );
      const slot = slotAt(container);
      const expected = { end: at(3, 30), resourceId: "room", start: at(3) };

      fireEvent.keyDown(slot, { key: arrow, shiftKey: true });
      fireEvent.keyDown(slotAt(container, "2:30"), { key: "Enter" });
      expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith(expected);
      onSlotDragEnd.mockClear();

      pointerRange(slot, x / 2, y / 2);
      expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith(expected);
    });
  });
});
