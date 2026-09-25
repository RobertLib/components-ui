import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const value = `// value, defaultValue and onChange - null for no range
interface DateRange {
  start: string; // "2026-09-01" - the first day
  end: string;   // "2026-09-30" - the last day, part of the range
}`;

const submitted = `<DateRangePicker startName="from" endName="to" />
// from=2026-09-01&to=2026-09-30

<DateRangePicker name="period" />
// period=2026-09-01/2026-09-30 (an ISO 8601 interval)`;

const hookForm = `<Controller
  control={control}
  name="period"
  render={({ field }) => (
    <DateRangePicker
      label="Period"
      onBlur={field.onBlur}
      onChange={field.onChange}
      ref={field.ref}
      value={field.value}
    />
  )}
/>`;

export default function DateRangePickerPage() {
  return (
    <DocPage
      imports={["DateRangePicker", "type DateRange"]}
      title="DateRangePicker"
    >
      <Example
        description={
          <p>
            A click in the calendar picks the first day, the second click the
            last - in either order - and the range to the day under the pointer
            is shown in between; a range of one day is two clicks on it. The
            calendar shows two months side by side (one on phones, with the
            presets above it), and the presets pick a whole range at once. The
            range can also be typed into the field in the date format of the
            locale.
          </p>
        }
        name="date-range-picker/report-filter"
        title="Report filter"
      />

      <Callout title="Value and display format">
        <p>
          The value is <code>{"{ start, end }"}</code> in the{" "}
          <code>YYYY-MM-DD</code> format of <code>DateTimePicker</code>, so it
          can be sent to an API as it is; the field shows it in the date format
          of the locale (<code>09/01/2026 – 09/30/2026</code> in English,{" "}
          <code>01.09.2026 – 30.09.2026</code> in Czech). A range always has
          both days - <code>onChange</code> gets a new range once it is
          complete, and <code>null</code> when the field is cleared.
        </p>
      </Callout>
      <CodeBlock code={value} />

      <Section title="Typing">
        <Prose>
          <p>
            The two days are read as forgivingly as by{" "}
            <code>DateTimePicker</code>: any separators and zeros in a day (
            <code>1.9.2026</code>), a year left out - the current one - or of
            two digits (<code>1.9. – 30.9.</code>, <code>1.9.26 – 30.9.26</code>
            ), and anything but digits between the days - a dash, <code>-</code>
            , <code>~</code>, <code>..</code>, a word or a space (
            <code>1.9.2026 30.9.2026</code>) - also days in ISO 8601 (
            <code>2026-09-01/2026-09-30</code>). A year left out comes from the
            other day: <code>28.12. – 3.1.</code> ends in the next year,{" "}
            <code>28.12. – 3.1.2027</code> starts in the one before. A reversed
            pair is swapped, and one day alone is a range of that day. Enter or
            leaving the field takes the text; one that is no allowed range (a
            day that does not exist, out of <code>min</code> / <code>max</code>,
            too short or too long) is dropped - the field shows the range again,
            and a message under it says why.
          </p>
        </Prose>
      </Section>

      <Section title="Keyboard">
        <Prose>
          <ul>
            <li>
              ArrowDown or Enter in the field opens the calendar and moves into
              it; Tab and Shift + Tab move through the presets, the month
              navigation and the days, and out of the popup.
            </li>
            <li>
              Enter or Space on a day picks it - the first press the first day,
              the second the last. While the last day is picked, the range
              follows the focus.
            </li>
            <li>
              The arrow keys move by a day and a week, on from one month into
              the other - past the second month the months move along. Home /
              End go to the first and the last day of the week, Page Up / Down
              by a month, with Shift by a year.
            </li>
            <li>
              Escape closes the popup and drops a range picked halfway. The
              first day of the week comes from the locale.
            </li>
          </ul>
        </Prose>
      </Section>

      <Example
        description={
          <p>
            <code>presets</code> lists built-in ranges by their key -{" "}
            <code>today</code>, <code>yesterday</code>, <code>last7Days</code>{" "}
            and <code>last30Days</code> (ending today), <code>thisWeek</code> /{" "}
            <code>lastWeek</code> (from the first day of the week of the
            locale), <code>thisMonth</code> / <code>lastMonth</code> and{" "}
            <code>thisYear</code> / <code>lastYear</code> (whole periods) - and
            ranges of your own as <code>{"{ label, range }"}</code>.{" "}
            <code>presets</code> alone offers today, yesterday, the last 7 and
            30 days, this month and last month. A preset reaching over{" "}
            <code>min</code> / <code>max</code> is cut to them - with a{" "}
            <code>max</code> of today, "This month" is the month so far - and
            one with no day left, or not as long as <code>minDays</code> /{" "}
            <code>maxDays</code> allow, is disabled. The preset of the selected
            range is marked.
          </p>
        }
        name="date-range-picker/presets"
        title="Presets"
      />

      <Example
        description={
          <p>
            <code>min</code> / <code>max</code> (<code>YYYY-MM-DD</code>)
            disable the days outside them. <code>minDays</code> /{" "}
            <code>maxDays</code> limit the length of the range, counting both
            ends (a week is 7 days): once the first day is picked, the days that
            would make the range too short or too long cannot end it - they can
            still take the keyboard focus, so the arrow keys move over them.
          </p>
        }
        name="date-range-picker/limits"
        title="Limits"
      />

      <Example
        description={
          <p>
            <code>startName</code> and <code>endName</code> submit the days in
            hidden inputs, <code>name</code> the range as one ISO 8601 interval
            - an empty value without a range. <code>required</code> is enforced
            by the browser, <code>form.reset()</code> brings back the{" "}
            <code>defaultValue</code> (a controlled picker keeps its{" "}
            <code>value</code>), and <code>form</code> ties the picker to a form
            elsewhere in the page.
          </p>
        }
        name="date-range-picker/form"
        title="Forms"
      />
      <CodeBlock code={submitted} />
      <Prose>
        <p>
          With React Hook Form, use <code>Controller</code> -{" "}
          <code>onChange</code> gets the range itself, not an event:
        </p>
      </Prose>
      <CodeBlock code={hookForm} />

      <Example
        description={
          <p>
            <code>error</code> marks the field as invalid and{" "}
            <code>description</code> adds a help text under it - the field is
            described by both, the error first. <code>readOnly</code> shows and
            submits the range but does not open the calendar;{" "}
            <code>disabled</code> neither. A <code>required</code> field has no
            clear button unless <code>clearable</code> says so; <code>dim</code>{" "}
            sets its size, and <code>aria-label</code> names a field without a
            label.
          </p>
        }
        name="date-range-picker/states"
        title="States"
      />

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              Other native attributes - <code>aria-*</code>, <code>data-*</code>
              , <code>title</code>, <code>autoFocus</code>, key and pointer
              handlers - go to the visible field, and <code>ref</code> points at
              it (its <code>value</code> is the text it shows).
            </li>
            <li>
              <code>onFocus</code> and <code>onBlur</code> treat the field, its
              clear button and its popup as one: the focus moving between them
              is no blur.
            </li>
            <li>
              The presets count from the day the popup opens, in the browser -
              server rendering shows the field only.
            </li>
            <li>
              For a single day, a month or a week, use{" "}
              <code>DateTimePicker</code>.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="DateRangePicker" />
        <PropsTable of="DateRange" />
        <PropsTable of="DateRangePreset" />
      </Section>
    </DocPage>
  );
}
