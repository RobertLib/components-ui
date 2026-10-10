import { useState } from "react";
import {
  Autocomplete,
  Button,
  DateCalendar,
  Input,
  Rating,
  RepeatableField,
  TreeSelect,
} from "../../src";

/** Required fields without a native control of their own. */
export function RequiredSelectsFixture() {
  const [saved, setSaved] = useState("");
  return (
    <form
      aria-label="Required selects"
      className="mx-auto max-w-xl space-y-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(
          JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
        );
      }}
    >
      <Autocomplete
        label="City"
        name="city"
        options={[
          { label: "Praha", value: "praha" },
          { label: "Brno", value: "brno" },
        ]}
        required
      />
      <TreeSelect
        items={[
          { id: "garden", label: "Garden" },
          { id: "books", label: "Books" },
        ]}
        label="Category"
        name="category"
        required
      />
      <Button type="submit">Save selects</Button>
      <output aria-label="Saved selects">{saved}</output>
    </form>
  );
}

/** Required fields whose focus target is not their validation input. */
export function RequiredFieldsFixture() {
  const [saved, setSaved] = useState("");
  return (
    <form
      aria-label="Required fields"
      className="mx-auto max-w-xl space-y-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(
          JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
        );
      }}
    >
      <Rating label="Score" name="score" required />
      <DateCalendar label="Pickup" name="pickup" required />
      <RepeatableField
        createItem={() => ""}
        label="Notes"
        min={1}
        name="notes"
        renderItem={(item) => (
          <Input
            label="Note"
            name={item.name}
            onChange={(event) => item.onChange(event.target.value)}
            value={item.value}
          />
        )}
      />
      <Button type="submit">Save fields</Button>
      <output aria-label="Saved fields">{saved}</output>
    </form>
  );
}
