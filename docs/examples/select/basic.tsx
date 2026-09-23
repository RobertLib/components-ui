import { useState } from "react";
import { Select } from "components-ui";

const departments = [
  { label: "Engineering", value: "engineering" },
  { label: "Marketing", value: "marketing" },
  { label: "Sales", value: "sales" },
];

export default function Basic() {
  const [department, setDepartment] = useState("");

  return (
    <div className="grid max-w-md gap-4">
      <Select
        hasEmpty
        label="Department"
        onChange={(event) => setDepartment(event.target.value)}
        options={departments}
        value={department}
      />
      <p className="text-sm">
        Selected: <code>{JSON.stringify(department)}</code>
      </p>
      <Select
        defaultValue={2}
        dim="sm"
        label="Priority (numeric values, small)"
        options={[
          { label: "Low", value: 1 },
          { label: "Normal", value: 2 },
          { label: "High", value: 3 },
        ]}
      />
      <Select
        error="Choose a department."
        hasEmpty
        label="With an error"
        options={departments}
        required
      />
    </div>
  );
}
