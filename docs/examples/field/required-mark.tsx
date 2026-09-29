import { Field, Input, RequiredMark, Select } from "components-ui";

const countries = [
  { label: "Czechia", value: "cz" },
  { label: "Slovakia", value: "sk" },
];

export default function RequiredMarks() {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <div className="grid gap-4">
        <Input label="Name" required />
        <Select label="Country" options={countries} required />
        {/* A label laid out by hand */}
        <div>
          <span className="text-sm font-medium">
            Terms: <RequiredMark />
          </span>
        </div>
      </div>

      {/* A form that marks its optional fields instead */}
      <form className="grid gap-4" data-required-mark="hidden">
        <Input label="Name" required />
        <Field label="Note (optional)">
          {(controlProps) => (
            <textarea {...controlProps} className="form-control px-2 py-1" />
          )}
        </Field>
      </form>
    </div>
  );
}
