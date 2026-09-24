import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function SelectPage() {
  return (
    <DocPage imports={["Select", "type SelectOptionGroup"]} title="Select">
      <Example
        description={
          <p>
            A native <code>&lt;select&gt;</code> styled like the other fields -
            the best choice for a short, fixed list. <code>hasEmpty</code> adds
            an empty first option (named "No selection" for screen readers).
            Option values may be strings or numbers;{" "}
            <code>event.target.value</code> is always a string. A form reset
            brings back the <code>defaultValue</code> of an uncontrolled select
            and leaves a controlled one showing its <code>value</code>.
          </p>
        }
        name="select/basic"
        title="Basic"
      />
      <Example
        description={
          <p>
            <code>options</code> also takes groups -{" "}
            <code>{"{ label, options }"}</code> - rendered as{" "}
            <code>&lt;optgroup&gt;</code>, and plain options and groups can be
            mixed. An option or a whole group with <code>disabled</code> is
            shown but cannot be picked. <code>description</code> puts help text
            under the field and describes the select with it.
          </p>
        }
        name="select/groups"
        title="Groups, disabled options and a description"
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
        <PropsTable of="SelectOption" />
        <PropsTable of="SelectOptionGroup" />
      </Section>
    </DocPage>
  );
}
