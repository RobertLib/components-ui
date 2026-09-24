import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function EmptyStatePage() {
  return (
    <DocPage imports={["EmptyState"]} title="EmptyState">
      <Example
        description={
          <p>
            An <code>icon</code> (sized to fit), the <code>title</code> - a
            heading - a <code>description</code> and the <code>action</code>{" "}
            that leads on: a button, or several in a fragment. It has no frame
            of its own - put it into a <code>Panel</code>, a table or a page.
          </p>
        }
        name="empty-state/basic"
        title="First run"
      />
      <Example
        description={
          <p>
            <code>size="sm"</code> is compact - for a search without results, a
            table, a card or a popover.
          </p>
        }
        name="empty-state/search"
        title="No results"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            The title is a heading of level 3 - set <code>headingLevel</code> to
            fit the outline of the page (2 when the empty state is all the page
            shows). An empty state that appears after a search is not announced
            by itself; tell screen reader users of the result where they typed,
            e.g. with a live region that says the number of results.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="EmptyState" />
      </Section>
    </DocPage>
  );
}
