import { useState } from "react";
import { Field } from "components-ui";

// Stands for a control of another library - it takes the props of an input
function PhoneInput({
  onValueChange,
  ...props
}: Omit<React.ComponentProps<"input">, "onChange"> & {
  onValueChange: (value: string) => void;
}) {
  return (
    <input
      {...props}
      autoComplete="tel"
      className="form-control px-2 py-1"
      onChange={(event) =>
        // Digits in groups of three: +420 123 456 789
        onValueChange(
          event.target.value
            .replace(/[^\d+]/g, "")
            .replace(/(\d{3})(?=\d)/g, "$1 "),
        )
      }
      type="tel"
    />
  );
}

export default function Basic() {
  const [phone, setPhone] = useState("+420 ");
  const [touched, setTouched] = useState(false);
  const complete = phone.replace(/\D/g, "").length === 12;

  return (
    <div className="max-w-md">
      <Field
        description="With the country code, e.g. +420."
        // Checked once the user leaves the field
        error={touched && !complete ? "Enter 12 digits." : undefined}
        label="Phone"
        required
      >
        {(controlProps) => (
          <PhoneInput
            {...controlProps}
            onBlur={() => setTouched(true)}
            onValueChange={setPhone}
            required
            value={phone}
          />
        )}
      </Field>
    </div>
  );
}
