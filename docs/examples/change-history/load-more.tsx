import { useState } from "react";
import {
  ChangeHistory,
  Switch,
  type ChangeHistoryAuthor,
  type ChangeHistoryEntry,
} from "components-ui";

const authors: (ChangeHistoryAuthor | null)[] = [
  { id: 1, name: "Jana Nováková" },
  { id: 2, name: "Petr Svoboda" },
  null, // the system
  { id: 3, name: "Lucie Králová" },
];
const statuses = ["New", "In progress", "Waiting for customer", "Resolved"];
const priorities = ["Low", "Normal", "High"];
const now = Date.now();

// Entry `index` of the history of a support ticket - 6 hours apart, the
// newest first
function createEntry(index: number): ChangeHistoryEntry {
  const author = authors[index % authors.length];
  return {
    action: "updated",
    author,
    changes:
      index % 3 === 0
        ? [
            {
              field: "priority",
              from: priorities[index % 3],
              to: priorities[(index + 1) % 3],
            },
          ]
        : [
            {
              field: "status",
              from: statuses[(index + 1) % 4],
              to: statuses[index % 4],
            },
            ...(author
              ? [{ field: "assignee", from: null, to: author.name }]
              : []),
          ],
    id: index,
    time: new Date(now - (index * 6 + 1) * 3_600_000),
  };
}

const PAGE_SIZE = 6;
const TOTAL = 24;
const page = (start: number) =>
  Array.from({ length: PAGE_SIZE }, (_, offset) => createEntry(start + offset));

// The fetch of the next page of older entries
const fetchOlder = (start: number) =>
  new Promise<ChangeHistoryEntry[]>((resolve) =>
    setTimeout(() => resolve(page(start)), 800),
  );

export default function LoadMore() {
  const [entries, setEntries] = useState(() => page(0));
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Switch
          checked={loading}
          label="Loading"
          onChange={(event) => setLoading(event.target.checked)}
        />
        <Switch
          checked={empty}
          label="No changes"
          onChange={(event) => setEmpty(event.target.checked)}
        />
      </div>
      <ChangeHistory
        entries={empty ? [] : entries}
        fields={{
          assignee: { label: "Assignee" },
          priority: { label: "Priority" },
          status: { label: "Status" },
        }}
        filterable
        hasMore={!empty && entries.length < TOTAL}
        loading={loading}
        // Appends the older entries - the button shows loading meanwhile
        onLoadMore={() =>
          fetchOlder(entries.length).then((older) =>
            setEntries((current) => [...current, ...older]),
          )
        }
        size="sm"
      />
    </div>
  );
}
