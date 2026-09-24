import { FileUp, ListChecks, Table } from "lucide-react";
import { useState } from "react";
import { Button, Stepper, type StepperStep } from "components-ui";

const steps: StepperStep[] = [
  {
    description: "A CSV or XLSX file",
    icon: FileUp,
    id: "upload",
    title: "Upload",
  },
  {
    description: "Which column is which",
    icon: Table,
    id: "columns",
    title: "Map columns",
  },
  {
    description: "Check and import",
    icon: ListChecks,
    id: "import",
    title: "Import",
  },
];

// A row with the content under it - a column on phones (narrow the window)
export default function Responsive() {
  const [index, setIndex] = useState(0);
  const isLast = index === steps.length - 1;

  return (
    <Stepper
      className="max-w-xl"
      currentStepId={steps[index].id}
      orientation="responsive"
      steps={steps.map((step) => ({
        ...step,
        content: (
          <div className="rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <p className="mb-3">
              <strong>{step.title}</strong> - {step.description}.
            </p>
            <div className="flex gap-2">
              <Button
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
                size="sm"
                variant="outline"
              >
                Back
              </Button>
              <Button
                onClick={() => setIndex(isLast ? 0 : index + 1)}
                size="sm"
              >
                {isLast ? "Import 248 rows" : "Next"}
              </Button>
            </div>
          </div>
        ),
      }))}
    />
  );
}
