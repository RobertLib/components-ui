import { useState } from "react";
import {
  Autocomplete,
  Button,
  Checkbox,
  DateTimePicker,
  Input,
  RadioGroup,
  Select,
  Switch,
} from "components-ui";

// No state at all: every field has a `name`, the browser validates
// `required`, and FormData collects the values on submit
export default function FormDataExample() {
  const [submitted, setSubmitted] = useState<Record<string, string[]>>();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const values: Record<string, string[]> = {};
          for (const [key, value] of data) {
            (values[key] ??= []).push(String(value));
          }
          setSubmitted(values);
        }}
      >
        <Input label="Name" name="name" required />
        <Select
          hasEmpty
          label="Department"
          name="department"
          options={[
            { label: "Engineering", value: "engineering" },
            { label: "Sales", value: "sales" },
          ]}
        />
        <Autocomplete
          label="Skills"
          multiple
          name="skills"
          options={[
            { label: "React", value: "react" },
            { label: "TypeScript", value: "typescript" },
            { label: "GraphQL", value: "graphql" },
          ]}
          required
        />
        <DateTimePicker
          label="Start date"
          name="startDate"
          required
          type="date"
        />
        <RadioGroup
          defaultValue="full-time"
          label="Contract"
          name="contract"
          options={[
            { label: "Full-time", value: "full-time" },
            { label: "Part-time", value: "part-time" },
          ]}
        />
        <Switch label="Remote" name="remote" value="yes" />
        <Checkbox
          label="I agree to the processing of personal data"
          name="consent"
          required
        />
        <Button type="submit">Submit</Button>
      </form>
      <pre className="h-fit overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        {submitted
          ? JSON.stringify(submitted, null, 2)
          : "Submit the form to see its FormData"}
      </pre>
    </div>
  );
}
