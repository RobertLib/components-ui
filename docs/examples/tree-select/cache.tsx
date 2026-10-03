import { Button, TreeSelect, type TreeItem } from "components-ui";
import { useState } from "react";

const items: TreeItem<string>[] = [
  { id: "folder", label: "Documents", hasChildren: true },
];

export default function Cache() {
  const [revision, setRevision] = useState(1);
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Button
        onClick={() => setRevision((value) => value + 1)}
        variant="outline"
      >
        Refresh options
      </Button>
      <TreeSelect
        items={items}
        label="Document"
        loadChildren={async (_item, { signal }) => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          signal.throwIfAborted();
          return [{ id: "report", label: `Report, revision ${revision}` }];
        }}
        loadChildrenKey={revision}
        onChange={setValue}
        value={value}
      />
    </div>
  );
}
