import DocPage, { Prose, Section } from "../../components/doc-page";
import Example from "../../components/example";
import PropsTable from "../../components/props-table";
export default function PhoneInputPage() {
  return (
    <DocPage
      imports={["PhoneInput", "PHONE_COUNTRIES", "type PhoneCountry"]}
      title="PhoneInput"
    >
      <Example
        name="phone-input/basic"
        title="Country and international number"
        description={
          <p>
            The picker uses localized country names. National input receives the
            selected calling prefix; an international value beginning with + or
            00 can select its country. With <code>name</code>, the form submits
            one normalized value such as +420777123456. Changing the country
            retains the national digits. Spaces and parentheses in the calling
            prefix are accepted too, including in <code>value</code> and{" "}
            <code>defaultValue</code>.
          </p>
        }
      />
      <Example
        name="phone-input/states"
        title="Controlled, read-only and disabled"
        description={
          <p>
            <code>onChange</code> receives the normalized value and its country,
            possible length and structural validity. Use <code>value</code> /{" "}
            <code>country</code> to control either state; native form reset
            restores uncontrolled defaults.
          </p>
        }
      />
      <Section title="Country lists and validation">
        <Prose>
          <p>
            <code>PHONE_COUNTRIES</code> contains 43 common regions. Supply{" "}
            <code>countries</code> as ISO region codes with calling prefixes to
            restrict or extend the picker. Countries sharing a prefix retain the
            selected region. The component uses no phone-number database.
          </p>
          <p>
            Validation checks 7–15 international digits, a nonzero first digit
            and the selected calling prefix. It does not verify allocation or
            national numbering rules. National trunk prefixes stay as typed;
            users should enter the number without that prefix or paste its
            international form. Set <code>validate=false</code> for application
            validation; <code>required</code> still applies.
          </p>
        </Prose>
      </Section>
      <Section title="Props">
        <PropsTable of="PhoneInput" />
        <PropsTable of="PhoneCountry" />
        <PropsTable of="PhoneInputValue" />
      </Section>
    </DocPage>
  );
}
