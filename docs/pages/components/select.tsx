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
      <Example
        description={
          <p>
            <code>prefix</code> and <code>suffix</code> go inside the border of
            the field, as with <code>Input</code> - a caption of a filter or a
            sort in place of a label above it, or an icon. A click on them opens
            the list. Screen readers do not tie them to the field: name it with
            a <code>label</code> or an <code>aria-label</code>.
          </p>
        }
        name="select/prefix"
        title="Prefix and suffix"
      />
      <Example
        description={
          <p>
            A native select has no <code>readonly</code> - <code>readOnly</code>{" "}
            makes one: the list stays closed at a click or a touch, the keys
            that open it or change the value (the arrows, Space, Enter, typed
            letters) do nothing, and a change assistive technology makes is
            taken back. Unlike a <code>disabled</code> select it keeps the focus
            and is submitted with its form; like a read-only input it is not
            checked by <code>required</code> - the user could not fix it. It is{" "}
            <code>aria-readonly</code>, has <code>data-readonly</code> for your
            styles and shows no arrow. The <code>label</code> takes content, as
            that of <code>Input</code>.
          </p>
        }
        name="select/read-only"
        title="Read-only"
      />
      <Example
        description={
          <p>
            The arrow, and the room the text leaves for it, are at the end of
            the field - on the left in a right-to-left page. A multiple select
            is a list box and shows no arrow.
          </p>
        }
        name="select/rtl"
        title="Right to left"
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
