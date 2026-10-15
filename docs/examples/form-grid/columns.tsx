import {
  DateTimePicker,
  FormGrid,
  FormGridItem,
  Input,
  NumberInput,
  Select,
  Textarea,
} from "components-ui";

const units = [
  { label: "pcs", value: "pcs" },
  { label: "hours", value: "h" },
  { label: "kg", value: "kg" },
];

// Three columns where the form is wide enough, fewer as it narrows, one on
// a phone - resize the window or open the page on a phone
export default function Columns() {
  return (
    <FormGrid columns={3}>
      <FormGridItem span={2}>
        <Input
          defaultValue="Servis CNC frézky DMU 50"
          label="Item"
          name="item"
        />
      </FormGridItem>
      <Input defaultValue="ZAK-2026-118" label="Order" name="order" />
      <NumberInput defaultValue={6} label="Quantity" min={0} name="quantity" />
      <Select defaultValue="h" label="Unit" name="unit" options={units} />
      <NumberInput
        defaultValue={1450}
        formatOptions={{ currency: "CZK", style: "currency" }}
        label="Unit price"
        name="unitPrice"
      />
      <DateTimePicker defaultValue="2026-10-20" label="From" name="from" />
      <DateTimePicker defaultValue="2026-10-22" label="To" name="to" />
      <FormGridItem span="full">
        <Textarea label="Description" name="description" />
      </FormGridItem>
    </FormGrid>
  );
}
