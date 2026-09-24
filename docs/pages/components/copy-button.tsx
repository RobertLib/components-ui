import { Link } from "react-router";
import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function CopyButtonPage() {
  return (
    <DocPage imports={["CopyButton"]} title="CopyButton">
      <Example
        description={
          <p>
            A click (or Enter / Space) copies <code>value</code>. For two
            seconds (<code>timeout</code>) the icon is a check mark, and the
            name and the tooltip say "Copied" - the localized{" "}
            <code>copyButton</code> texts. Give each button of a page a{" "}
            <code>label</code> that says what it copies.
          </p>
        }
        name="copy-button/basic"
        title="Copying a value"
      />
      <Example
        description={
          <p>
            <code>onCopied</code> is called once the text is in the clipboard.
            The click does not bubble past the button - one in a clickable row
            or card does not click it too. It takes the props of{" "}
            <Link to="/components/icon-button">IconButton</Link>, like{" "}
            <code>variant</code>.
          </p>
        }
        name="copy-button/api-keys"
        title="In a list"
      />

      <Section title="When copying fails">
        <Prose>
          <p>
            Browsers let a page write to the clipboard only right after a click
            or a key press, and some ask the user first. When it fails, the
            button shows a cross and says "Copying failed" for the same time. On
            pages served over plain <code>http://</code>, which have no
            Clipboard API, it copies the old way (a selection and the copy
            command). For a button of your own, use{" "}
            <Link to="/guides/utilities">useClipboard</Link>.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="CopyButton" />
      </Section>
    </DocPage>
  );
}
