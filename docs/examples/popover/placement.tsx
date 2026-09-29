import { useState } from "react";
import {
  Button,
  Checkbox,
  Popover,
  SegmentedControl,
  type PopoverAlign,
  type PopoverPosition,
} from "components-ui";

const positions: PopoverPosition[] = ["top", "bottom", "start", "end"];
const aligns: PopoverAlign[] = ["start", "center", "end"];

export default function Placement() {
  const [position, setPosition] = useState<PopoverPosition>("bottom");
  const [align, setAlign] = useState<PopoverAlign>("center");
  const [arrow, setArrow] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <SegmentedControl
          label="Position"
          onChange={setPosition}
          options={positions.map((value) => ({ label: value, value }))}
          value={position}
        />
        <SegmentedControl
          label="Align"
          onChange={setAlign}
          options={aligns.map((value) => ({ label: value, value }))}
          value={align}
        />
        <Checkbox
          checked={arrow}
          label="Arrow"
          onChange={(event) => setArrow(event.target.checked)}
        />
      </div>

      <div className="flex justify-center py-16">
        <Popover
          align={align}
          arrow={arrow}
          buttonTrigger
          contentClassName="p-3 text-sm"
          offset={10}
          position={position}
          trigger={<Button variant="outline">Open the panel</Button>}
          triggerType="click"
          width="220px"
        >
          <p>
            On the <strong>{position}</strong> side, aligned to its{" "}
            <strong>{align}</strong>. Without room there it flips - the arrow
            goes along.
          </p>
        </Popover>
      </div>
    </div>
  );
}
