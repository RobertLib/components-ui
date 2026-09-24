import { FormDescription, FormError } from "components-ui";

// The pieces of a field by hand - the ids tie them to the control
export default function Description() {
  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor="vat-id">
        VAT ID
      </label>
      <input
        aria-describedby="vat-id-error vat-id-description"
        aria-invalid="true"
        className="form-control border-danger-500! px-2 py-1"
        defaultValue="CZ123"
        id="vat-id"
      />
      <FormDescription id="vat-id-description">
        The country code followed by 8 to 10 digits.
      </FormDescription>
      <FormError id="vat-id-error">This VAT ID is too short.</FormError>
    </div>
  );
}
