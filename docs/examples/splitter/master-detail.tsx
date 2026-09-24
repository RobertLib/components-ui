import { useState } from "react";
import { cn, DescriptionList, Splitter } from "components-ui";
import { people } from "../../mocks/data";

const team = people.slice(0, 30);

export default function MasterDetail() {
  const [selectedId, setSelectedId] = useState(team[0].id);
  const person = team.find((member) => member.id === selectedId) ?? team[0];

  return (
    <Splitter
      className="h-[420px] rounded-lg border border-neutral-200 dark:border-neutral-800"
      collapsible={[true, false]}
      defaultSizes={[35, 65]}
      minSizes={[20, 40]}
      paneLabels={["People"]}
      storageKey="docs-people-split"
    >
      {/* Stacked on phones - the list keeps a height of its own there */}
      <ul
        aria-label="People"
        className="space-y-0.5 p-1 max-md:max-h-72 max-md:overflow-y-auto"
      >
        {team.map((member) => (
          <li key={member.id}>
            <button
              aria-current={member.id === selectedId || undefined}
              className={cn(
                "w-full rounded-md px-3 py-1.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                member.id === selectedId
                  ? "bg-primary-50 text-primary-800 dark:bg-primary-950/60 dark:text-primary-200"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
              )}
              onClick={() => setSelectedId(member.id)}
              type="button"
            >
              <span className="block font-medium">{member.name}</span>
              <span className="block text-xs text-neutral-600 dark:text-neutral-400">
                {member.department}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="p-4">
        <h3 className="mb-3 text-lg font-semibold">{person.name}</h3>
        <DescriptionList
          items={[
            { desc: person.email, term: "Email" },
            { desc: person.department, term: "Department" },
            { desc: person.role, term: "Role" },
            { desc: person.city, term: "City" },
          ]}
        />
      </div>
    </Splitter>
  );
}
