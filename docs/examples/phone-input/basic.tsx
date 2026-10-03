import { Button, PhoneInput } from "components-ui";
import { useState } from "react";
export default function Basic() {
  const [saved, setSaved] = useState("");
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(String(new FormData(event.currentTarget).get("phone")));
      }}
    >
      <PhoneInput
        countries={[
          { code: "CZ", callingCode: "420" },
          { code: "SK", callingCode: "421" },
          { code: "DE", callingCode: "49" },
          { code: "GB", callingCode: "44" },
        ]}
        defaultCountry="CZ"
        defaultValue="+420777123456"
        description="Enter national digits or paste an international number."
        label="Phone"
        name="phone"
        required
        clearable
      />
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button type="reset" variant="outline">
          Reset
        </Button>
      </div>
      <output>{saved}</output>
    </form>
  );
}
