import {
  Button,
  FormActions,
  FormGridItem,
  FormSection,
  Input,
  Select,
  Textarea,
  useSnackbar,
} from "components-ui";

const countries = [
  { label: "Czechia", value: "CZ" },
  { label: "Slovakia", value: "SK" },
  { label: "Austria", value: "AT" },
];

// Two titled parts of one form - each a fieldset named by its heading,
// its fields in two columns where the form is wide enough
export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        enqueueSnackbar("Customer saved", "success");
      }}
    >
      <FormSection
        columns={2}
        description="As in the commercial register."
        title="Company"
      >
        <Input
          defaultValue="Strojírny Kovář s.r.o."
          label="Name"
          name="name"
          required
        />
        <Input
          defaultValue="27082440"
          inputMode="numeric"
          label="Company ID"
          name="companyId"
          required
        />
        <Input defaultValue="CZ27082440" label="VAT ID" name="vatId" />
        <Input
          defaultValue="fakturace@kovar.cz"
          label="Billing e-mail"
          name="email"
          type="email"
        />
      </FormSection>

      <FormSection
        actions={
          <Button size="sm" variant="outline">
            Copy from company
          </Button>
        }
        columns={2}
        title="Delivery address"
      >
        <FormGridItem span="full">
          <Input
            defaultValue="Průmyslová 1520/12"
            label="Street"
            name="street"
          />
        </FormGridItem>
        <Input defaultValue="Brno" label="City" name="city" />
        <Input defaultValue="612 00" label="Postal code" name="postalCode" />
        <Select
          defaultValue="CZ"
          label="Country"
          name="country"
          options={countries}
        />
        <FormGridItem span="full">
          <Textarea
            label="Note for the courier"
            name="courierNote"
            placeholder="Gate 3, call ahead"
          />
        </FormGridItem>
      </FormSection>

      <FormActions>
        <Button type="reset" variant="outline">
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </FormActions>
    </form>
  );
}
