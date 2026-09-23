import { Button, Tooltip } from "components-ui";

export default function Positions() {
  return (
    <div className="flex flex-wrap gap-4 py-6">
      {(["top", "right", "bottom", "left"] as const).map((position) => (
        <Tooltip
          delay={200}
          key={position}
          position={position}
          title={`On the ${position}`}
        >
          <Button variant="outline">{position}</Button>
        </Tooltip>
      ))}
    </div>
  );
}
