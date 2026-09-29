import { FileText, Folder } from "lucide-react";
import { useState } from "react";
import { TreeView, type TreeItem, type TreeMove } from "components-ui";

interface Entry extends TreeItem<string> {
  children?: Entry[];
  /** A folder takes children, a file does not. */
  folder?: boolean;
}

const folder = (id: string, label: string, children: Entry[]): Entry => ({
  children,
  folder: true,
  icon: <Folder size={16} />,
  id,
  label,
});

const file = (id: string, label: string): Entry => ({
  icon: <FileText size={16} />,
  id,
  label,
});

const initialEntries: Entry[] = [
  folder("contracts", "Contracts", [
    file("lease", "office-lease.pdf"),
    file("nda", "nda-acme.pdf"),
  ]),
  folder("invoices", "Invoices", [
    folder("2025", "2025", [file("inv-2025-12", "2025-12.pdf")]),
    folder("2026", "2026", [
      file("inv-2026-01", "2026-01.pdf"),
      file("inv-2026-02", "2026-02.pdf"),
    ]),
  ]),
  folder("drafts", "Drafts", []),
  file("readme", "readme.txt"),
];

/**
 * `entries` with the moved ones taken out and put where they were dropped -
 * they keep their ids, so the tree keeps their selection and the focus.
 */
function applyMove(
  entries: Entry[],
  { itemIds, position, targetId }: TreeMove<string>,
): Entry[] {
  const moved: Entry[] = [];

  const takeOut = (list: Entry[]): Entry[] =>
    list.flatMap((entry) => {
      if (itemIds.includes(entry.id)) {
        moved.push(entry);
        return [];
      }
      return entry.children
        ? [{ ...entry, children: takeOut(entry.children) }]
        : [entry];
    });

  const putIn = (list: Entry[]): Entry[] =>
    list.flatMap((entry) => {
      if (entry.id === targetId) {
        if (position === "before") return [...moved, entry];
        if (position === "after") return [entry, ...moved];
        // Inside - as its last children
        return [{ ...entry, children: [...(entry.children ?? []), ...moved] }];
      }
      return entry.children
        ? [{ ...entry, children: putIn(entry.children) }]
        : [entry];
    });

  const rest = takeOut(entries);
  // In the order of the move - the order of the tree
  moved.sort((a, b) => itemIds.indexOf(a.id) - itemIds.indexOf(b.id));
  return putIn(rest);
}

export default function Move() {
  const [entries, setEntries] = useState(initialEntries);
  const [lastMove, setLastMove] = useState("");

  return (
    <div className="space-y-3">
      <TreeView
        aria-label="Documents"
        // Only folders take children
        canDrop={({ position, target }) =>
          position !== "inside" || !!target.folder
        }
        className="max-w-md"
        defaultExpanded={["contracts", "invoices", "2026"]}
        items={entries}
        onMove={(move) => {
          // Save it on the server here - the tree shows what `items` say
          setEntries((current) => applyMove(current, move));
          setLastMove(
            `${move.itemIds.join(", ")} → ${move.position} ${move.targetId}`,
          );
        }}
        selectionMode="multiple"
      />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {lastMove
          ? `Moved: ${lastMove}`
          : "Drag a file or a folder - or select several first."}
      </p>
    </div>
  );
}
