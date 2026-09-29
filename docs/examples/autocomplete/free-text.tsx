import { useState } from "react";
import { Autocomplete, type AutocompleteValue } from "components-ui";
import { cities } from "./cities";

export default function FreeText() {
  const [value, setValue] = useState<AutocompleteValue | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <form
      className="max-w-sm space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(String(new FormData(event.currentTarget).get("city")));
      }}
    >
      <Autocomplete
        allowCustomValue
        description="Pick a city, or type one the list does not have and press Enter."
        label="Destination"
        name="city"
        onChange={setValue}
        options={cities}
        placeholder="Any city…"
      />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Value: <code>{JSON.stringify(value)}</code>
        {submitted !== null && (
          <>
            {" "}
            · submitted: <code>{JSON.stringify(submitted)}</code>
          </>
        )}
      </p>
    </form>
  );
}
