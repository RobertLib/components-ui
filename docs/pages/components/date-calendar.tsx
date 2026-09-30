import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const submitted = `<DateCalendar name="pickup" />
// pickup=2026-09-24 ("" without a day)

<DateCalendar multiple name="days" />
// days=2026-09-24&days=2026-09-25 - formData.getAll("days")`;

const hookForm = `<Controller
  control={control}
  name="pickup"
  render={({ field }) => (
    <DateCalendar
      label="Pickup day"
      onBlur={field.onBlur}
      onChange={field.onChange}
      ref={field.ref}
      value={field.value}
    />
  )}
/>`;

export default function DateCalendarPage() {
  return (
    <DocPage imports={["DateCalendar"]} title="DateCalendar">
      <Example
        description={
          <p>
            The day grid of <code>DateTimePicker</code>, always visible - for a
            form where picking the day is the main thing: a booking, an
            appointment. <code>min</code> / <code>max</code> disable the days
            out of them, <code>isDateDisabled</code> any other ones (they are
            struck through). With a <code>name</code>, a hidden input submits
            the day; <code>required</code>, <code>min</code>, <code>max</code>{" "}
            and <code>isDateDisabled</code> are enforced by the browser - a
            submit is blocked with the message at the calendar, which takes the
            focus - and <code>form.reset()</code> brings back the{" "}
            <code>defaultValue</code>.
          </p>
        }
        name="date-calendar/form"
        title="In a form"
      />
      <CodeBlock code={submitted} />

      <Callout title="Value">
        <p>
          The value is a day in the <code>YYYY-MM-DD</code> format of{" "}
          <code>DateTimePicker</code> (an array of them with{" "}
          <code>multiple</code>), so it can be sent to an API as it is.{" "}
          <code>onChange</code> gets the value itself, not an event.
        </p>
      </Callout>

      <Example
        description={
          <p>
            Controlled with <code>value</code> + <code>onChange</code>, or
            uncontrolled with <code>defaultValue</code>. A value set by the
            parent brings its month into view; <code>null</code> is no day.
          </p>
        }
        name="date-calendar/controlled"
        title="Controlled"
      />

      <Example
        description={
          <p>
            <code>multiple</code> picks several days - a click (or Enter) adds a
            day or removes it. The value is an array of days in order, the grids
            are <code>aria-multiselectable</code>, and the count under them is
            announced as it changes. The form gets an input for each day, none
            without one.
          </p>
        }
        name="date-calendar/multiple"
        title="Several days"
      />

      <Example
        description={
          <p>
            <code>error</code> marks the calendar as invalid and{" "}
            <code>description</code> adds a help text under it - the calendar is
            described by both, the error first. <code>readOnly</code> shows and
            submits the value and lets the months be browsed, but nothing be
            picked (the grids are <code>aria-readonly</code>, the box has{" "}
            <code>data-readonly</code>); <code>disabled</code> - also by a
            disabled <code>&lt;fieldset&gt;</code> - neither, and submits
            nothing.
          </p>
        }
        name="date-calendar/states"
        title="States"
      />

      <Section title="Keyboard">
        <Prose>
          <ul>
            <li>
              Tab reaches the month navigation - the buttons and the month and
              year selects - then the selected day (or today): one tab stop in
              the days.
            </li>
            <li>
              The arrow keys move by a day and a week, on into the next and the
              previous month; Home / End go to the first and the last day of the
              week of the locale, Page Up / Down by a month - with Shift by a
              year. They stop at <code>min</code> / <code>max</code>.
            </li>
            <li>
              Enter or Space picks the focused day. The days of{" "}
              <code>isDateDisabled</code> take the focus and are announced as
              unavailable, but cannot be picked.
            </li>
            <li>
              Escape is left alone - e.g. to a dialog the calendar is in. In a
              right-to-left page the left arrow moves forward.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="With a form library">
        <Prose>
          <p>
            <code>onChange</code> gets the value, <code>onBlur</code> is called
            once the focus leaves the whole calendar, and <code>ref</code>{" "}
            points at its group - as the other attributes of an element do (the
            group has <code>data-invalid</code> and the days{" "}
            <code>data-selected</code> for your styles) - React Hook Form's{" "}
            <code>Controller</code>:
          </p>
        </Prose>
        <CodeBlock code={hookForm} />
      </Section>

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              The calendar is a group named by its <code>label</code> (any
              content) or <code>aria-label</code> - “Select date” without
              either. A click on the label focuses the day in the tab order.
            </li>
            <li>
              Without a value it opens at the browser's current month. In a
              server-rendered page the empty calendar reserves its space until
              hydration, so different server and browser dates cannot change the
              initial HTML. A selected month renders on the server too.
            </li>
            <li>
              <code>className</code> goes to the box around the days - e.g.{" "}
              <code>w-full</code> or <code>border-0</code>. It is{" "}
              <code>w-72</code> wide by default.
            </li>
            <li>
              For a from - to range, use <code>RangeCalendar</code>; for a field
              with a popup, <code>DateTimePicker</code>.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="DateCalendar" />
      </Section>
    </DocPage>
  );
}
