import { CreditCard, Package, ShoppingCart, Truck } from "lucide-react";
import { useState } from "react";
import { Button, Stepper, type StepperStep } from "components-ui";

const steps: StepperStep[] = [
  { icon: ShoppingCart, id: "cart", title: "Cart" },
  { icon: Truck, id: "shipping", title: "Shipping" },
  { icon: CreditCard, id: "payment", title: "Payment" },
  { icon: Package, id: "summary", title: "Summary" },
];

export default function Wizard() {
  const [index, setIndex] = useState(1);

  return (
    <div className="max-w-xl">
      <Stepper
        currentStepId={steps[index].id}
        onStepClick={(id) =>
          setIndex(steps.findIndex((step) => step.id === id))
        }
        steps={steps.map((step, stepIndex) => ({
          ...step,
          // Only the steps already visited can be clicked
          isClickable: stepIndex <= index,
        }))}
      />
      <p className="mb-4 text-sm">
        Step {index + 1} of {steps.length}:{" "}
        <strong>{steps[index].title}</strong>
      </p>
      <div className="flex gap-2">
        <Button
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
          variant="outline"
        >
          Back
        </Button>
        <Button
          disabled={index === steps.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
