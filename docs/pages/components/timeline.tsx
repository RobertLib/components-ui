import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function TimelinePage() {
  return (
    <DocPage imports={["Timeline", "type TimelineItem"]} title="Timeline">
      <Example
        description={
          <p>
            An activity or audit log: each item has a <code>title</code> (any
            content - who did what), a <code>time</code>, and optionally a{" "}
            <code>description</code>, more <code>content</code> (the changed
            values), an <code>icon</code> and a <code>color</code> - one of the
            theme colors: <code>primary</code> (the default),{" "}
            <code>secondary</code>, <code>success</code>, <code>danger</code>,{" "}
            <code>warning</code>, <code>info</code> or <code>neutral</code>.
            List the items in the order they should read - newest first here.
          </p>
        }
        name="timeline/activity"
        title="Activity log"
      />
      <Example
        description={
          <p>
            A <code>pending</code> item is still to come: its marker spins (or
            shows its <code>icon</code> in a dashed circle), the line to it is
            dashed, and screen readers hear "Pending" after its title.{" "}
            <code>loading</code> shows placeholders instead of the items.
          </p>
        }
        name="timeline/pending"
        title="Pending items and loading"
      />
      <Example
        description={
          <p>
            <code>size="sm"</code> has smaller markers and less space between
            the items. Without an <code>icon</code> an item has a dot in its{" "}
            <code>color</code>. A <code>time</code> given as a string is shown
            as it is - e.g. a relative time the app writes.
          </p>
        }
        name="timeline/compact"
        title="Compact"
      />
      <Example
        description={
          <p>
            <code>alternate</code> puts the items on both sides of the line in
            turn, with their time across the line. On phones (below the{" "}
            <code>md</code> breakpoint) they stay on one side. Dates here are
            written without the time - <code>timeFormat</code> takes the options
            of <code>Intl.DateTimeFormat</code>.
          </p>
        }
        name="timeline/alternate"
        title="Both sides of the line"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            The timeline is an ordered list (<code>{"<ol>"}</code>) of the
            items; a date is a <code>{"<time>"}</code> element with its{" "}
            <code>dateTime</code>. The markers are decorative - their color and
            icon are hidden from screen readers, so say in the title what they
            show ("… rejected the order"). Name a timeline that has no heading
            with <code>aria-label</code>.
          </p>
        </Prose>
      </Section>

      <Callout title="Dates and server rendering">
        <p>
          Dates are written by the locale of <code>UIProvider</code>, on its 12-
          or 24-hour clock, in the time zone of the device. A page rendered on
          the server (e.g. Next.js) writes them in the time zone of the server -
          and hydration then finds other texts in the browser. Pass the time
          zone of the user in <code>timeFormat</code> (
          <code>{'{ dateStyle: "medium", timeStyle: "short", timeZone }'}</code>
          ), or strings written by the app.
        </p>
      </Callout>

      <Section title="Props">
        <PropsTable of="Timeline" />
        <PropsTable of="TimelineItem" />
      </Section>
    </DocPage>
  );
}
