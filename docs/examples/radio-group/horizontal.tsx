import { RadioGroup } from "components-ui";

export default function Horizontal() {
  return (
    <RadioGroup
      defaultValue="monthly"
      label="Billing period"
      name="period"
      options={[
        { label: "Monthly", value: "monthly" },
        { label: "Quarterly", value: "quarterly" },
        { label: "Yearly (2 months free)", value: "yearly" },
      ]}
      orientation="horizontal"
    />
  );
}
