import { Stepper } from "components-ui";

// Without icons the steps show their numbers; hasError marks a failed step
export default function Numbers() {
  return (
    <div className="max-w-md">
      <Stepper
        currentStepId={3}
        steps={[
          { id: 1, title: "Details" },
          { hasError: true, id: 2, title: "Documents - a file is missing" },
          { id: 3, title: "Review" },
          { id: 4, title: "Done" },
        ]}
      />
    </div>
  );
}
