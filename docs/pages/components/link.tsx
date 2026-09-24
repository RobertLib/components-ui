import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function LinkPage() {
  return (
    <DocPage imports={["Link"]} title="Link">
      <Example
        description={
          <p>
            A path goes through the router's <code>Link</code> set up in{" "}
            <code>UIProvider</code> (see Routing) - no page reload. An address
            with a scheme (<code>https:</code>, <code>mailto:</code>,{" "}
            <code>tel:</code>), an anchor on the page and a download are plain
            links. <code>external</code> opens the page in a new tab. The color
            is one of the theme colors, or <code>inherit</code> for the color of
            the text around.
          </p>
        }
        name="link/basic"
        title="Links in text"
      />

      <Section title="Accessibility">
        <Prose>
          <p>
            Links are underlined by default: in running text, the underline
            tells a link apart from the text around without relying on color.
            Use <code>underline="hover"</code> where it is clear what is a link
            - a column of names in a table, a navigation list. An{" "}
            <code>external</code> link gets <code>target="_blank"</code>,{" "}
            <code>rel="noopener noreferrer"</code>, an icon, and "(opens in a
            new tab)" for screen readers - in the language of the page.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Link" />
      </Section>
    </DocPage>
  );
}
