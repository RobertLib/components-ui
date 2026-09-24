import { useState } from "react";
import {
  Autocomplete,
  type AutocompleteValue,
  type LoadOptionsParams,
} from "components-ui";

const departments = ["Engineering", "Finance", "Marketing", "Sales", "Support"];

export default function Dependent() {
  const [department, setDepartment] = useState("Engineering");
  const [personId, setPersonId] = useState<AutocompleteValue | null>(null);

  const loadPeople = async ({
    offset,
    pageSize,
    search,
    signal,
  }: LoadOptionsParams) => {
    const params = new URLSearchParams({
      department,
      limit: String(pageSize),
      offset: String(offset),
      q: search,
    });
    const response = await fetch(`/api/people?${params}`, { signal });
    return (await response.json()) as {
      items: { id: number; name: string }[];
      total: number;
    };
  };

  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <Autocomplete
        asSelect
        label="Department"
        onChange={(value) => {
          setDepartment(String(value));
          // The person may not belong to the new department
          setPersonId(null);
        }}
        options={departments.map((name) => ({ label: name, value: name }))}
        value={department}
      />
      <Autocomplete
        label={`Person in ${department}`}
        loadOptions={loadPeople}
        // Reloads the list when the department changes
        loadOptionsDeps={[department]}
        onChange={(value) => setPersonId(value)}
        value={personId}
      />
    </div>
  );
}
