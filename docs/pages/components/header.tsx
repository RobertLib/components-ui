import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function HeaderPage() {
  return (
    <DocPage imports={["Header"]} title="Header">
      <Example
        description={
          <p>
            The page title with actions at the end - on the right, on the left
            right to left, and a <code>description</code> under it.{" "}
            <code>back</code> adds an arrow (pointing to the start of the line)
            that goes back in the history through the configured router (or runs{" "}
            <code>onBack</code>); <code>backHref</code> makes it a link instead
            - to the list a detail belongs to, which a page opened from a link
            or in a new tab has no history of; <code>onBack</code> then runs at
            its click (not at one opening a new tab), and{" "}
            <code>event.preventDefault()</code> keeps the page (unsaved
            changes). <code>afterTitle</code> sits right next to the heading.
            The heading takes the <code>--font-heading</code> and{" "}
            <code>--text-page-title</code> tokens (see Theming). While the title
            loads (<code>null</code> or <code>undefined</code>) a placeholder
            shows, and screen readers find the heading saying "Loading…". The
            title is the <code>h1</code> of the page - a header of a section or
            a dialog takes a lower <code>headingLevel</code>.
          </p>
        }
        name="header/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>breadcrumbs</code> shows the path to the page above the title
            - <code>BreadcrumbItem</code>s become <code>Breadcrumbs</code> with
            the home crumb first, the last one the page itself; pass your own
            element for other options, like a long path collapsed with{" "}
            <code>maxItems</code>. An empty list shows nothing (the home page).
            The children go under the row of the title, across the whole header
            - the key facts of a record, the <code>Tabs</code> of its pages.
            Printed, the back arrow and the actions are left out, the path and
            the title stay.
          </p>
        }
        name="header/breadcrumbs"
        title="Breadcrumbs and details"
      />

      <Section title="Props">
        <PropsTable of="Header" />
      </Section>
    </DocPage>
  );
}
