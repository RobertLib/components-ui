import { Button, Popover } from "components-ui";

export default function Basic() {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <Popover
        contentClassName="p-3 text-sm"
        position="bottom"
        trigger={<Button variant="outline">Hover me</Button>}
      >
        Opens on hover, closes when the pointer leaves.
      </Popover>
      <Popover
        // The Button is the trigger itself - no button wrapped around it
        buttonTrigger
        contentClassName="p-3 text-sm"
        position="bottom"
        trigger={<Button variant="outline">Click me</Button>}
        triggerType="click"
        width="260px"
      >
        Opens on click, Enter or Space - closes on a click outside, on Escape or
        when the focus leaves.
      </Popover>
    </div>
  );
}
