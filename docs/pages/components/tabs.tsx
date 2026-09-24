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
            <code>UIProvider</code>. A tab is active on its path and below it,
            the most specific one of several. A relative path (
            <code>settings</code>) is resolved against the current page as the
            browser resolves it, and neither percent-encoding nor a trailing
            slash makes a difference: <code>/nastavení</code> is active on{" "}
            <code>/nastaven%C3%AD/</code>.
          </p>
        }
        name="tabs/links"
        title="Navigation tabs"
      />
      <Example
        description={
          <p>
            With <code>includeQueryParams</code> the tabs of one page differ by
            their query. The tab whose parameters all match the URL is active -
            of several, the one with the most, so <code>/orders</code> ("All")
            and <code>/orders?tab=archived</code> work side by side. While the
            URL has none of the tab parameters, the first tab is active.
          </p>
        }
        name="tabs/query"
        title="Tabs by a query parameter"
      />
      <Example
        description={
          <p>
            <code>icon</code> is shown before the label - any icon, e.g. from
            lucide-react. A tab with the icon alone keeps its name for screen
            readers in a visually hidden label, like the view switcher here:{" "}
            <code>{'label: <span className="sr-only">Grid</span>'}</code>. A{" "}
            <code>disabled</code> tab is dimmed: it cannot be selected and the
            arrow keys skip it. A disabled link tab has no <code>href</code> -
            nothing opens it, and Tab skips it too.
          </p>
        }
        name="tabs/icons"
        title="Icons and disabled tabs"
      />
      <Example
        description={
          <p>
            <code>orientation="vertical"</code> stacks the tabs in a column -
            value tabs are then switched with the up and down arrows. A column
            leaves little room for the content on a phone: switch to a row there
            with <code>useIsMobile()</code>, like this example.
          </p>
        }
        name="tabs/vertical"
        title="Vertical tabs"
      />
      <Example
        description={
          <p>
            A bar wider than its container scrolls sideways - by touch, a
            trackpad or its scrollbar. The edges that hide more tabs fade out,
            and the active tab is scrolled into view, also when the page opens
            on it, the bar gets narrower (a phone turned) or the keyboard
            reaches a tab under a fade.
          </p>
        }
        name="tabs/overflow"
        title="More tabs than room"
      />
      <Example name="tabs/sizes" title="Sizes and loading" />

      <Section title="Notes">
        <Prose>
          <p>
            Do not mix link and value items in one bar. Value tabs have{" "}
            <code>role="tab"</code> in a <code>tablist</code> and are one tab
            stop - the arrow keys (left / right, or up / down in a vertical
            list) and Home / End select the next enabled tab, around the ends;
            in a right-to-left page left is the next tab. The selected tab takes
            the focus, or the first enabled one. Link tabs are plain links with{" "}
            <code>aria-current="page"</code>. Name a bar that is not labeled by
            a heading next to it with <code>aria-label</code>.
          </p>
          <p>
            To tie a value tab to the content it shows, give the item an{" "}
            <code>id</code> and a <code>panelId</code> (its{" "}
            <code>aria-controls</code>) and render the content as{" "}
            <code>
              {'<div role="tabpanel" id={panelId} aria-labelledby={id}>'}
            </code>
            .
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
