import DocPage, { Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function BreadcrumbsPage() {
  return (
    <DocPage imports={["Breadcrumbs"]} title="Breadcrumbs">
      <Example
        description={
          <p>
            The first crumb is the home page - the localized "Home" linking to{" "}
            <code>/</code> unless <code>home</code> says otherwise, or{" "}
            <code>{"home={false}"}</code> removes it. The last item is the
            current page and is never a link; an item without <code>href</code>{" "}
            before it shows as text. On a narrow screen the crumbs wrap onto
            more lines. The separators are hidden from screen readers, which
            announce the crumbs as a list.
          </p>
        }
        name="breadcrumbs/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>maxItems</code> collapses a longer path to its ends: the first{" "}
            <code>itemsBeforeCollapse</code> crumbs (1 - the home crumb counts),
            a "…" button and the last <code>itemsAfterCollapse</code> ones (1).
            The button - "Show the whole path" for screen readers - shows the
            rest in place and moves the focus to the first crumb it brings.{" "}
            <code>separator</code> replaces the "&gt;" between the crumbs, e.g.
            with an icon - mirrored in a right-to-left page.
          </p>
        }
        name="breadcrumbs/collapsed"
        title="A long path and separators"
      />

      <Section title="Props">
        <PropsTable of="Breadcrumbs" />
        <PropsTable of="BreadcrumbItem" />
      </Section>
    </DocPage>
  );
}
