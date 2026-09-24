import { RadioGroup } from "components-ui";

export default function Options() {
  return (
    <div className="max-w-md">
      <RadioGroup
        defaultValue="standard"
        description="Prices include VAT."
        label="Shipping"
        name="shipping"
        options={[
          {
            description: "2 - 3 business days, free",
            label: "Standard",
            value: "standard",
          },
          {
            description: "Next business day, 149 Kč",
            label: "Express",
            value: "express",
          },
          {
            description: "Not available for oversized goods",
            disabled: true,
            label: "Pickup point",
            value: "pickup",
          },
        ]}
      />
    </div>
  );
}
