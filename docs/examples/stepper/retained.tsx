import { Button, Input, Stepper } from "components-ui";
import { useState } from "react";
export default function Retained() {
  const [step, setStep] = useState<string | number>("details");
  const [saved, setSaved] = useState("");
  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(String(new FormData(event.currentTarget).get("name")));
      }}
    >
      <Stepper
        currentStepId={step}
        onStepClick={setStep}
        keepMounted
        orientation="responsive"
        steps={[
          {
            id: "details",
            title: "Details",
            content: (
              <Input label="Name" name="name" defaultValue="Adam" required />
            ),
          },
          {
            id: "documents",
            title: "Documents",
            content: <Input label="Attachment" name="attachment" type="file" />,
          },
          {
            id: "review",
            title: "Review",
            content: (
              <p className="text-sm">
                All fields remain part of this form, including hidden steps.
              </p>
            ),
          },
        ]}
      />
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button type="reset" variant="outline">
          Reset fields
        </Button>
      </div>
      <output>{saved}</output>
    </form>
  );
}
