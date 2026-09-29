import { RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { IconButton } from "components-ui";

export default function States() {
  const [refreshing, setRefreshing] = useState(false);

  return (
    <div className="flex items-center gap-4">
      {/* The tooltip shows the name - on hover, at once on keyboard focus */}
      <IconButton
        aria-label="Refresh"
        loading={refreshing}
        onClick={() => {
          setRefreshing(true);
          setTimeout(() => setRefreshing(false), 1200);
        }}
        tooltip
      >
        <RefreshCw size={18} />
      </IconButton>
      <IconButton color="danger" disabled tooltip="Delete">
        <Trash2 size={18} />
      </IconButton>
    </div>
  );
}
