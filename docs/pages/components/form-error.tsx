import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";

export default function FormErrorPage() {
  return (
    <DocPage imports={["FormError"]} title="FormError">
      <Example name="form-error/basic" title="Basic" />

      <Section title="Notes">
        <Prose>
          <p>
            All fields render it for their <code>error</code> prop. Use it on
            its own for errors that belong to no single field, e.g. the{" "}
            <code>getBaseError()</code> of a server response.
          </p>
        </Prose>
      </Section>

      <Section title="Props">
        <PropsTable of="FormError" />
      </Section>
    </DocPage>
  );
}
