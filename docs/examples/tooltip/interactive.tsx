import { Info } from "lucide-react";
import { Tooltip } from "components-ui";

export default function Interactive() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <Tooltip
        openOnClick
        position="top"
        title="Also opens on tap - for touch screens"
      >
        <span className="flex items-center gap-1 text-sm">
          Click or hover <Info size={14} />
        </span>
      </Tooltip>
      <Tooltip
        delay={200}
        interactive
        position="bottom"
        title={
          <ul className="max-h-32 overflow-y-auto">
            {Array.from({ length: 12 }, (_, index) => (
              <li key={index}>Participant {index + 1}</li>
            ))}
          </ul>
        }
      >
        <span className="text-sm underline decoration-dotted">
          12 participants (scrollable)
        </span>
      </Tooltip>
    </div>
  );
}
