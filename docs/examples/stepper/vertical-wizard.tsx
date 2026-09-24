import { useState } from "react";
import { Button, Input, Stepper, type StepperStep } from "components-ui";

const emptyOrder = { city: "", customer: "", street: "" };

export default function VerticalWizard() {
  const [index, setIndex] = useState(0);
  // Only the current step is rendered - the values live here
  const [order, setOrder] = useState(emptyOrder);

  const field = (name: keyof typeof order, label: string) => (
    <Input
      label={label}
      name={name}
      onChange={(event) => setOrder({ ...order, [name]: event.target.value })}
      value={order[name]}
    />
  );

  const buttons = (next: string) => (
    <div className="mt-4 flex gap-2">
      {index > 0 && (
        <Button onClick={() => setIndex(index - 1)} size="sm" variant="outline">
          Back
        </Button>
      )}
      <Button onClick={() => setIndex(index + 1)} size="sm">
        {next}
      </Button>
    </div>
  );

  const steps: StepperStep[] = [
    {
      content: (
        <>
          {field("customer", "Customer")}
          {buttons("Next")}
        </>
      ),
      description: "Who orders",
      id: "customer",
      title: "Customer",
    },
    {
      content: (
        <div className="space-y-3">
          {field("street", "Street")}
          {field("city", "City")}
          {buttons("Next")}
        </div>
      ),
      description: "Where it goes",
      id: "address",
      title: "Delivery address",
    },
    {
      content: (
        <>
          <p className="text-sm">
            {order.customer || "-"}, {order.street || "-"}, {order.city || "-"}
          </p>
          {buttons("Place order")}
        </>
      ),
      description: "Check the order",
      id: "review",
      title: "Review",
    },
    {
      content: (
        <Button
          onClick={() => {
            setOrder(emptyOrder);
            setIndex(0);
          }}
          size="sm"
          variant="outline"
        >
          New order
        </Button>
      ),
      description: "The order was placed",
      id: "done",
      title: "Done",
    },
  ];

  return (
    <div className="max-w-md">
      <Stepper
        currentStepId={steps[index].id}
        onStepClick={(id) =>
          setIndex(steps.findIndex((step) => step.id === id))
        }
        orientation="vertical"
        steps={steps.map((step, stepIndex) => ({
          ...step,
          // Back to the steps already done - not after the order was placed
          isClickable: stepIndex <= index && index < steps.length - 1,
          isCompleted: stepIndex < index || index === steps.length - 1,
        }))}
      />
    </div>
  );
}
