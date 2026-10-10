import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";
export default function RepeatableFieldPage() {
  return (
    <DocPage
      imports={["RepeatableField", "type RepeatableFieldItem"]}
      title="RepeatableField"
    >
      <Example
        name="repeatable-field/basic"
        title="Repeated form groups"
        description={
          <p>
            Supply stable ids and values for groups, a <code>createItem</code>{" "}
            factory and a <code>renderItem</code> renderer. Add, remove and
            reorder retain existing field nodes and focus the affected group -
            Add after the last group is removed. A value edit calls the
            renderer's <code>onChange</code>, which replaces the value in the
            latest groups: several groups can change in one event, and a group
            updated after an <code>await</code> (an upload, an address lookup)
            keeps what the user typed in the others meanwhile.
          </p>
        }
      />
      <Section title="Forms and validation">
        <Prose>
          <p>
            <code>name</code> supplies a path such as <code>contacts.0</code> to
            each renderer. Append individual field names and pass the provided
            disabled/readOnly state to controls. Values are submitted by those
            controls; the component does not serialize arbitrary values. Dot
            paths are ordinary FormData keys and can be parsed by your
            application.
          </p>
          <p>
            <code>min</code>, <code>max</code> and <code>required</code>{" "}
            validate the number of groups on native submission. <code>max</code>{" "}
            also caps additions. The message shows at a submit or{" "}
            <code>reportValidity()</code>, which focus the group - not at{" "}
            <code>checkValidity()</code>. Until then a count out of range marks
            the group with <code>data-invalid</code> only, and{" "}
            <code>aria-invalid</code> comes with the message. Reset restores
            uncontrolled defaults; controlled rows use <code>value</code> and{" "}
            <code>onChange</code>. A controlled parent may decline a change -
            the rows and the focus stay as they are, and the next change builds
            on <code>value</code>. A disabled fieldset disables nested controls
            and adding, removing or reordering. Read-only groups keep their
            fields and omit the actions.
          </p>
        </Prose>
      </Section>
      <Section title="Props">
        <PropsTable of="RepeatableField" />
        <PropsTable of="RepeatableFieldItem" />
        <PropsTable of="RepeatableFieldItemProps" />
      </Section>
    </DocPage>
  );
}
