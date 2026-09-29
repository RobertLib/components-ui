import { Bell } from "lucide-react";
import { useState } from "react";
import { Badge, Button, IconButton } from "components-ui";

export default function Notifications() {
  const [count, setCount] = useState(3);

  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* The count is part of the name of the button - the badge itself is
          decorative. The tooltip shows the name. */}
      <IconButton
        aria-label={
          count > 0 ? `Notifications, ${count} unread` : "Notifications"
        }
        size="md"
        tooltip
      >
        <Badge count={count} size="sm">
          <Bell aria-hidden="true" />
        </Badge>
      </IconButton>

      <div className="flex gap-2">
        <Button onClick={() => setCount(count + 1)} size="sm" variant="outline">
          New notification
        </Button>
        {/* A count of 0 shrinks the badge away */}
        <Button onClick={() => setCount(0)} size="sm" variant="outline">
          Mark all read
        </Button>
      </div>
    </div>
  );
}
