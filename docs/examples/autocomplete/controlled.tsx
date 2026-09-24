import { useState } from "react";
import { Autocomplete, Button, type AutocompleteValue } from "components-ui";
import { cities } from "./cities";

export default function Controlled() {
  const [city, setCity] = useState<AutocompleteValue | null>("praha");

  return (
    <div className="max-w-sm space-y-3">
      <Autocomplete
        label="City"
        onChange={(value) => setCity(value)}
        options={cities}
        value={city}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>
          Value: <code>{JSON.stringify(city)}</code>
        </span>
        <Button onClick={() => setCity("wien")} size="sm" variant="outline">
          Set Wien
        </Button>
        <Button onClick={() => setCity(null)} size="sm" variant="outline">
          Clear
        </Button>
      </div>
    </div>
  );
}
