import { Autocomplete } from "components-ui";
import { createPeople } from "../../mocks/data";

// 10,000 static options - only the ones in view are rendered
const people = createPeople(10_000).map((person) => ({
  group: person.department,
  label: `${person.name} (#${person.id})`,
  value: person.id,
}));

export default function Virtualized() {
  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <Autocomplete
        label="Employee"
        name="employee"
        options={people}
        placeholder="Type a name…"
        virtualized
      />
      <Autocomplete
        asSelect
        defaultValue={7777}
        label="Employee (select)"
        options={people}
        virtualized
      />
    </div>
  );
}
