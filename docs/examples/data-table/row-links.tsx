import { DataTable } from "components-ui";
import DemoRouter from "../../lib/demo-router";
import { people } from "../../mocks/data";
import { personColumns } from "./columns";

const columns = personColumns.slice(0, 4);

// Each row opens its person - the name is the link (Tab, Enter, middle and
// Ctrl + click), and a click anywhere else on the row follows it too. The
// DemoRouter stands in for your app's router (React Router, Next.js, …).
export default function RowLinks() {
  return (
    <DemoRouter initialPath="/people">
      <DataTable
        aria-label="People to open"
        clientSide
        columns={columns}
        data={people}
        defaultQuery={{ pageSize: 5 }}
        getRowHref={(person) => `/people/${person.id}`}
        maxHeight="360px"
      />
    </DemoRouter>
  );
}
