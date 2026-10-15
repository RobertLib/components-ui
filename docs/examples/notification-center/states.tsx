import { useState } from "react";
import {
  NotificationCenter,
  SegmentedControl,
  type NotificationItem,
} from "components-ui";

type State = "loading" | "error" | "empty" | "loaded";

const notifications: NotificationItem[] = [
  {
    id: 1,
    time: Date.now() - 2 * 60 * 60_000,
    title: "Your password expires in 7 days",
  },
];

export default function States() {
  const [state, setState] = useState<State>("loading");

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <SegmentedControl<State>
        aria-label="State"
        onChange={setState}
        options={[
          { label: "Loading", value: "loading" },
          { label: "Error", value: "error" },
          { label: "Empty", value: "empty" },
          { label: "Loaded", value: "loaded" },
        ]}
        size="sm"
        value={state}
      />
      <NotificationCenter
        error={state === "error"}
        loading={state === "loading"}
        notifications={state === "loaded" ? notifications : []}
        onRetry={() => setState("loaded")}
      />
    </div>
  );
}
