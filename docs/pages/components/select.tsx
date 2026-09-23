import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function SelectPage() {
  return (
    <DocPage imports={["Select"]} title="Select">
      <Example
        description={
          <p>
            A native <code>&lt;select&gt;</code> styled like the other fields -
            the best choice for a short, fixed list. <code>hasEmpty</code> adds
            an empty first option. Option values may be strings or numbers;{" "}
            <code>event.target.value</code> is always a string.
          </p>
        }
        name="select/basic"
        title="Basic"
      />

      <Section title="When to use Autocomplete instead">
        <Prose>
          <p>
            For long lists, searching, multiple selection or options loaded from
            an API, use <code>Autocomplete</code> - with <code>asSelect</code>{" "}
            it behaves like a select but renders the library's own list.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="Select" />
      </Section>
    </DocPage>
  );
}
