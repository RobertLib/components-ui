import { Input, SegmentedControl } from "components-ui";

const statuses = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Paid", value: "paid" },
  { disabled: true, label: "Archived", value: "archived" },
];

const dims = ["xs", "sm", "md", "lg"] as const;

export default function Sizes() {
  return (
    <div className="space-y-3">
      {/* As high as an Input of the same dim - side by side in a toolbar */}
      {dims.map((dim) => (
        <div className="flex flex-wrap items-center gap-2" key={dim}>
          <SegmentedControl
            aria-label={`Status (${dim})`}
            defaultValue="open"
            dim={dim}
            options={statuses}
          />
          <div className="w-40">
            <Input aria-label={`Search (${dim})`} dim={dim} placeholder={dim} />
          </div>
        </div>
      ))}
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
      <SegmentedControl
        aria-label="Status (read-only)"
        defaultValue="paid"
        name="status"
        options={statuses}
        readOnly
      />
    </div>
  );
}
