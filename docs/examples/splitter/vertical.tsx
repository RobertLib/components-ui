import { Splitter } from "components-ui";
import { people } from "../../mocks/data";

const rows = people.filter((person) => person.city === "Prague").slice(0, 12);

export default function Vertical() {
  return (
    <Splitter
      className="h-[380px] rounded-lg border border-neutral-200 dark:border-neutral-800"
      defaultSizes={[35, 65]}
      minSizes={[15, 25]}
      orientation="vertical"
      paneLabels={["Query"]}
    >
      <textarea
        aria-label="SQL query"
        className="block h-full w-full resize-none bg-transparent p-3 font-mono text-sm focus:outline-none"
        defaultValue={
          "SELECT name, department, role\nFROM people\nWHERE city = 'Prague'\nORDER BY name;"
        }
        spellCheck={false}
      />
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-neutral-50 text-xs text-neutral-500 uppercase dark:bg-neutral-900 dark:text-neutral-400">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Department</th>
            <th className="px-3 py-2">Role</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {rows.map((person) => (
            <tr key={person.id}>
              <td className="px-3 py-1.5">{person.name}</td>
              <td className="px-3 py-1.5">{person.department}</td>
              <td className="px-3 py-1.5">{person.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Splitter>
  );
}
