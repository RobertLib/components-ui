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
            retains the national digits - those after the calling prefix the
            number carries, also of a country the picker does not offer; a
            number with a prefix of none of <code>PHONE_COUNTRIES</code> and{" "}
            <code>countries</code> stays as it is. Spaces and parentheses in the
            calling prefix are accepted too, including in <code>value</code> and{" "}
            <code>defaultValue</code>, as well as a (0) after it (+44 (0)20 7946
            0958), full-width digits and the invisible direction marks of a
            number copied from a chat app or the contacts.
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
            selected region; otherwise a number takes the main region of its
            prefix when it is listed - the United States for +1, Russia for +7,
            the United Kingdom for +44 - or else the first listed one. The
            component uses no phone-number database.
          </p>
          <p>
            Validation checks 7–15 international digits, a nonzero first digit
            and the selected calling prefix. It does not verify allocation or
            national numbering rules. National trunk prefixes stay as typed;
            users should enter the number without that prefix or paste its
            international form, where a (0) after the calling prefix is dropped.
            Set <code>validate=false</code> for application validation;{" "}
            <code>required</code> still applies.
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
