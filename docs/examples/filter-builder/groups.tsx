import { useState } from "react";
import {
  describeFilter,
  FilterBuilder,
  useLocale,
  type FilterField,
  type FilterGroup,
} from "components-ui";

// `group` lists the fields under headings in the field select
const fields: FilterField[] = [
  { group: "Invoice", key: "number", label: "Number", type: "text" },
  { group: "Invoice", key: "total", label: "Total (CZK)", type: "number" },
  { group: "Invoice", key: "dueDate", label: "Due date", type: "date" },
  {
    group: "Invoice",
    key: "status",
    label: "Status",
    options: [
      { label: "Sent", value: "sent" },
      { label: "Paid", value: "paid" },
      { label: "Overdue", value: "overdue" },
    ],
    type: "select",
  },
  { group: "Customer", key: "customer", label: "Name", type: "text" },
  {
    group: "Customer",
    key: "region",
    label: "Region",
    options: [
      { label: "Praha", value: "praha" },
      { label: "Jihomoravský", value: "jihomoravsky" },
      { label: "Moravskoslezský", value: "moravskoslezsky" },
      { label: "Plzeňský", value: "plzensky" },
    ],
    type: "select",
  },
  { group: "Customer", key: "vatPayer", label: "VAT payer", type: "boolean" },
];

// Overdue - and either large, or of a region of the collection agency
const initialFilter: FilterGroup = {
  combinator: "and",
  conditions: [
    { field: "status", operator: "equals", value: "overdue" },
    {
      combinator: "or",
      conditions: [
        { field: "total", operator: "greaterThan", value: 50_000 },
        {
          field: "region",
          operator: "in",
          value: ["praha", "jihomoravsky"],
        },
      ],
    },
  ],
};

export default function Groups() {
  const locale = useLocale();
  const [filter, setFilter] = useState(initialFilter);

  return (
    <div className="space-y-4">
      <FilterBuilder
        defaultValue={initialFilter}
        dim="sm"
        fields={fields}
        label="Send a reminder for invoices where"
        // The top group and one level of groups in it
        maxDepth={2}
        onChange={setFilter}
      />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {describeFilter(filter, fields, locale) || "All invoices"}
      </p>
    </div>
  );
}
