import { useState } from "react";
import {
  Autocomplete,
  Checkbox,
  CheckboxGroup,
  DateRangePicker,
  DateTimePicker,
  FormGrid,
  Input,
  NumberInput,
  PhoneInput,
  RadioGroup,
  SegmentedControl,
  Select,
  Slider,
  Switch,
  TagsInput,
  Textarea,
} from "components-ui";

const departments = [
  { label: "Production", value: "production" },
  { label: "Logistics", value: "logistics" },
  { label: "Sales", value: "sales" },
];

// Each label in a column of its own beside the field - its description and
// error under the field. A narrow form (a phone) puts them above again.
export default function LabelsBeside() {
  const [readOnly, setReadOnly] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <Switch
        checked={readOnly}
        label="Read-only"
        onChange={(event) => setReadOnly(event.target.checked)}
      />
      <FormGrid labelPosition="start" labelWidth="11rem" readOnly={readOnly}>
        <Input
          defaultValue="Jana Dvořáková"
          description="As in the employment contract."
          label="Name"
          name="name"
          required
        />
        <Input
          error="The address is used by another employee."
          label="E-mail"
          name="email"
          type="email"
        />
        <PhoneInput
          defaultCountry="CZ"
          defaultValue="+420603123456"
          label="Phone"
          name="phone"
        />
        <Select
          defaultValue="logistics"
          label="Department"
          name="department"
          options={departments}
        />
        <Autocomplete
          label="Manager"
          name="manager"
          options={[
            { label: "Petr Novák", value: "novak" },
            { label: "Eva Svobodová", value: "svobodova" },
          ]}
        />
        <DateTimePicker defaultValue="2024-02-01" label="Since" name="since" />
        <DateRangePicker label="Holiday" name="holiday" />
        <NumberInput
          defaultValue={52000}
          formatOptions={{ currency: "CZK", style: "currency" }}
          label="Salary"
          name="salary"
        />
        <TagsInput defaultValue={["forklift", "ADR"]} label="Licences" />
        <SegmentedControl
          defaultValue="full"
          label="Contract"
          name="contract"
          options={[
            { label: "Full-time", value: "full" },
            { label: "Part-time", value: "part" },
          ]}
        />
        <RadioGroup
          defaultValue="morning"
          label="Shift"
          name="shift"
          options={[
            { label: "Morning", value: "morning" },
            { label: "Afternoon", value: "afternoon" },
            { label: "Night", value: "night" },
          ]}
        />
        <CheckboxGroup
          defaultValue={["meal"]}
          label="Benefits"
          name="benefits"
          options={[
            { label: "Meal vouchers", value: "meal" },
            { label: "Multisport card", value: "sport" },
          ]}
        />
        <Slider defaultValue={80} label="Workload (%)" name="workload" />
        <Textarea label="Note" name="note" />
        <Switch defaultChecked label="Active" name="active" />
        <Checkbox label="Works from home" name="remote" />
      </FormGrid>
    </div>
  );
}
