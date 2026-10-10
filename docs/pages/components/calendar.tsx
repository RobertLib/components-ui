import { Kbd } from "components-ui";
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
          <>
            <p>
              <code>onEventDrop</code> lets events be dragged to another time or
              day - in the week and day views by whole slots, in the month view
              and in the all-day row of the week and day views by whole days,
              where an all-day event stays one and every event keeps its length.{" "}
              <code>onEventResize</code> resizes them by their edges, and{" "}
              <code>onSlotDragEnd</code> reports a range dragged over empty
              slots. <code>renderEventActions</code> adds controls revealed on
              hover. Dragging works with the mouse, a pen and a finger: a finger
              on a draggable event moves it instead of scrolling the view, while
              a finger on the empty slots scrolls - a tap there is a click,
              ranges are dragged with the mouse or a pen (up or down from the
              pressed slot). A drag changes only what is dragged: a move keeps
              the length of the event (also over a daylight saving change), a
              resize moves one edge, both by whole slots, and a part of the
              event out of the shown hours stays as it is. Dragging near the
              edges scrolls the view - also sideways to the days (or resources)
              a phone has no room for -, Escape cancels a drag, and the events
              of days disabled by <code>minDate</code> / <code>maxDate</code>{" "}
              stay where they are. Without <code>onDateClick</code>, a tap on a
              slot creates a range of that slot.
            </p>
            <p>
              The keys move events too: <Kbd shortcut="mod+x" size="sm" /> on a
              focused event picks it up (Enter or Space on one without{" "}
              <code>onEventClick</code>), the arrow keys move it by a slot or a
              day - in the month by a day or a week -,{" "}
              <Kbd size="sm">Shift</Kbd> + ↑ / ↓ change its end (with{" "}
              <code>onEventResize</code>), Enter puts it down and Escape back.
              Screen readers hear where it would go, and the same{" "}
              <code>onEventDrop</code> / <code>onEventResize</code> report it.
            </p>
          </>
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
        title="Hours shown"
      />

      <Section title="Slots, working hours and the work week">
        <Example
          collapsed
          description={
            <>
              <p>
                <code>slotDuration</code> sets the slots of the week, day and
                timeline views - 5, 10, 15, 20, 30 or 60 minutes (by default
                half hours in the week, hours in the day). An hour stays 128
                pixels high, a slot at least 24; ranges are picked and events
                moved and resized by whole slots, and the time column writes
                every slot where they are tall enough, else the quarter, half or
                whole hours.
              </p>
              <p>
                <code>businessHours</code> shades the time out of the working
                hours - <code>true</code> for 9:00 - 17:00 on Monday to Friday,
                or <code>{`{ days, start, end }`}</code> entries, several for a
                break or other hours on other days; the month view shades the
                days without any. With <code>restrictToBusinessHours</code> only
                the working hours can be picked: a slot out of them is disabled,
                and a range stops at their end (events can still be moved
                there). <code>hiddenDays</code> leaves days of the week out - a
                work week without the weekend: the week and month views have no
                column for them, the day views and the arrow keys skip them.
              </p>
              <p>
                The line of the current time (<code>nowIndicator</code>, on by
                default) crosses today in the week, day and timeline views and
                moves every minute - drawn once the page is hydrated, the server
                does not know the time of the browser.
              </p>
            </>
          }
          name="calendar/work-week"
          title="A work week of quarter hours"
        />
      </Section>

      <Example
        collapsed
        description={
          <p>
            <code>renderEvent(event, context)</code> renders the content of the
            tiles - after the icon of <code>renderEventIcon</code>, instead of
            the title. The context gives the default <code>title</code> (with
            its <code>htmlTitle</code>), <code>timeText</code> ("9:00 – 10:30
            AM", or the times a moved event would get), <code>view</code>,{" "}
            <code>compact</code> for the one-line tiles of the month, the
            all-day row, the lists and the timeline, <code>allDay</code>,{" "}
            <code>color</code> and <code>dragging</code>. The tile stays a
            button named by the title and time of the event, with its actions -
            what <code>renderEvent</code> renders is for the eye, so keep
            controls out of it.
          </p>
        }
        name="calendar/custom-tiles"
        title="Custom tiles"
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
        <Example
          collapsed
          description={
            <p>
              The <code>"timelineDay"</code> and <code>"timelineWeek"</code>{" "}
              views put the resources in rows and the time across them - the
              hours shown of the day, or of each day of the week (without the{" "}
              <code>hiddenDays</code>). Events are bars in the row of their
              resource, stacked where they overlap; an all-day event takes its
              whole days, and an event wholly out of the hours shown (at night)
              is left out. They are clicked, dragged to another time or row (
              <code>newResourceId</code>) and resized by their start and end
              edges; a range dragged over the slots of a row comes with its{" "}
              <code>resourceId</code>. From the keyboard the slots are one tab
              stop: ← / → go across the time, ↑ / ↓ down the resources, Shift +
              ← / → select a range; a picked-up event moves the same way, Shift
              + ← / → change its end. The resource names stay on the left and
              the days and hours on top while the timeline scrolls.
            </p>
          }
          name="calendar/timeline"
          title="Resource timeline"
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
                Recurrences use <code>timeZone</code> when supplied, otherwise
                the browser's zone. Set <code>timeZone="Europe/Prague"</code>
                to keep a Prague meeting at its planned clock time across DST.
                If series in one calendar need different recurrence zones,
                expand them on the server and pass their individual occurrences.{" "}
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
          Events that can be moved are picked up by{" "}
          <Kbd shortcut="mod+x" size="sm" /> (their{" "}
          <code>aria-keyshortcuts</code>) - or Enter and Space on a tile that
          opens nothing -, and the arrow keys move them: up and down by a slot
          and across by a column in the week and day views, by a day and a week
          in the month, across the time and down the resources in the timeline;
          Shift + the arrows along the time change the end. Enter, Space or{" "}
          <Kbd shortcut="mod+v" size="sm" /> put the event down, Escape or
          leaving it puts it back. Each place is announced with its day, times
          and resource, and so is the drop; the focus stays on the moved event.
          In a right-to-left page the arrows across swap.
        </p>
        <p>
          The keys are no help to everyone who uses a pointer without dragging -
          WCAG 2.5.7 asks for a way that works with a single click or tap: e.g.
          open a dialog with the times of the event from{" "}
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
          The calendar puts events on the days and hours of the selected time
          zone (the browser zone by default), which the server does not know -
          so a page rendered on the server (e.g. Next.js) shows the view without
          its events, and they follow right after the hydration, in any time
          zone; so does the mark of today. The view itself is rendered on the
          server: pass <code>initialDate</code> (or <code>currentDate</code>) -
          without it the calendar opens on today, and "today" of the server and
          of the browser may differ. Make it a date of the same day in both,
          e.g. <code>new Date(2026, 8, 24)</code> built where the component
          renders, or noon of the day - a midnight made in the time zone of the
          server may be the day before in the browser.
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

      <Example
        name="calendar/time-zone-permissions"
        title="Time zones and event permissions"
        description={
          <p>
            <code>timeZone</code> accepts an IANA zone such as{" "}
            <code>Europe/Prague</code>. It controls day boundaries, labels,
            navigation (also the keys and the Today of the date field), the
            current-time marker and recurrence clock time; omit it to use the
            browser zone, which also stands in for a zone the browser does not
            know (with a warning in the console). Pass the same zone as the
            fourth argument options of{" "}
            <code>
              getCalendarVisibleRange(date, view, weekStartsOn, {`{ timeZone }`}
              )
            </code>{" "}
            when fetching events. Input Dates represent instants; returned Dates
            preserve UTC serialization. <code>canMoveEvent</code> and{" "}
            <code>canResizeEvent</code> restrict individual events.{" "}
            <code>canDropEvent</code> validates the proposed time/resource for
            both moving and resizing, by pointer or keyboard, and is checked
            again before committing. A series repeats in the calendar zone;
            expand on the server when different series must retain different
            zones.
          </p>
        }
      />
      <Section title="Props">
        <PropsTable of="Calendar" />
        <PropsTable of="CalendarEvent" />
        <PropsTable of="CalendarEventRenderContext" />
        <PropsTable of="CalendarBusinessHours" />
        <PropsTable of="CalendarRecurrence" />
        <PropsTable of="CalendarResource" />
        <PropsTable of="EventTimeChange" />
        <PropsTable of="NewEventTimeRange" />
      </Section>
    </DocPage>
  );
}
