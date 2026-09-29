import { useState } from "react";
import { Input, type MaskedValue } from "components-ui";

// `#` a digit, `@` a letter, `*` a letter or a digit - the rest is written
// as it is
export default function Mask() {
  const [companyId, setCompanyId] = useState<MaskedValue>();

  return (
    <div className="grid max-w-md gap-4">
      <Input
        autoComplete="postal-code"
        description="Czech PSČ, e.g. 110 00."
        label="Postal code"
        mask="### ##"
      />
      <Input
        autoComplete="tel"
        description="Type or paste it - with or without +420."
        label="Phone"
        mask="+420 ### ### ###"
        type="tel"
      />
      <Input
        description={
          companyId?.complete
            ? `Looking up ${companyId.raw} in the business register…`
            : "IČO - 8 digits."
        }
        label="Company ID"
        mask="########"
        onMaskChange={setCompanyId}
      />
      <Input
        description="A Czech account, e.g. CZ65 0800 0000 1920 0014 5399."
        label="IBAN"
        mask="CZ## #### #### #### #### ####"
      />
      <Input
        autoComplete="cc-number"
        label="Card number"
        mask="#### #### #### ####"
      />
    </div>
  );
}
