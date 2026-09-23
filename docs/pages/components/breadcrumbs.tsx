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
            current page and is never a link.
          </p>
        }
        name="breadcrumbs/basic"
        title="Basic"
      />

      <Section title="Props">
        <PropsTable of="Breadcrumbs" />
        <PropsTable of="BreadcrumbItem" />
      </Section>
    </DocPage>
  );
}
