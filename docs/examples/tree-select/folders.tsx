import { Folder } from "lucide-react";
import { TreeSelect, type TreeItem } from "components-ui";

const folder = (path: string, label: string): TreeItem<string> => ({
  hasChildren: true,
  icon: <Folder size={16} />,
  id: path,
  label,
});

const root = [
  folder("/contracts", "Contracts"),
  folder("/invoices", "Invoices"),
  folder("/projects", "Projects"),
];

// A stand-in for an API call
async function loadFolder(item: TreeItem<string>) {
  await new Promise((resolve) => setTimeout(resolve, 600));

  return ["2024", "2025", "2026"].map((year) =>
    folder(`${item.id}/${year}`, year),
  );
}

export default function Folders() {
  return (
    <div className="max-w-sm">
      <TreeSelect
        description="The subfolders load as a folder is expanded - once."
        items={root}
        label="Save to"
        loadChildren={loadFolder}
        placeholder="Choose a folder"
        showPath
      />
    </div>
  );
}
