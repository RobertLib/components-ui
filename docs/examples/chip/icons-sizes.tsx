import { CircleCheck, Clock, Truck } from "lucide-react";
import { Chip } from "components-ui";

export default function IconsSizes() {
  return (
    <div className="space-y-3">
      {/* The icon is sized to the chip, whatever size it is given */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip color="warning" icon={<Clock />} variant="outline">
          Waiting
        </Chip>
        <Chip color="info" icon={<Truck />} variant="outline">
          Shipped
        </Chip>
        <Chip color="success" icon={<CircleCheck />} variant="solid">
          Delivered
        </Chip>
        <Chip disabled icon={<Truck />}>
          Cancelled
        </Chip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip color="primary" icon={<Truck />} onRemove={() => {}} size="sm">
          Small
        </Chip>
        <Chip color="primary" icon={<Truck />} onRemove={() => {}}>
          Medium
        </Chip>
        <Chip color="primary" icon={<Truck />} onRemove={() => {}} size="lg">
          Large
        </Chip>
      </div>
    </div>
  );
}
