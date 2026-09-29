import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const submitted = `<RangeCalendar startName="checkIn" endName="checkOut" />
// checkIn=2026-09-24&checkOut=2026-09-30

<RangeCalendar name="stay" />
// stay=2026-09-24/2026-09-30 (an ISO 8601 interval)`;

export default function RangeCalendarPage() {
  return (
    <DocPage
      imports={["RangeCalendar", "type DateRange"]}
      title="RangeCalendar"
    >
      <Example
        description={
          <p>
            The calendar of <code>DateRangePicker</code>, always visible: the
            first click picks the first day, the second the last - in either
            order - with the range to the day under the pointer shown in
            between. <code>months</code> shows one month (default) or two side
            by side. <code>minDays</code> / <code>maxDays</code> limit the
            length, <code>isDateDisabled</code> the days: a range stops before
            the nearest disabled day. <code>startName</code> /{" "}
            <code>endName</code> submit the days, <code>name</code> the range as
            one ISO 8601 interval; <code>required</code>, <code>min</code>,{" "}
            <code>max</code> and the disabled days are enforced by the browser,
            and <code>form.reset()</code> brings back the{" "}
            <code>defaultValue</code>.
          </p>
        }
        name="range-calendar/booking"
        title="Booking"
      />
      <CodeBlock code={submitted} />

      <Callout title="Value">
        <p>
          The value is <code>{"{ start, end }"}</code> in the{" "}
          <code>YYYY-MM-DD</code> format - the <code>DateRange</code> of{" "}
          <code>DateRangePicker</code>. <code>onChange</code> gets a range once
          its last day is picked.
        </p>
      </Callout>

      <Example
        description={
          <p>
            <code>allowDisabledInRange</code> lets a range reach over disabled
            days - its first and last day still cannot be disabled ones.{" "}
            <code>presets</code> offers ranges beside the days (above them on
            phones), as in <code>DateRangePicker</code>: cut to <code>min</code>{" "}
            / <code>max</code> and to days that can be picked at their ends, and
            disabled when nothing of them can be picked. The built-in ones count
            from today of the browser - in a server-rendered page they wait for
            the hydration.
          </p>
        }
        name="range-calendar/working-days"
        title="Presets and ranges over disabled days"
      />

      <Section title="Keyboard">
        <Prose>
          <ul>
            <li>
              Tab reaches the presets, the month navigation and one day - the
              first day of the range, or today.
            </li>
            <li>
              Enter or Space on a day picks it - the first press the first day,
              the second the last. While the last day is picked, the range
              follows the focus.
            </li>
            <li>
              The arrow keys move by a day and a week, Home / End to the ends of
              the week, Page Up / Down by a month, with Shift by a year. The
              days that cannot be picked - disabled, or out of reach of the
              range being picked - take the focus and are announced as
              unavailable.
            </li>
            <li>
              Escape drops a range picked halfway; otherwise it is left alone -
              e.g. to a dialog the calendar is in. In a right-to-left page the
              left arrow moves forward.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              The calendar is a group named by its <code>label</code> (any
              content) or <code>aria-label</code> - “Select date range” without
              either. <code>error</code>, <code>description</code>,{" "}
              <code>readOnly</code> and <code>disabled</code> work as in{" "}
              <code>DateCalendar</code>, and so do <code>onBlur</code>,{" "}
              <code>ref</code> and a form library's <code>Controller</code>.
            </li>
            <li>
              Two months need about 34rem - show one on phones (
              <code>{"months={isMobile ? 1 : 2}"}</code> with{" "}
              <code>useIsMobile</code>).
            </li>
            <li>
              For a range field with a popup, use <code>DateRangePicker</code>;
              for one day or several, <code>DateCalendar</code>.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="RangeCalendar" />
      </Section>
    </DocPage>
  );
}
