import { useState } from "react";
import {
  Button,
  CZ_MASKS,
  Input,
  parseBirthNumber,
  useCzValidators,
  useFormatDate,
} from "components-ui";

export default function CzechFields() {
  // Checks with the messages of the locale - "Zadejte platné IČO."
  const cz = useCzValidators();
  const formatDate = useFormatDate();
  const [birthDate, setBirthDate] = useState<string>();
  const [submitted, setSubmitted] = useState<Record<string, string>>();

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <form
        className="grid gap-4"
        onReset={() => {
          setBirthDate(undefined);
          setSubmitted(undefined);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(
            Object.fromEntries(new FormData(event.currentTarget)) as Record<
              string,
              string
            >,
          );
        }}
      >
        <Input
          {...CZ_MASKS.ico}
          description="E.g. 45274649."
          label="Company ID (IČO)"
          name="ico"
          required
          validate={cz.ico}
        />
        <Input
          {...CZ_MASKS.dic}
          description="CZ and the IČO, or the birth number of a person."
          label="VAT ID (DIČ)"
          name="dic"
          validate={cz.dic}
        />
        <Input
          {...CZ_MASKS.birthNumber}
          description={
            birthDate
              ? `Born ${formatDate(birthDate)}.`
              : "E.g. 780123/4562, or 9 digits before 1954."
          }
          label="Birth number"
          name="birthNumber"
          // The date of birth is in the number - e.g. to fill in a DatePicker
          onMaskChange={(value) =>
            setBirthDate(parseBirthNumber(value.formatted)?.birthDate)
          }
          validate={cz.birthNumber}
        />
        <Input
          {...CZ_MASKS.postalCode}
          label="Postal code"
          name="zip"
          validate={cz.postalCode}
        />
        {/* No mask - the prefix and the number vary in length */}
        <Input
          description="E.g. 19-2000145399/0800."
          label="Account number"
          name="account"
          validate={cz.bankAccount}
        />
        <Input {...CZ_MASKS.iban} label="IBAN" name="iban" validate={cz.iban} />
        <div className="flex gap-2">
          <Button type="submit">Submit</Button>
          <Button type="reset" variant="outline">
            Reset
          </Button>
        </div>
      </form>
      <pre className="h-fit overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {submitted
          ? JSON.stringify(submitted, null, 2)
          : "Submit the form to see its FormData"}
      </pre>
    </div>
  );
}
