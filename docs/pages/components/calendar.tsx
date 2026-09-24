import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const expandExample = `import { expandRecurringEvents, getCalendarVisibleRange } from "components-ui";

// The occurrences of this week, e.g. for a list next to the calendar
const range = getCalendarVisibleRange(new Date(), "week", weekStartsOn);
const occurrences = expandRecurringEvents(events, range);`;

const mobileExample = `const isMobile = useIsMobile();

<Calendar
  initialView={isMobile ? "agenda" : "month"}
  viewOptions={["agenda", "month", "week", "day"]}
/>`;

export default function CalendarPage() {
  return (
    <DocPage
      imports={[
        "Calendar",
        "getCalendarVisibleRange",
        "expandRecurringEvents",
        "type CalendarEvent",
      ]}
      title="Calendar"
    >
      <Example
        description={
          <p>
            Events are plain objects with <code>start</code> and{" "}
            <code>end</code> dates and show on every day they span - the end is
            exclusive, so an all-day event of one day ends at the midnight after
            it. Give all-day events local midnights, like{" "}
            <code>new Date(2026, 8, 24)</code> - dates parsed from{" "}
            <code>"2026-09-24"</code> are UTC midnights, which count as their
            UTC day only when both the start and the end are one. They may come
            in any order: all-day events are listed first, then by start. Switch
            the views in the header, or go back to today; a crowded day of the
            month (and of the all-day row of the week) shows "+N more", which
            opens the list of all its events.
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
            tap there is a click, ranges are dragged with the mouse or a pen (up
            or down from the pressed slot). A drag changes only what is dragged:
            a move keeps the length of the event (also over a daylight saving
            change), a resize moves one edge, both by whole slots, and a part of
            the event out of the shown hours stays as it is. Dragging near the
            edges scrolls the view - also sideways to the days (or resources) a
            phone has no room for -, Escape cancels a drag, and the events of
            days disabled by <code>minDate</code> / <code>maxDate</code> stay
            where they are. Without <code>onDateClick</code>, a tap on a slot
            creates a range of that slot.
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

      <Section title="Agenda">
        <Example
          description={
            <>
              <p>
                Add <code>"agenda"</code> to <code>viewOptions</code> for a list
                of the events grouped by day - all-day events first, then by
                start, with the times on the clock of the locale.{" "}
                <code>agendaPeriod</code> sets what it lists: the{" "}
                <code>"month"</code> of the current date (default), its{" "}
                <code>"week"</code> or <code>"day"</code>, or a number of days
                starting with it; Previous / Next move by that period. An event
                over several days is listed on each of them, marked "Day 2/3",
                with "from" its start on the first and "until" its end on the
                last. The day headings stay on top while the list scrolls (
                <code>stickyHeader</code>), and a period with today opens at
                today. A day heading picks the day (<code>onDateClick</code>);
                the events are buttons reached by Tab, with their icon, color,
                resource and actions.
              </p>
              <p>
                The agenda needs no room for a grid, so it is the view to offer
                first on phones:
              </p>
            </>
          }
          name="calendar/agenda"
          title="Events by day"
        />
        <CodeBlock code={mobileExample} />
        <Prose>
          <p>
            <code>initialView</code> is read once, and a page rendered on the
            server does not know the screen yet (<code>useIsMobile</code> is{" "}
            <code>false</code> there) - control <code>view</code> with{" "}
            <code>onViewChange</code> to switch it after hydration.
          </p>
        </Prose>
      </Section>

      <Section title="Resources">
        <Example
          collapsed
          description={
            <p>
              With <code>resources</code> (rooms, people, vehicles - an{" "}
              <code>id</code>, a <code>title</code> and a <code>color</code>)
              the day view shows a column for each, and the week view one for
              each resource of every day. An event goes into the column of its{" "}
              <code>resourceId</code> and takes the color of its resource unless
              it has its own; events of no resource are left out of the columns.
              Dragging an event to another column moves it to that resource -{" "}
              <code>onEventDrop</code> gets it as <code>newResourceId</code>{" "}
              (resizes report the resource too), a range picked in a column
              comes with its <code>resourceId</code>, and so does{" "}
              <code>onDateClick</code> of a slot. The resource names stay on top
              and the time column on the left while many resources scroll
              sideways; a drag near the edge scrolls along. The agenda and month
              views list the events of all resources - the agenda with the name
              of the resource.
            </p>
          }
          name="calendar/resources"
          title="Meeting rooms"
        />
      </Section>

      <Section title="Recurring events">
        <Example
          collapsed
          description={
            <>
              <p>
                <code>recurrence</code> repeats an event -{" "}
                <code>{`{ freq: "weekly", byWeekday: [1, 3] }`}</code> or an
                iCalendar rule such as <code>"FREQ=MONTHLY;BYDAY=-1FR"</code>.
                Every occurrence takes the clock time of the event (also after a
                daylight saving change) and its length; all-day events repeat
                whole days, and days a month does not have (the 31st) are
                skipped. <code>exdates</code> leaves occurrences out.
              </p>
              <p>
                An occurrence is shown like an event, with an <code>id</code> of
                its own, <code>recurringEventId</code> (the <code>id</code> of
                the event) and <code>occurrenceStart</code> - so a click, a drop
                or a resize can ask whether the change is for this occurrence or
                for the whole series. Delete one by adding its{" "}
                <code>occurrenceStart</code> to <code>exdates</code>; an event
                of your own with the <code>recurringEventId</code> and{" "}
                <code>occurrenceStart</code> of an occurrence (e.g. the moved
                occurrence itself) replaces it.
              </p>
            </>
          }
          name="calendar/recurring"
          title="Repeating events"
        />
        <Prose>
          <p>
            The calendar expands the occurrences of the days it shows. Fetch the
            recurring events whose occurrences may fall in the visible range,
            and use <code>expandRecurringEvents(events, range)</code> for the
            occurrences anywhere else:
          </p>
        </Prose>
        <CodeBlock code={expandExample} />
      </Section>

      <Example
        collapsed
        description={
          <p>
            Control the date with <code>currentDate</code> +{" "}
            <code>setCurrentDate</code> (and the view with <code>view</code> +{" "}
            <code>onViewChange</code>) and ask{" "}
            <code>getCalendarVisibleRange(date, view, weekStartsOn)</code> for
            exactly the days the view paints - the range to fetch; pass the{" "}
            <code>agendaPeriod</code> of the calendar as its fourth argument,{" "}
            <code>{"{ agendaPeriod }"}</code>. A <code>currentDate</code>{" "}
            without <code>setCurrentDate</code> cannot be navigated (a warning
            in development says so) - for just the first date use{" "}
            <code>initialDate</code>.
          </p>
        }
        name="calendar/remote"
        title="Loading events of the visible range"
      />

      <Callout title="Keyboard and screen readers">
        <p>
          Events are buttons named by their title, resource and time - Enter or
          Space opens them; their actions and the links of an{" "}
          <code>htmlTitle</code> are controls of their own next to them. The
          days of the month view (with <code>onDateClick</code>) and the time
          slots of the week and day views (with <code>onDateClick</code> or{" "}
          <code>onSlotDragEnd</code>) are one tab stop each: the arrow keys move
          between them - left and right also between the resources - and Enter
          picks the day or time. With <code>onSlotDragEnd</code>, Shift + arrow
          up / down select slots from the focused one and Enter or Space create
          the range, Escape drops the selection; without{" "}
          <code>onDateClick</code>, Enter or Space on a slot create a range of
          that slot. The agenda is a list of days, each a list of its events
          named by the heading of the day. The header announces the period
          Previous, Next and Today move to - in the day view, whose day the date
          field shows, to screen readers only.
        </p>
      </Callout>

      <Callout title="Localization">
        <p>
          Month and weekday names, the date and time formats and the first day
          of the week come from the locale - switch the component language (EN /
          CS) in the top bar.
        </p>
      </Callout>

      <Callout title="Server rendering">
        <p>
          Without <code>initialDate</code> (or <code>currentDate</code>) the
          calendar opens on today - and "today" of the server and of the browser
          may differ (another time zone, a page rendered before midnight), so
          the hydrated page would not match. Pass <code>initialDate</code> when
          the page is rendered on the server (e.g. Next.js), with the date the
          browser will use too.
        </p>
      </Callout>

      <Section title="Event colors">
        <Prose>
          <p>
            <code>color</code> is one of <code>primary</code> (default),{" "}
            <code>red</code>, <code>green</code>, <code>blue</code>,{" "}
            <code>yellow</code>, <code>purple</code>, <code>gray</code> and{" "}
            <code>lightgreen</code> - an event without one takes the{" "}
            <code>color</code> of its resource. <code>htmlTitle</code> renders a
            rich title, reduced to inline formatting - it can run no scripts,
            and only text-styling classes are kept (none on links), so it cannot
            place anything over the page. It is sanitized in the browser: server
            rendering (e.g. Next.js) shows the plain <code>title</code>, and the
            rich one follows once the page is hydrated.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Calendar" />
        <PropsTable of="CalendarEvent" />
        <PropsTable of="CalendarRecurrence" />
        <PropsTable of="CalendarResource" />
        <PropsTable of="EventTimeChange" />
        <PropsTable of="NewEventTimeRange" />
      </Section>
    </DocPage>
  );
}
