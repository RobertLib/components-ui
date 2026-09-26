import { DataTable, DescriptionList, type Column } from "components-ui";
import { createPeople, type Person } from "../../mocks/data";
import { personColumns } from "./columns";

// 10 000 rows in the browser, one scrolling list - only the rows in view are
// rendered. Selection, expanded rows of any height, sorting, the search and
// the pinned name keep working.
const manyPeople = createPeople(10_000);

const columns: Column<Person>[] = personColumns.map((column) =>
  column.key === "name" ? { ...column, pinned: "left" } : column,
);

export default function Virtualized() {
  return (
    <DataTable
      aria-label="10 000 people"
      clientSide
      columns={columns}
      data={manyPeople}
      enableGlobalSearch
      groupActions={[{ label: "Archive", onClick: () => {} }]}
      maxHeight="520px"
      pagination={false}
      renderSubRow={(person) => (
        <DescriptionList
          items={[
            { desc: person.email, term: "Email" },
            { desc: person.city, term: "City" },
            { desc: person.role, term: "Role" },
          ]}
        />
      )}
      virtualized
    />
  );
}
