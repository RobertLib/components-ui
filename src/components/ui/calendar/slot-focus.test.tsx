import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Calendar, { type CalendarProps } from ".";

const date = (hour = 0) => new Date(2026, 8, 24, hour);
const resources = [
  { id: "a", title: "Room A" },
  { id: "b", title: "Room B" },
];

const slot = (container: HTMLElement, position: string) =>
  container.querySelector<HTMLElement>(`[data-slot="${position}"]`)!;

describe.each(["day", "timelineDay"] as const)(
  "Calendar keyboard selection in %s",
  (view) => {
    const next = view === "day" ? "{ArrowDown}" : "{ArrowRight}";

    it("drops a range when the displayed hours shrink and allows a new pick", async () => {
      const user = userEvent.setup();
      const onSlotDragEnd = vi.fn();
      const calendar = (endHour: number) => (
        <Calendar
          dayEndHour={endHour}
          dayStartHour={7}
          initialDate={date()}
          initialView={view}
          onSlotDragEnd={onSlotDragEnd}
        />
      );
      const { container, rerender } = render(calendar(22));

      act(() => slot(container, "0-10").focus());
      await user.keyboard(`{Shift>}${next}{/Shift}`);
      expect(screen.getByText(/^Selected: /)).toBeInTheDocument();

      rerender(calendar(8));
      expect(screen.queryByText(/^Selected: /)).not.toBeInTheDocument();
      expect(onSlotDragEnd).not.toHaveBeenCalled();

      // Growing again must not bring back the abandoned range.
      rerender(calendar(22));
      expect(screen.queryByText(/^Selected: /)).not.toBeInTheDocument();
      act(() => slot(container, "0-0").focus());
      await user.keyboard(`{Shift>}${next}{/Shift}{Enter}`);
      expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith({
        end: date(9),
        start: date(7),
      });
    });

    it("drops a range when its resource is removed and picks in the remaining one", async () => {
      const user = userEvent.setup();
      const onSlotDragEnd = vi.fn();
      const calendar = (rooms: typeof resources) => (
        <Calendar
          initialDate={date()}
          initialView={view}
          onSlotDragEnd={onSlotDragEnd}
          resources={rooms}
        />
      );
      const { container, rerender } = render(calendar(resources));

      act(() => slot(container, "1-0").focus());
      await user.keyboard(`{Shift>}${next}{/Shift}`);
      expect(screen.getByText(/^Selected: Room B,/)).toBeInTheDocument();

      rerender(calendar(resources.slice(0, 1)));
      expect(screen.queryByText(/^Selected: /)).not.toBeInTheDocument();
      expect(onSlotDragEnd).not.toHaveBeenCalled();

      act(() => slot(container, "0-0").focus());
      await user.keyboard(`{Shift>}${next}{/Shift}{Enter}`);
      expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith({
        end: date(9),
        resourceId: "a",
        start: date(7),
      });
    });
  },
);

describe.each(["day", "week", "timelineDay", "timelineWeek"] as const)(
  "Calendar keyboard selection geometry in %s",
  (view) => {
    const next = view.startsWith("timeline") ? "{ArrowRight}" : "{ArrowDown}";
    const firstDay = view === "week" || view === "timelineWeek" ? 20 : 24;

    it.each([
      {
        name: "resource order",
        update: { resources: [...resources].reverse() },
      },
      {
        name: "resource identity with the same column count",
        update: {
          resources: [
            { id: "c", title: "Room C" },
            { id: "d", title: "Room D" },
          ],
        },
      },
      { name: "shown dates", update: { currentDate: new Date(2026, 9, 1) } },
      {
        name: "shown hours with the same slot count",
        update: { dayEndHour: 23, dayStartHour: 8 },
      },
      {
        name: "slot duration with the same slot count",
        update: { dayEndHour: 12, dayStartHour: 7, slotDuration: 20 },
      },
      { name: "date limits", update: { maxDate: new Date(2026, 9, 1) } },
      {
        name: "restricted business hours",
        update: {
          businessHours: { start: "8:00", end: "17:00" },
          restrictToBusinessHours: true,
        },
      },
      { name: "range availability", update: { onSlotDragEnd: undefined } },
    ] satisfies { name: string; update: Partial<CalendarProps> }[])(
      "drops a range when $name change and does not revive it",
      async ({ update }) => {
        const user = userEvent.setup();
        const onSlotDragEnd = vi.fn();
        const props: CalendarProps = {
          currentDate: date(),
          initialView: view,
          nowIndicator: false,
          onDateClick: vi.fn(),
          onSlotDragEnd,
          resources,
          setCurrentDate: vi.fn(),
          slotDuration: 60,
        };
        const { container, rerender } = render(<Calendar {...props} />);
        act(() => slot(container, "0-0").focus());
        await user.keyboard(`{Shift>}${next}{/Shift}`);
        expect(screen.getByText(/^Selected: Room A,/)).toBeInTheDocument();

        rerender(<Calendar {...props} {...update} />);
        expect(screen.queryByText(/^Selected: /)).not.toBeInTheDocument();
        expect(container.querySelector(".border-dashed")).toBeNull();
        await user.keyboard("{Enter}");
        expect(onSlotDragEnd).not.toHaveBeenCalled();

        // Returning to the old geometry does not bring back its selection.
        rerender(<Calendar {...props} />);
        expect(screen.queryByText(/^Selected: /)).not.toBeInTheDocument();
        act(() => slot(container, "0-0").focus());
        await user.keyboard("{Enter}");
        expect(onSlotDragEnd).not.toHaveBeenCalled();
        await user.keyboard(`{Shift>}${next}{/Shift}{Enter}`);
        expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith({
          end: new Date(2026, 8, firstDay, 9),
          resourceId: "a",
          start: new Date(2026, 8, firstDay, 7),
        });
      },
    );

    it("keeps equal geometry and commits with the latest callback", async () => {
      const user = userEvent.setup();
      const onSlotDragEnd = vi.fn();
      const props: CalendarProps = {
        currentDate: date(),
        initialView: view,
        nowIndicator: false,
        onSlotDragEnd,
        resources,
        setCurrentDate: vi.fn(),
        slotDuration: 60,
      };
      const { container, rerender } = render(<Calendar {...props} />);
      act(() => slot(container, "0-0").focus());
      await user.keyboard(`{Shift>}${next}{/Shift}`);

      const onLatestRange = vi.fn();
      rerender(
        <Calendar
          {...props}
          currentDate={date()}
          onSlotDragEnd={onLatestRange}
          resources={resources.map((resource) => ({
            ...resource,
            title: `Updated ${resource.title}`,
          }))}
        />,
      );
      expect(
        screen.getByText(/^Selected: Updated Room A,/),
      ).toBeInTheDocument();
      await user.keyboard("{Enter}");
      expect(onSlotDragEnd).not.toHaveBeenCalled();
      expect(onLatestRange).toHaveBeenCalledExactlyOnceWith({
        end: new Date(2026, 8, firstDay, 9),
        resourceId: "a",
        start: new Date(2026, 8, firstDay, 7),
      });
    });

    it("starts a new range in the current resource after reordering", async () => {
      const user = userEvent.setup();
      const onSlotDragEnd = vi.fn();
      const calendar = (rooms: typeof resources) => (
        <Calendar
          currentDate={date()}
          initialView={view}
          nowIndicator={false}
          onSlotDragEnd={onSlotDragEnd}
          resources={rooms}
          setCurrentDate={vi.fn()}
          slotDuration={60}
        />
      );
      const { container, rerender } = render(calendar(resources));
      act(() => slot(container, "0-0").focus());
      await user.keyboard(`{Shift>}${next}{/Shift}`);
      rerender(calendar([...resources].reverse()));
      expect(screen.queryByText(/^Selected: /)).not.toBeInTheDocument();

      act(() => slot(container, "0-0").focus());
      await user.keyboard(`{Shift>}${next}{/Shift}`);
      expect(screen.getByText(/^Selected: Room B,/)).toBeInTheDocument();
      await user.keyboard("{Enter}");
      expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith({
        end: new Date(2026, 8, firstDay, 9),
        resourceId: "b",
        start: new Date(2026, 8, firstDay, 7),
      });
    });
  },
);

it.each(["week", "timelineWeek"] as const)(
  "drops a range when the visible weekdays change without changing their count in %s",
  async (view) => {
    const user = userEvent.setup();
    const onSlotDragEnd = vi.fn();
    const calendar = (hiddenDays: CalendarProps["hiddenDays"]) => (
      <Calendar
        currentDate={date()}
        hiddenDays={hiddenDays}
        initialView={view}
        nowIndicator={false}
        onSlotDragEnd={onSlotDragEnd}
        setCurrentDate={vi.fn()}
        slotDuration={60}
      />
    );
    const { container, rerender } = render(calendar([0]));
    const next = view === "week" ? "{ArrowDown}" : "{ArrowRight}";
    act(() => slot(container, "0-0").focus());
    await user.keyboard(`{Shift>}${next}{/Shift}`);
    expect(
      screen.getByText(/^Selected: Monday, September 21,/),
    ).toBeInTheDocument();

    rerender(calendar([1]));
    expect(screen.queryByText(/^Selected: /)).not.toBeInTheDocument();
    act(() => slot(container, "0-0").focus());
    await user.keyboard(`{Shift>}${next}{/Shift}{Enter}`);
    expect(onSlotDragEnd).toHaveBeenCalledExactlyOnceWith({
      end: new Date(2026, 8, 20, 9),
      start: new Date(2026, 8, 20, 7),
    });
  },
);
