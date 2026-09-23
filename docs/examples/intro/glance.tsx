import { useState } from "react";
import {
  Autocomplete,
  Button,
  Chip,
  DateTimePicker,
  Header,
  Input,
  Panel,
  Switch,
  useSnackbar,
} from "components-ui";

export default function Glance() {
  const { enqueueSnackbar } = useSnackbar();
  const [urgent, setUrgent] = useState(false);

  return (
    <Panel border="neutral" shadow="none">
      <Header
        actions={
          <Chip color={urgent ? "danger" : "neutral"}>
            {urgent ? "Urgent" : "Normal"}
          </Chip>
        }
        className="mb-4 [&_h1]:text-xl"
        title="New task"
      />
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          enqueueSnackbar("Task created", "success");
        }}
      >
        <Input
          label="Title"
          name="title"
          placeholder="Prepare the offer"
          required
        />
        <Autocomplete
          label="Assignees"
          multiple
          name="assignees"
          options={[
            { label: "Jana Nováková", value: 1 },
            { label: "Petr Svoboda", value: 2 },
            { label: "Eliška Dvořáková", value: 3 },
          ]}
          placeholder="Pick people…"
        />
        <DateTimePicker label="Due" name="due" type="datetime-local" />
        <div className="flex items-end">
          <Switch
            checked={urgent}
            label="Urgent"
            onChange={(event) => setUrgent(event.target.checked)}
          />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit">Create task</Button>
          <Button type="reset" variant="ghost">
            Reset
          </Button>
        </div>
      </form>
    </Panel>
  );
}
