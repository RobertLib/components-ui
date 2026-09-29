import { useState } from "react";
import { DataTable, DescriptionList, Dialog } from "components-ui";
import { people, type Person } from "../../mocks/data";
import { personColumns } from "./columns";

const columns = personColumns.slice(0, 5);

// A click on a row - or Enter on it, the arrow keys move between the rows -
// opens its details; a click on its checkbox only selects it.
export default function RowClick() {
  const [person, setPerson] = useState<Person | null>(null);

  return (
    <>
      <DataTable
        aria-label="People with details"
        clientSide
        columns={columns}
        data={people}
        defaultQuery={{ pageSize: 5 }}
        maxHeight="360px"
        onRowClick={setPerson}
        selectionMode="multiple"
      />
      <Dialog
        onClose={() => setPerson(null)}
        open={person !== null}
        size="md"
        title={person?.name}
      >
        {person && (
          <DescriptionList
            items={[
              { desc: person.email, term: "Email" },
              { desc: person.department, term: "Department" },
              { desc: person.city, term: "City" },
            ]}
          />
        )}
      </Dialog>
    </>
  );
}
