import { useState } from "react";
import { Stepper } from "components-ui";

const steps = [
  { description: "Email and password", id: "account", title: "Account" },
  {
    description: "A photo and a short bio",
    id: "profile",
    // "Optional" under the title - screen readers hear it with the step
    optional: true,
    title: "Profile",
  },
  {
    description: "Invite your team",
    id: "team",
    optional: true,
    title: "Team",
  },
  { description: "Start working", id: "done", title: "Done" },
];

export default function Optional() {
  const [current, setCurrent] = useState<string | number>("profile");

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Stepper
        currentStepId={current}
        onStepClick={setCurrent}
        orientation="vertical"
        steps={steps}
      />
      {/* In the row of steps it is in the tooltip */}
      <Stepper currentStepId={current} onStepClick={setCurrent} steps={steps} />
    </div>
  );
}
