import CodeBlock from "../../components/code-block";
import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

const changeEvent = `// What onChange gets - shaped like the change event of a native input
interface DateTimePickerChangeEvent {
  target: { name: string; value: string };        // value "2026-09-24", "" when cleared
  currentTarget: { name: string; value: string }; // the same
  type: string;                                   // "change"
  preventDefault(): void;                         // does nothing
  stopPropagation(): void;                        // does nothing
}`;

const hookForm = `<Controller
  control={control}
  name="deadline"
  render={({ field }) => (
    <DateTimePicker {...field} label="Deadline" type="date" />
  )}
/>`;

export default function DateTimePickerPage() {
  return (
    <DocPage imports={["DateTimePicker"]} title="DateTimePicker">
      <Example
        description={
          <>
            <p>
              One component for all five native types. The value can be typed in
              the display format of the locale - forgiving about separators and
              zeros (<code>3.7.1985</code>), and a time without its minutes is
              the full hour (<code>14</code>, <code>5 pm</code>;{" "}
              <code>930</code> is 9:30) - or picked in the popup: with the mouse
              or the keyboard. ArrowDown opens it and moves into it, Tab and
              Shift + Tab move through it and out of it, Enter picks, Escape
              closes. The month and year selects of the date popup jump far,
              e.g. to a birth date.
            </p>
            <p>
              A year after the day and the month (or the week) may be left out -
              it is the current one (<code>24.9.</code>) - or typed with two
              digits, which stand for one of the 80 years before the current one
              or the 19 after it (in 2026 <code>3.7.85</code> is 1985 and{" "}
              <code>24.9.26</code> is 2026). A day and a month typed without a
              year and without a separator need two digits each (
              <code>2409</code>).
            </p>
            <p>
              A value pasted in ISO 8601 is taken in any locale -{" "}
              <code>2026-09-24</code>, <code>2026-09-24T14:30</code> (a
              date-time with a zone, <code>…Z</code> or <code>…+02:00</code>, on
              the local clock), <code>2026-09</code>, <code>2026-W39</code>. A
              day alone typed into a date-time field keeps the time it had
              (midnight without one), like a day picked in the popup. A text
              that is no value, or one out of <code>min</code> /{" "}
              <code>max</code>, is dropped - the field shows its value again,
              and a message under it says why and in which format to type it.
              The placeholder shows that format with the tokens of the language
              (<code>DD.MM.RRRR</code> in Czech).
            </p>
          </>
        }
        name="datetime-picker/types"
        title="Types"
      />

      <Callout title="Value and display format">
        <p>
          The value is always in the format of the native input -{" "}
          <code>YYYY-MM-DD</code>, <code>HH:mm</code>,{" "}
          <code>YYYY-MM-DDTHH:mm</code>, <code>YYYY-MM</code> and{" "}
          <code>YYYY-Www</code> - so it can be sent to an API as it is. What the
          user sees and types follows the <code>formats</code> of the active
          locale (<code>09/24/2026 2:30 PM</code> in English,{" "}
          <code>24.09.2026 14:30</code> in Czech), and month and weekday names
          and AM / PM come from <code>Intl</code>.
        </p>
      </Callout>

      <Section title="Keyboard">
        <Prose>
          <ul>
            <li>
              Days: the arrow keys move by a day and a week, Home / End to the
              first and the last day of the week (of the locale), Page Up / Down
              by a month - with Shift by a year. The months the buttons and the
              selects show are announced to screen readers.
            </li>
            <li>
              Months and weeks: the arrow keys move on into the next or the
              previous year, Home / End to the first and the last month or week
              of the year, Page Up / Down by a year - with Shift by ten.
            </li>
            <li>
              Hours and minutes: the arrow keys move to the next or the previous
              option, Home / End to the first and the last one that can be
              picked, Page Up / Down by what the list shows at once.
            </li>
            <li>
              All of them stop at <code>min</code> / <code>max</code>. The month
              and year buttons page with Enter and Space; elsewhere in the date
              popup Page Up / Down pages without moving the focus.
            </li>
          </ul>
        </Prose>
      </Section>

      <Example
        description={
          <p>
            <code>onChange</code> gets an event-like object, so{" "}
            <code>event.target.value</code> and <code>event.target.name</code>{" "}
            work as with a native input.
          </p>
        }
        name="datetime-picker/controlled"
        title="Controlled"
      />

      <Section title="The change event">
        <Prose>
          <p>
            No DOM element stands behind the event of the custom picker - its
            field shows the formatted value, not the value itself:
          </p>
        </Prose>
        <CodeBlock code={changeEvent} />
        <Prose>
          <p>
            A handler typed for native change events is accepted too - it may
            read only these fields. In <code>native</code> mode the event is the
            input's own. With React Hook Form, use <code>Controller</code>:{" "}
            <code>register()</code> passes its <code>ref</code> to the visible
            field and writes default values and <code>setValue()</code> into it
            as text, which the picker does not read back. Only in{" "}
            <code>native</code> mode, where the field is the native input,{" "}
            <code>register()</code> works as with <code>Input</code>.
          </p>
        </Prose>
        <CodeBlock code={hookForm} />
      </Section>

      <Example
        description={
          <p>
            <code>min</code> / <code>max</code> (in the value format) disable
            the days, months, weeks and times outside the range, and a picked
            date and time is kept inside it - the arrow keys stop at the first
            and the last allowed one. A time range whose <code>min</code> comes
            after its <code>max</code> (<code>22:00</code> - <code>06:00</code>)
            spans midnight, as for a native input. <code>minuteStep</code>{" "}
            limits the minutes - <code>quarterMinutesOnly</code> is a shorthand
            for 15 - and moves a picked, typed or clamped time onto them: a
            date-time to the nearest one, also the midnight of the next day, a
            time alone to the nearest one of its day (<code>23:58</code> stays{" "}
            <code>23:55</code> with a step of 5). <code>description</code> adds
            a help text under the field - the field is described by it, after
            the error message.
          </p>
        }
        name="datetime-picker/limits"
        title="Limits and minute steps"
      />
      <Example
        description={
          <p>
            <code>mode="native"</code> renders the browser's own input instead -
            handy on mobile devices. <code>minuteStep</code> becomes its{" "}
            <code>step</code>.
          </p>
        }
        name="datetime-picker/native"
        title="Native mode"
      />

      <Section title="Notes">
        <Prose>
          <ul>
            <li>
              With a <code>name</code>, a hidden input submits the value with
              the form (also a form given by the <code>form</code> attribute);{" "}
              <code>required</code> is enforced by the browser.
            </li>
            <li>
              Other native attributes - <code>aria-*</code>, <code>data-*</code>
              , <code>title</code>, <code>tabIndex</code>,{" "}
              <code>autoFocus</code>, key and pointer handlers - go to the
              visible field. A key handler runs first; preventing the default
              skips the picker's own handling of the key.
            </li>
            <li>
              <code>ref</code> points at the visible field, e.g. for{" "}
              <code>focus()</code> - its <code>value</code> is the text it
              shows. The value itself comes with <code>onChange</code>.
            </li>
            <li>
              <code>onFocus</code> and <code>onBlur</code> treat the field, its
              clear button and its popup as one: the focus moving between them
              is no blur, and the events are those of the field.
            </li>
            <li>
              The first day of the week comes from the locale (
              <code>weekStartsOn</code>); the week picker always uses ISO weeks,
              which start on Monday, and labels them by the locale's week format
              (<code>W39</code>).
            </li>
            <li>
              The time columns follow the time format of the locale - 12 AM to
              11 PM in English, 00 to 23 in Czech.
            </li>
            <li>
              For a from - to range of days, use <code>DateRangePicker</code>.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="DateTimePicker" />
      </Section>
    </DocPage>
  );
}
