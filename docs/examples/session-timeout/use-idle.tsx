import { useState } from "react";
import { Avatar, useFormatDate, useIdle } from "components-ui";

export default function UseIdle() {
  const [awaySince, setAwaySince] = useState<Date | null>(null);
  const formatDate = useFormatDate();
  const { idle } = useIdle(10_000, {
    onActive: () => setAwaySince(null),
    onIdle: () => setAwaySince(new Date()),
    syncKey: "docs:presence",
  });

  return (
    <div className="flex items-center gap-3">
      <Avatar
        name="Jana Dvořáková"
        size="lg"
        status={idle ? "away" : "online"}
      />
      <div className="text-sm">
        <div className="font-medium">Jana Dvořáková</div>
        <div className="text-neutral-600 dark:text-neutral-400">
          {awaySince
            ? `Away since ${formatDate(awaySince, "time")} - move the mouse`
            : "Online - wait 10 seconds without touching anything"}
        </div>
      </div>
    </div>
  );
}
