import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function TabsPage() {
  return (
    <DocPage imports={["Tabs"]} title="Tabs">
      <Example
        description={
          <p>
            Items with a <code>value</code> are buttons - pass the selected{" "}
            <code>value</code> and <code>onChange</code>.
          </p>
        }
        name="tabs/value"
        title="Switching local state"
      />
      <Example
        description={
          <p>
            Items with an <code>href</code> are links rendered by the router of{" "}
            <code>UIProvider</code>. A tab is active on its path and below it.
          </p>
        }
        name="tabs/links"
        title="Navigation tabs"
      />
      <Example name="tabs/query" title="Tabs by a query parameter" />
      <Example name="tabs/sizes" title="Sizes and loading" />

      <Section title="Notes">
        <Prose>
          <p>
            Do not mix link and value items in one bar. Value tabs have{" "}
            <code>role="tab"</code> in a <code>tablist</code> and are one tab
            stop - the arrow keys and Home / End select the next one; link tabs
            are plain links with <code>aria-current="page"</code>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Tabs" />
        <PropsTable of="LinkTabItem" />
        <PropsTable of="ValueTabItem" />
      </Section>
    </DocPage>
  );
}
