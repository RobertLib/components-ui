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
            month (and of the all-day row of the week and day views) shows "+N
            more", which opens the list of all its events. <code>minDate</code>{" "}
            / <code>maxDate</code> disable the days out of them, and Previous,
            Next and Today go no further than the periods with them.
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
            the week and day views (7 – 22 by default); an event wholly out of
            them has no row there - the header of its day offers it as "+N
            earlier" or "+N later", which opens the list of them - a night event
            running into the day from the one before is listed "until" its end.{" "}
            <code>viewOptions</code> limits the views.
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
              the day view shows a column for each (under its day, today
              marked), and the week view one for each resource of every day. An
              event goes into the column of its <code>resourceId</code> and
              takes the color of its resource unless it has its own; events of
              no resource are left out of the columns. Dragging an event to
              another column moves it to that resource -{" "}
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
                The clock is the one of the browser's time zone - the calendar
                knows no other. A series planned at 9:00 in Prague is 3:00 in
                New York and stays 3:00 there, also in the weeks the two zones
                change to summer time on different days (it is 8:00 in Prague
                then). A series that must keep the clock of its own time zone
                everywhere is expanded on the server, as events of their own.{" "}
                <code>until</code> given as a UTC midnight (
                <code>new Date("2026-12-31")</code>) includes that day - unless
                it is at the clock time of the event, the start of the last
                occurrence as iCalendar gives <code>UNTIL</code>; a local
                midnight (<code>new Date(2026, 11, 31)</code>) always means the
                whole day.
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
          picks the day or time. The month is a grid of its weekdays and days (a
          table without <code>onDateClick</code>); Home / End go to the first
          and the last day of the week, Page Up / Down to the same day of the
          previous or next month - with Shift of the year. "+N more" and "+N
          earlier / later" are named with their day. Today is marked (
          <code>aria-current</code>) in the month and week views and in the
          agenda (and over the resources of the day view). The focused slot or
          event is scrolled into view below the sticky header and right of the
          time column. With <code>onSlotDragEnd</code>, Shift + arrow up / down
          select slots from the focused one and Enter or Space create the range,
          Escape drops the selection; without <code>onDateClick</code>, Enter or
          Space on a slot create a range of that slot. The agenda is a list of
          days, each a list of its events named by the heading of the day. The
          header announces the period Previous, Next and Today move to - in the
          day view, whose day the date field shows, to screen readers only.
        </p>
        <p>
          Moving and resizing events takes a pointer: a drag has no keyboard
          equivalent in the calendar itself. Offer another way to change the
          times - WCAG 2.5.7 asks for one that works with a single click or tap
          - e.g. open a dialog with the times of the event from{" "}
          <code>onEventClick</code> (which Enter and Space call too) and save
          them like a drop.
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
          The calendar puts events on the days and hours of the browser's time
          zone, which the server does not know - so a page rendered on the
          server (e.g. Next.js) shows the view without its events, and they
          follow right after the hydration, in any time zone; so does the mark
          of today. The view itself is rendered on the server: pass{" "}
          <code>initialDate</code> (or <code>currentDate</code>) - without it
          the calendar opens on today, and "today" of the server and of the
          browser may differ. Make it a date of the same day in both, e.g.{" "}
          <code>new Date(2026, 8, 24)</code> built where the component renders,
          or noon of the day - a midnight made in the time zone of the server
          may be the day before in the browser.
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
