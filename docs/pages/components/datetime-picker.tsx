import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function DateTimePickerPage() {
  return (
    <DocPage imports={["DateTimePicker"]} title="DateTimePicker">
      <Example
        description={
          <p>
            One component for all five native types. The value can be typed in
            the display format of the locale - forgiving about separators and
            zeros (<code>3.7.1985</code>) - or picked in the popup: with the
            mouse or the keyboard (ArrowDown opens it, then arrows, Page Up /
            Down - with Shift by years - Home / End, Enter, Escape). The month
            and year selects of the date popup jump far, e.g. to a birth date.
          </p>
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
          come from <code>Intl</code>.
        </p>
      </Callout>

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
      <Example
        description={
          <p>
            <code>min</code> / <code>max</code> (in the value format) disable
            the days, months, weeks and times outside the range, and a picked
            date and time is kept inside it - the arrow keys stop at the first
            and the last allowed one. <code>minuteStep</code> limits the minutes
            - <code>quarterMinutesOnly</code> is a shorthand for 15.
          </p>
        }
        name="datetime-picker/limits"
        title="Limits and minute steps"
      />
      <Example
        description={
          <p>
            <code>mode="native"</code> renders the browser's own input instead -
            handy on mobile devices.
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
              the form; <code>required</code> is enforced by the browser.
            </li>
            <li>
              The first day of the week comes from the locale (
              <code>weekStartsOn</code>); the week picker always uses ISO weeks,
              which start on Monday.
            </li>
            <li>The time columns use the 24-hour clock.</li>
          </ul>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="DateTimePicker" />
      </Section>
    </DocPage>
  );
}
