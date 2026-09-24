import { Flag, Rocket, Users, Wrench } from "lucide-react";
import { Timeline } from "components-ui";

// Milestones on both sides of the line - on one side on phones
export default function Alternate() {
  return (
    <Timeline
      alternate
      items={[
        {
          description: "Scope and budget approved",
          icon: <Flag />,
          time: new Date(2026, 0, 12),
          title: "Kick-off",
        },
        {
          description: "24 interviews with dispatchers",
          icon: <Users />,
          time: new Date(2026, 2, 2),
          title: "User research",
        },
        {
          description: "Two depots, 40 drivers",
          icon: <Wrench />,
          time: new Date(2026, 5, 15),
          title: "Pilot in Brno",
        },
        {
          description: "All 14 depots",
          icon: <Rocket />,
          pending: true,
          time: new Date(2026, 9, 1),
          title: "Nationwide launch",
        },
      ]}
      timeFormat={{ dateStyle: "medium" }}
    />
  );
}
