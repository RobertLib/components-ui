import { FileText, Folder } from "lucide-react";
import { TreeView, type TreeItem } from "components-ui";

const folder = (path: string, label: string): TreeItem<string> => ({
  hasChildren: true,
  icon: <Folder size={16} />,
  id: path,
  label,
});

const file = (path: string, label: string): TreeItem<string> => ({
  icon: <FileText size={16} />,
  id: path,
  label,
});

const root = [
  folder("/contracts", "Contracts"),
  folder("/invoices", "Invoices"),
  folder("/archive", "Archive"),
  file("/readme.txt", "readme.txt"),
];

let archiveAttempts = 0;

// A stand-in for an API call - the archive fails the first time
async function loadFolder(item: TreeItem<string>) {
  await new Promise((resolve) => setTimeout(resolve, 700));

  if (item.id === "/archive" && archiveAttempts++ === 0) {
    throw new Error("The server did not answer");
  }

  return [
    folder(`${item.id}/2025`, "2025"),
    folder(`${item.id}/2026`, "2026"),
    file(`${item.id}/summary.pdf`, "summary.pdf"),
    file(`${item.id}/notes.docx`, "notes.docx"),
  ];
}

export default function Files() {
  return (
    <TreeView
      aria-label="Documents"
      items={root}
      loadChildren={loadFolder}
      selectionMode="none"
    />
  );
}
