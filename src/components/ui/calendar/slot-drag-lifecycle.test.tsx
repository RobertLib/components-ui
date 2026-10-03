import { act, fireEvent, render } from "@testing-library/react";
import { Activity, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarProps } from ".";

const d = (day: number, hour = 0) => new Date(2026, 8, day, hour);
const press = {
  button: 0,
  clientX: 400,
  clientY: 100,
  isPrimary: true,
  pointerId: 1,
  pointerType: "mouse",
};
const views = [
  { view: "week", slot: "4-4", x: 0, y: 64, endHour: 10 },
  { view: "day", slot: "0-2", x: 0, y: 128, endHour: 11 },
  { view: "timelineWeek", slot: "0-62", x: 40, y: 0, endHour: 11 },
] as const;

function beginRange(
  container: HTMLElement,
  slot: string,
  x: number,
  y: number,
) {
  const target = container.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
  fireEvent.pointerDown(target, press);
  fireEvent.pointerMove(document, {
    buttons: 1,
    clientX: press.clientX + x,
    clientY: press.clientY + y,
    pointerId: press.pointerId,
  });
  expect(container.querySelector(".border-dashed")).not.toBeNull();
  return target;
}

const release = () =>
  fireEvent.pointerUp(document, { pointerId: press.pointerId });

describe.each(views)(
  "Calendar slot selection lifecycle in $view",
  ({ view, slot, x, y, endHour }) => {
    it.each([
      { name: "date limits", update: { minDate: d(25) } },
      { name: "shown date", update: { currentDate: d(31) } },
      { name: "shown hours", update: { dayStartHour: 10 } },
      { name: "slot duration", update: { slotDuration: 15 } },
      {
        name: "resources",
        update: { resources: [{ id: "a", title: "Room A" }] },
      },
      {
        name: "restricted business hours",
        update: {
          businessHours: { start: "10:00", end: "17:00" },
          restrictToBusinessHours: true,
        },
      },
      { name: "selection callback", update: { onSlotDragEnd: undefined } },
    ] satisfies { name: string; update: Partial<CalendarProps> }[])(
      "cancels a range when $name change before release",
      ({ update }) => {
        const onSlotDragEnd = vi.fn();
        const props: CalendarProps = {
          currentDate: d(24),
          initialView: view,
          nowIndicator: false,
          onSlotDragEnd,
          setCurrentDate: vi.fn(),
        };
        const { container, rerender } = render(<Calendar {...props} />);
        beginRange(container, slot, x, y);

        rerender(<Calendar {...props} {...update} />);
        expect(container.querySelector(".border-dashed")).toBeNull();
        release();
        expect(onSlotDragEnd).not.toHaveBeenCalled();

        // Restoring the geometry must not revive the cancelled selection.
        rerender(<Calendar {...props} />);
        release();
        expect(onSlotDragEnd).not.toHaveBeenCalled();
        beginRange(container, slot, x, y);
        release();
        expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith({
          end: d(24, endHour),
          start: d(24, 9),
        });
      },
    );

    it("keeps equal geometry and uses the latest selection callback", () => {
      const onSlotDragEnd = vi.fn();
      const props: CalendarProps = {
        currentDate: d(24),
        initialView: view,
        nowIndicator: false,
        onSlotDragEnd,
        setCurrentDate: vi.fn(),
      };
      const { container, rerender } = render(<Calendar {...props} />);
      beginRange(container, slot, x, y);
      const onLatestRange = vi.fn();
      rerender(
        <Calendar
          {...props}
          currentDate={new Date(props.currentDate!)}
          onSlotDragEnd={onLatestRange}
        />,
      );
      expect(container.querySelector(".border-dashed")).not.toBeNull();
      release();
      expect(onSlotDragEnd).not.toHaveBeenCalled();
      expect(onLatestRange).toHaveBeenCalledExactlyOnceWith({
        end: d(24, endHour),
        start: d(24, 9),
      });
    });

    it("cancels an obsolete press before the drag threshold", () => {
      const onSlotDragEnd = vi.fn();
      const props: CalendarProps = {
        initialDate: d(24),
        initialView: view,
        nowIndicator: false,
        onSlotDragEnd,
      };
      const { container, rerender } = render(<Calendar {...props} />);
      fireEvent.pointerDown(
        container.querySelector(`[data-slot="${slot}"]`)!,
        press,
      );
      rerender(<Calendar {...props} minDate={d(25)} />);
      fireEvent.pointerMove(document, {
        buttons: 1,
        clientX: press.clientX + x,
        clientY: press.clientY + y,
        pointerId: press.pointerId,
      });
      expect(container.querySelector(".border-dashed")).toBeNull();
      release();
      expect(onSlotDragEnd).not.toHaveBeenCalled();
    });

    it("clears a selection when Activity hides and shows the view", async () => {
      const onSlotDragEnd = vi.fn();
      const calendar = (
        <Calendar
          initialDate={d(24)}
          initialView={view}
          nowIndicator={false}
          onSlotDragEnd={onSlotDragEnd}
        />
      );
      const { container, rerender } = render(
        <StrictMode>
          <Activity mode="visible">{calendar}</Activity>
        </StrictMode>,
      );
      beginRange(container, slot, x, y);
      await act(async () =>
        rerender(
          <StrictMode>
            <Activity mode="hidden">{calendar}</Activity>
          </StrictMode>,
        ),
      );
      release();
      expect(onSlotDragEnd).not.toHaveBeenCalled();
      await act(async () =>
        rerender(
          <StrictMode>
            <Activity mode="visible">{calendar}</Activity>
          </StrictMode>,
        ),
      );
      expect(container.querySelector(".border-dashed")).toBeNull();
      beginRange(container, slot, x, y);
      release();
      expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith({
        end: d(24, endHour),
        start: d(24, 9),
      });
    });
  },
);

it("releases pointer capture when a selection is invalidated", () => {
  const onSlotDragEnd = vi.fn();
  const props: CalendarProps = {
    initialDate: d(24),
    initialView: "day",
    nowIndicator: false,
    onSlotDragEnd,
  };
  const { container, rerender } = render(<Calendar {...props} />);
  const target = container.querySelector<HTMLElement>('[data-slot="0-2"]')!;
  const releasePointerCapture = vi.fn();
  Object.assign(target, {
    hasPointerCapture: () => true,
    releasePointerCapture,
    setPointerCapture: vi.fn(),
  });
  beginRange(container, "0-2", 0, 128);
  rerender(<Calendar {...props} minDate={d(25)} />);
  expect(releasePointerCapture).toHaveBeenCalledWith(press.pointerId);
  release();
  expect(onSlotDragEnd).not.toHaveBeenCalled();
});
