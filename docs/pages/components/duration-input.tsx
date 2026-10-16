import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function DurationInputPage() {
  return (
    <DocPage imports={["DurationInput"]} title="DurationInput">
      <Example
        description={
          <p>
            The value is a number of minutes, <code>null</code> for an empty
            field. Type the time spent the way you think of it -
            &quot;2:30&quot;, &quot;2,5&quot;, &quot;2h 30m&quot; - and the
            field shows it as &quot;2:30&quot; once the focus leaves. Arrow Up /
            Down add or take 15 minutes (<code>step</code>), Page Up / Down an
            hour, and Home / End jump to <code>min</code> / <code>max</code>{" "}
            when they are given. The total is a <code>readOnly</code> field.
          </p>
        }
        name="duration-input/basic"
        title="Work report"
      />

      <Section title="Typing">
        <Prose>
          <ul>
            <li>
              Hours and minutes: &quot;1:30&quot;, &quot;:45&quot; (45 minutes),
              &quot;125:00&quot;, also with seconds (&quot;1:30:00&quot;).
            </li>
            <li>
              A number with a fraction is hours - &quot;1,5&quot; and
              &quot;1.5&quot; in any language. A whole number is minutes
              (&quot;90&quot;), or hours with{" "}
              <code>defaultUnit=&quot;hours&quot;</code> (&quot;8&quot; is
              8:00).
            </li>
            <li>
              Units, with or without spaces, in any case, with or without
              diacritics: &quot;1.5h&quot;, &quot;90m&quot;, &quot;1h 30m&quot;,
              &quot;1h30&quot;, &quot;1 h 30 min&quot;, &quot;2 hours and 15
              minutes&quot;, &quot;1 hodina 30 minut&quot;, &quot;2 hodiny a 5
              minut&quot;. The Czech and English words (h, hod, hodina, hr, hrs,
              hour, m, min, minuta, minute, s, sec, sekunda, …) are read in
              every language, and so are the words the field itself writes in
              the language of <code>UIProvider</code>.
            </li>
            <li>
              ISO 8601 durations: &quot;PT1H30M&quot;, &quot;PT90M&quot;,
              &quot;P1DT2H&quot; (a day is 24 hours).
            </li>
            <li>
              Fractions of a minute round to whole minutes - &quot;90s&quot; is
              2 minutes.
            </li>
          </ul>
          <p>
            The typed text is read on every keystroke - a form submitted
            meanwhile gets that duration, and a text that is none makes the form
            invalid. <code>onChange</code> gets the value when the focus leaves
            the field or on Enter (which then submits the form), when a key
            steps it and when the field is emptied. A typed duration outside{" "}
            <code>min</code> - <code>max</code> is moved into them then; a text
            that is no duration, or a negative one, is dropped - the field shows
            its value again and a message under it, read by screen readers, says
            why. Escape goes back to the value.
          </p>
        </Prose>
      </Section>

      <Example
        description={
          <p>
            <code>display=&quot;clock&quot;</code> (default) writes hours and
            minutes, <code>display=&quot;units&quot;</code> the units of the
            language - &quot;2 hr 15 min&quot; in English, &quot;2 h 15
            min&quot; in Czech. Either can be typed whatever the field shows.
            The few languages whose units the field could not read back - a unit
            before the number, or a number in words - get the clock.
          </p>
        }
        name="duration-input/display"
        title="Clock or units"
      />
      <Example
        description={
          <p>
            <code>valueFormat</code> chooses what <code>value</code>,{" "}
            <code>defaultValue</code>, <code>onChange</code> and the form work
            with: minutes (default), seconds (still edited in whole minutes), or
            an ISO 8601 text like &quot;PT1H30M&quot; - &quot;PT0S&quot; for
            none. A duration written otherwise (&quot;PT90M&quot;) is read, and
            it is no change until the user changes it. <code>min</code>,{" "}
            <code>max</code> and <code>step</code> are minutes in each format.
          </p>
        }
        name="duration-input/value-formats"
        title="SLA times - ISO 8601 and seconds"
      />
      <Example
        description={
          <p>
            With a <code>name</code> a hidden input submits the value in its
            format - minutes &quot;90&quot;, seconds &quot;5400&quot;, ISO
            &quot;PT1H30M&quot;, empty for no value; the visible field has no
            name. A value outside <code>min</code> - <code>max</code> from the
            parent makes the form invalid, as in a native number input, and a
            form reset brings back the <code>defaultValue</code>.
          </p>
        }
        name="duration-input/form"
        title="In a form"
      />
      <Example
        description={
          <p>
            It is an <code>Input</code> underneath: <code>dim</code>,{" "}
            <code>floating</code>, <code>error</code>, <code>description</code>,{" "}
            <code>prefix</code> / <code>suffix</code>, <code>clearable</code>{" "}
            and <code>disabled</code> work the same. A <code>readOnly</code>{" "}
            field is still submitted, but the keys do not step it.
          </p>
        }
        name="duration-input/sizes"
        title="Sizes and states"
      />

      <Section title="Accessibility">
        <Prose>
          <ul>
            <li>
              The field is a <code>spinbutton</code> with the minutes as{" "}
              <code>aria-valuenow</code>, <code>aria-valuemin</code> (0 by
              default), <code>aria-valuemax</code> and the duration in words as{" "}
              <code>aria-valuetext</code> - &quot;1 hour, 30 minutes&quot;,
              &quot;1 hodina a 30 minut&quot;.
            </li>
            <li>
              The message about a dropped text is announced (
              <code>role=&quot;alert&quot;</code>) and describes the field until
              the typing goes on.
            </li>
            <li>
              The keys of an input method editor and those with Alt, Ctrl or
              Meta are left alone; Home and End move the caret unless{" "}
              <code>min</code> / <code>max</code> are given.
            </li>
          </ul>
        </Prose>
        <Callout>
          <p>
            The mouse wheel changes the value only with{" "}
            <code>changeOnWheel</code>, and only while the field has the focus -
            otherwise scrolling a long form over a focused field would change
            it.
          </p>
        </Callout>
      </Section>

      <Section title="Props">
        <PropsTable of="DurationInput" />
      </Section>
    </DocPage>
  );
}
