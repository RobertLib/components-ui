import { useState } from "react";
import { Button, Tabs } from "components-ui";

const files = ["index.ts", "button.tsx", "styles.css", "README.md"];

export default function Closable() {
  const [open, setOpen] = useState(files);
  const [active, setActive] = useState(files[0]);

  return (
    <div className="space-y-3">
      <Tabs
        aria-label="Open files"
        items={open.map((file) => ({
          content: (
            <pre className="rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
              {`// ${file}`}
            </pre>
          ),
          label: file,
          // The × and the Delete key call it - the tab after it takes the
          // selection and the focus
          onClose: () =>
            setOpen((current) => current.filter((name) => name !== file)),
          value: file,
        }))}
        onChange={setActive}
        size="sm"
        value={active}
      />
      {open.length < files.length && (
        <Button
          onClick={() => {
            setOpen(files);
            if (!open.includes(active)) setActive(files[0]);
          }}
          size="sm"
          variant="outline"
        >
          Open all files again
        </Button>
      )}
    </div>
  );
}
