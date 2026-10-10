import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function TransferListPage() {
  return (
    <DocPage
      imports={[
        "TransferList",
        "type TransferListOption",
        "type TransferListValue",
      ]}
      title="TransferList"
    >
      <Example
        name="transfer-list/basic"
        title="Assign project members"
        description={
          <p>
            Check choices in either list, then move the checked items. The
            double arrows move all visible items. Each list has its own search;
            searches ignore case, accents and the spaces around the term, and
            preserve choices hidden by the search. Disabled options stay in
            their current list.
          </p>
        }
      />
      <Section title="Values and forms">
        <Prose>
          <p>
            <code>value</code> and <code>onChange</code> control the selected
            values. Otherwise, <code>defaultValue</code> applies until the first
            transfer and again after a form reset. Values are strings or
            numbers; <code>1</code> and <code>"1"</code> are distinct. Selected
            values missing from the options stay visible and can be removed.
          </p>
          <p>
            <code>name</code> submits one hidden input per selected value,
            including locked selections; an empty list submits an empty value.{" "}
            <code>form</code> connects to a form outside the component.{" "}
            <code>required</code>, <code>min</code> and <code>max</code>{" "}
            validate the selected count. A submit shows an error and focuses the
            field when the minimum is not met - a <code>checkValidity()</code>{" "}
            of the page only reports it. Additions stop at the maximum.
          </p>
          <p>
            <code>disabled</code> prevents interaction, submission and
            validation, including inside a disabled fieldset.{" "}
            <code>readOnly</code> prevents transfers and validation while
            retaining submitted values. Native checkboxes, labeled lists and
            buttons support keyboard and screen-reader navigation.
          </p>
        </Prose>
      </Section>
      <Section title="Props">
        <PropsTable of="TransferList" />
        <PropsTable of="TransferListOption" />
      </Section>
    </DocPage>
  );
}
