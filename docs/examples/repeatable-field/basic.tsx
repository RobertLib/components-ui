import { Button, Input, RepeatableField } from "components-ui";
import { useState } from "react";
export default function Basic() {
  const [saved, setSaved] = useState("");
  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(
          JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
        );
      }}
    >
      <RepeatableField
        label="Contacts"
        name="contacts"
        min={1}
        max={4}
        defaultValue={[
          { id: "primary", value: { name: "Adam", email: "adam@example.com" } },
        ]}
        createItem={() => ({ name: "", email: "" })}
        renderItem={(item) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Name"
              name={`${item.name}.name`}
              dim={item.dim}
              disabled={item.disabled}
              readOnly={item.readOnly}
              required
              value={item.value.name}
              onChange={(event) =>
                item.onChange({ ...item.value, name: event.target.value })
              }
            />
            <Input
              label="Email"
              name={`${item.name}.email`}
              type="email"
              dim={item.dim}
              disabled={item.disabled}
              readOnly={item.readOnly}
              value={item.value.email}
              onChange={(event) =>
                item.onChange({ ...item.value, email: event.target.value })
              }
            />
          </div>
        )}
      />
      <div className="flex gap-2">
        <Button type="submit">Save contacts</Button>
        <Button type="reset" variant="outline">
          Reset
        </Button>
      </div>
      <output className="block text-sm break-all">{saved}</output>
    </form>
  );
}
