import { Stepper } from "components-ui";

// The vertical layout writes out the titles and descriptions
export default function Vertical() {
  return (
    <Stepper
      currentStepId="users"
      orientation="vertical"
      steps={[
        {
          description: "Name, VAT ID and address",
          id: "company",
          title: "Company details",
        },
        {
          description: "The IBAN is not valid",
          hasError: true,
          id: "bank",
          title: "Bank account",
        },
        {
          description: "Invite your colleagues",
          id: "users",
          title: "Users",
        },
        {
          description: "Start issuing invoices",
          id: "done",
          title: "Done",
        },
      ]}
    />
  );
}
