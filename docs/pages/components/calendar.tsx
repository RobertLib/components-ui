import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function CalendarPage() {
  return (
    <DocPage
      imports={["Calendar", "getCalendarVisibleRange", "type CalendarEvent"]}
      title="Calendar"
    >
      <Example
        description={
          <p>
            Events are plain objects with <code>start</code> and{" "}
            <code>end</code> dates and show on every day they span. Switch the
            views in the header; a crowded day of the month shows "+N more",
            which opens the list of all its events.
          </p>
        }
        name="calendar/basic"
        title="Month, week and day views"
      />
      <Example
        collapsed
        description={
          <p>
            In the week and day views, <code>onEventDrop</code> lets events be
            dragged to another time or day, <code>onEventResize</code> resized
            by their edges, and <code>onSlotDragEnd</code> reports a range
            dragged over empty slots. <code>renderEventActions</code> adds
            controls revealed on hover. Dragging works with the mouse, a pen and
            a finger: a finger on a draggable event moves it instead of
            scrolling the view, while a finger on the empty slots scrolls - a
            tap there is a click, ranges are dragged with the mouse or a pen. A
            drag changes only what is dragged: a move keeps the length of the
            event, a resize moves one edge, and a part of the event out of the
            shown hours stays as it is.
          </p>
        }
        name="calendar/editable"
        title="Drag, resize and create"
      />
      <Example
        description={
          <p>
            <code>dayStartHour</code> / <code>dayEndHour</code> set the hours of
            the week and day views (7 – 22 by default); <code>viewOptions</code>{" "}
            limits the views.
          </p>
        }
        name="calendar/hours"
        title="Working hours"
      />
      <Example
        collapsed
        description={
          <p>
            Control the date with <code>currentDate</code> +{" "}
            <code>setCurrentDate</code> (and the view with <code>view</code> +{" "}
            <code>onViewChange</code>) and ask{" "}
            <code>getCalendarVisibleRange(date, view, weekStartsOn)</code> for
            exactly the days the view paints - the range to fetch.
          </p>
        }
        name="calendar/remote"
        title="Loading events of the visible range"
      />

      <Callout title="Keyboard">
        <p>
          Events are buttons - Enter or Space opens them. With{" "}
          <code>onDateClick</code>, the days of the month view and the time
          slots of the week and day views are one tab stop each: the arrow keys
          move between them, Enter picks the day or time.
        </p>
      </Callout>

      <Callout title="Localization">
        <p>
          Month and weekday names, the date format and the first day of the week
          come from the locale - switch the component language (EN / CS) in the
          top bar.
        </p>
      </Callout>

      <Section title="Event colors">
        <Prose>
          <p>
            <code>color</code> is one of <code>primary</code> (default),{" "}
            <code>red</code>, <code>green</code>, <code>blue</code>,{" "}
            <code>yellow</code>, <code>purple</code>, <code>gray</code> and{" "}
            <code>lightgreen</code>. <code>htmlTitle</code> renders a rich
            title, reduced to inline formatting - it can run no scripts, and
            only text-styling classes are kept (none on links), so it cannot
            place anything over the page.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Calendar" />
        <PropsTable of="CalendarEvent" />
        <PropsTable of="EventTimeChange" />
      </Section>
    </DocPage>
  );
}
