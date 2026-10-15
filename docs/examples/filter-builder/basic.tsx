import { useState } from "react";
import {
  describeFilter,
  FilterBuilder,
  useLocale,
  type FilterField,
  type FilterGroup,
} from "components-ui";

// A field of each type - each offers its own operators and value field.
// Defined once, outside the component.
const fields: FilterField[] = [
  {
    key: "number",
    label: "Invoice number",
    placeholder: "FV-2026-…",
    type: "text",
  },
  { key: "customer", label: "Customer", type: "text" },
  { key: "total", label: "Total (CZK)", type: "number" },
  { key: "issuedOn", label: "Issued on", type: "date" },
  { key: "paidAt", label: "Paid at", type: "datetime" },
  {
    key: "status",
    label: "Status",
    options: [
      { label: "Draft", value: "draft" },
      { label: "Sent", value: "sent" },
      { label: "Paid", value: "paid" },
      { label: "Overdue", value: "overdue" },
      { label: "Cancelled", value: "cancelled" },
    ],
    type: "select",
  },
  {
    key: "tags",
    label: "Tags",
    options: [
      { label: "Export", value: "export" },
      { label: "Recurring", value: "recurring" },
      { label: "Priority", value: "priority" },
    ],
    type: "multiSelect",
  },
  { key: "reverseCharge", label: "Reverse charge", type: "boolean" },
];

const initialFilter: FilterGroup = {
  combinator: "and",
  conditions: [
    { field: "status", operator: "in", value: ["sent", "overdue"] },
    { field: "total", operator: "greaterThanOrEqual", value: 10_000 },
  ],
};

// An uncontrolled builder - `onChange` keeps a copy for the summary
export default function Basic() {
  const locale = useLocale();
  const [filter, setFilter] = useState(initialFilter);

  return (
    <div className="space-y-4">
      <FilterBuilder
        defaultValue={initialFilter}
        fields={fields}
        label="Invoices where"
        onChange={setFilter}
      />
      <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
        <strong className="font-medium">Summary: </strong>
        {describeFilter(filter, fields, locale) || "all invoices"}
      </p>
    </div>
  );
}
