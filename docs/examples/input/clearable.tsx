import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "components-ui";

export default function Clearable() {
  const [search, setSearch] = useState("invoice 2026");

  return (
    <div className="max-w-md space-y-4">
      <Input
        aria-label="Search"
        clearable
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search…"
        prefix={<Search size={16} />}
        type="search"
        value={search}
      />
      <p className="text-sm">
        Searching for: <code>{JSON.stringify(search)}</code>
      </p>
      <Input
        clearable
        defaultValue="Nováková"
        description="Uncontrolled - the field clears itself."
        label="Last name"
      />
    </div>
  );
}
