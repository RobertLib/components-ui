import { SegmentedControl } from "components-ui";

const statuses = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Paid", value: "paid" },
  { disabled: true, label: "Archived", value: "archived" },
];

export default function Sizes() {
  return (
    <div className="space-y-3">
      <SegmentedControl
        aria-label="Status (small)"
        defaultValue="open"
        options={statuses}
        size="sm"
      />
      <SegmentedControl
        aria-label="Status (medium)"
        defaultValue="open"
        options={statuses}
      />
      <SegmentedControl
        aria-label="Status (large)"
        defaultValue="open"
        options={statuses}
        size="lg"
      />
      <SegmentedControl
        aria-label="Status (full width)"
        defaultValue="all"
        fullWidth
        options={statuses}
      />
      <SegmentedControl
        aria-label="Status (disabled)"
        defaultValue="paid"
        disabled
        options={statuses}
      />
    </div>
  );
}
