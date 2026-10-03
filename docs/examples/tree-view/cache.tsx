import { Button, TreeView, type TreeItem } from "components-ui";
import { useState } from "react";

const items: TreeItem[] = [
  { id: "folder", label: "Documents", hasChildren: true },
];

export default function Cache() {
  const [revision, setRevision] = useState(1);
  const [error, setError] = useState("");
  return (
    <div className="space-y-3">
      <Button
        onClick={() => {
          setRevision((value) => value + 1);
          setError("");
        }}
        variant="outline"
      >
        Refresh children
      </Button>
      <TreeView
        aria-label="Documents"
        defaultExpanded={["folder"]}
        items={items}
        loadChildren={async (_item, { signal }) => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          signal.throwIfAborted();
          return [{ id: "report", label: `Report, revision ${revision}` }];
        }}
        loadChildrenKey={revision}
        onLoadError={() => setError("The documents could not be loaded.")}
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
