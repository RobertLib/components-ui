import DocPage, { Callout, Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function ChangeHistoryPage() {
  return (
    <DocPage
      imports={[
        "ChangeHistory",
        "type ChangeHistoryEntry",
        "type ChangeHistoryField",
      ]}
      title="ChangeHistory"
    >
      <Example
        description={
          <p>
            Each entry has an <code>id</code>, a <code>time</code> (a{" "}
            <code>Date</code>, an ISO text or a timestamp), an{" "}
            <code>action</code>, an <code>author</code> and the{" "}
            <code>changes</code> - the field, its value before and after. The
            entries of a day are under its heading (&quot;Today&quot;,
            &quot;Yesterday&quot;, a date); a time of the last{" "}
            <code>absoluteAfterDays</code> days (7 by default) reads &quot;5
            minutes ago&quot;, an older one shows the time of day.{" "}
            <code>created</code>, <code>updated</code> and <code>deleted</code>{" "}
            are written in the language of the page, another action
            (&quot;Approved&quot;) as it is. An author without{" "}
            <code>avatarUrl</code> shows their initials, an entry without an
            author is the system&apos;s. <code>fields</code> name the fields and
            write their values (<code>formatValue</code>) - by default dates and
            numbers by the locale, booleans as Yes / No, and an empty value as
            &quot;—&quot;. A <code>comment</code> shows under the changes.
          </p>
        }
        name="change-history/basic"
        title="The history of an invoice"
      />
      <Example
        description={
          <p>
            A text longer than <code>longTextLength</code> (120 characters) or
            of several lines is compared word by word in one cell - removed
            words struck through, added ones highlighted, and the unchanged text
            around the changes shortened, with &quot;Show all&quot; for the
            whole of it. <code>diff: true</code> of a field compares every
            change of it so, <code>diff: false</code> never.
          </p>
        }
        name="change-history/long-text"
        title="Long texts"
      />
      <Example
        description={
          <p>
            <code>filterable</code> adds the filters of the fields and the
            authors of the entries - a field filter shows only the change of
            that field. They filter the entries given; a controlled{" "}
            <code>filter</code> with <code>onFilterChange</code> lets the app
            load others from a server. A field or an author picked stays among
            the options when the entries no longer have it, so the filter shows
            and can be undone. While <code>hasMore</code>, &quot;Load older
            changes&quot; calls <code>onLoadMore</code> - append the older
            entries to <code>entries</code>. A returned promise shows the button
            loading, and when it rejects an error with &quot;Try again&quot;.{" "}
            <code>loading</code> shows placeholders, a history without entries
            &quot;No changes yet&quot; - or your <code>empty</code>.{" "}
            <code>size=&quot;sm&quot;</code> is compact.
          </p>
        }
        name="change-history/load-more"
        title="Filters, loading older changes and states"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            Each day is a heading - of <code>headingLevel</code> (3 by default),
            so fit it into the outline of the page - and a list of its entries
            named by that heading. The time of an entry is a{" "}
            <code>{"<time>"}</code> element with the moment in{" "}
            <code>dateTime</code> and the full date and time in its title. The
            markers are decorative; the name of the author and the action are
            text.
          </p>
          <p>
            The changes are a table whose rows are headed by the field. An empty
            value shows as &quot;—&quot; and is read as &quot;empty&quot;; in a
            word diff the removed and added words are announced as such
            (&quot;removed: …&quot;, &quot;added: …&quot;), and the comment as
            &quot;Comment:&quot;. Once older entries are loaded, screen readers
            hear how many arrived, and the focus moves to the first of them when
            the button it was on is gone.
          </p>
        </Prose>
      </Section>

      <Callout title="Server rendering">
        <p>
          The server (e.g. Next.js) knows neither the time zone of the user nor
          the moment the page is read. Without <code>timeZone</code>, a history
          rendered there shows its entries in one list, without the day headings
          and the times, until it has hydrated. With <code>timeZone</code> (e.g.{" "}
          <code>&quot;Europe/Prague&quot;</code>) the server writes the days as
          dates and the times as absolute dates and times in that zone; once
          hydrated, they become &quot;Today&quot;, &quot;Yesterday&quot; and
          relative times, written again every minute. A zone the browser does
          not know is replaced by the browser&apos;s, with a warning in the
          console.
        </p>
      </Callout>

      <Section title="Props">
        <PropsTable of="ChangeHistory" />
        <PropsTable of="ChangeHistoryEntry" />
        <PropsTable of="ChangeHistoryChange" />
        <PropsTable of="ChangeHistoryAuthor" />
        <PropsTable of="ChangeHistoryField" />
        <PropsTable of="ChangeHistoryFilter" />
      </Section>
    </DocPage>
  );
}
