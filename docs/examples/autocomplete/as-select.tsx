import { Autocomplete } from "components-ui";

export default function AsSelect() {
  return (
    <div className="grid max-w-xl gap-4 sm:grid-cols-2">
      <Autocomplete
        asSelect
        hasEmpty
        label="Status"
        options={[
          { label: "Active", value: "active" },
          { label: "Invited", value: "invited" },
          { label: "Suspended", value: "suspended" },
        ]}
        placeholder="Any status"
      />
      <Autocomplete
        asSelect
        label="Channels"
        multiple
        options={[
          { label: "Email", value: "email" },
          { label: "SMS", value: "sms" },
          { label: "Push", value: "push" },
        ]}
        placeholder="Pick channels"
      />
    </div>
  );
}
