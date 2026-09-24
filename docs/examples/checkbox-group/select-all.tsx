import { CheckboxGroup } from "components-ui";

const columns = [
  { label: "Invoice number", value: "number" },
  { label: "Customer", value: "customer" },
  { label: "Issue date", value: "issued" },
  { label: "Due date", value: "due" },
  { label: "Amount", value: "amount" },
  {
    description: "Needs the Accounting role",
    disabled: true,
    label: "Internal notes",
    value: "notes",
  },
];

export default function SelectAll() {
  return (
    <div className="max-w-sm">
      <CheckboxGroup
        defaultValue={["number", "customer", "amount"]}
        label="Columns to export"
        name="columns"
        options={columns}
        required
        selectAll="All columns"
      />
    </div>
  );
}
