import { useState } from "react";
import { Button, SystemBanner } from "components-ui";

const STORAGE_KEY = "demo-banner-maintenance-2026-11-08";

export default function Dismissible() {
  // Only to show the banner again in this demo
  const [round, setRound] = useState(0);

  return (
    <div className="space-y-3">
      {/* Remembered closed under its key - also after a reload */}
      <SystemBanner
        dismissible
        key={round}
        storageKey={STORAGE_KEY}
        title="Maintenance window"
        variant="warning"
      >
        Saturday 8 November, 22:00–24:00.
      </SystemBanner>
      <Button
        onClick={() => {
          localStorage.removeItem(STORAGE_KEY);
          setRound((value) => value + 1);
        }}
        size="sm"
        variant="outline"
      >
        Show the banner again
      </Button>
    </div>
  );
}
