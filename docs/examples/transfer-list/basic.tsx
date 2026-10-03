import { Button, TransferList, type TransferListValue } from "components-ui";
import { useState } from "react";

const options = [
  { value: "anna", label: "Anna Nováková", description: "Engineering" },
  { value: "adam", label: "Adam Svoboda", description: "Design" },
  { value: "eva", label: "Eva Dvořáková", description: "Support" },
  { value: "petr", label: "Petr Černý", description: "Marketing" },
  {
    value: "system",
    label: "System administrator",
    description: "Required member",
    disabled: true,
  },
];

export default function Basic() {
  const [submitted, setSubmitted] = useState<TransferListValue[]>([]);
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(
          new FormData(event.currentTarget).getAll("members") as string[],
        );
      }}
    >
      <TransferList
        defaultValue={["system"]}
        description="Assign at least two members; at most four can be selected."
        label="Project members"
        max={4}
        min={2}
        name="members"
        options={options}
      />
      <div className="flex gap-2">
        <Button type="submit">Save members</Button>
        <Button type="reset" variant="outline">
          Reset
        </Button>
      </div>
      <output className="block text-sm">
        Saved: {submitted.join(", ") || "—"}
      </output>
    </form>
  );
}
