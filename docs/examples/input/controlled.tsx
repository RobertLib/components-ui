import { useState } from "react";
import { Button, Input } from "components-ui";

export default function Controlled() {
  const [name, setName] = useState("Jana");

  return (
    <div className="max-w-md space-y-3">
      <Input
        label="Name"
        onChange={(event) => setName(event.target.value)}
        value={name}
      />
      <div className="flex items-center gap-3 text-sm">
        <span>
          Value: <code>{JSON.stringify(name)}</code>
        </span>
        <Button onClick={() => setName("")} size="sm" variant="outline">
          Clear
        </Button>
      </div>
    </div>
  );
}
