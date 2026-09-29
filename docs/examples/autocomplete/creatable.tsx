import { useState } from "react";
import { Autocomplete, type AutocompleteOption } from "components-ui";

const initialLabels: AutocompleteOption[] = [
  { label: "Bug", value: "bug" },
  { label: "Feature", value: "feature" },
  { label: "Documentation", value: "documentation" },
];

// Pretends to save the label on a server - "urgent" is refused
async function saveLabel(name: string): Promise<AutocompleteOption> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  if (name.toLowerCase() === "urgent") {
    throw new Error("“Urgent” is reserved - pick another name.");
  }

  return { label: name, value: name.toLowerCase().replace(/\s+/g, "-") };
}

export default function Creatable() {
  const [labels, setLabels] = useState(initialLabels);

  return (
    <div className="max-w-md">
      <Autocomplete
        defaultValue={["bug"]}
        description="Type a label the list does not have - try “Urgent” too."
        label="Labels"
        multiple
        name="labels"
        onCreate={async (name) => {
          const label = await saveLabel(name);
          // Offered from now on, also once it is removed again
          setLabels((current) => [...current, label]);
          return label;
        }}
        options={labels}
        placeholder="Add a label…"
      />
    </div>
  );
}
