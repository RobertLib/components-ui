import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
} from "lucide-react";
import { IconButton, Tooltip } from "components-ui";

const tools = [
  { icon: Bold, label: "Bold" },
  { icon: Italic, label: "Italic" },
  { icon: Underline, label: "Underline" },
  { icon: AlignLeft, label: "Align left" },
  { icon: AlignCenter, label: "Center" },
  { icon: AlignRight, label: "Align right" },
];

export default function Toolbar() {
  return (
    <div
      aria-label="Formatting"
      className="inline-flex gap-1 rounded-md border border-neutral-200 p-1 dark:border-neutral-800"
      role="toolbar"
    >
      {tools.map(({ icon: Icon, label }) => (
        // The first one waits 700 ms - the next ones show at once
        <Tooltip delay={700} key={label} position="bottom" title={label}>
          <IconButton aria-label={label}>
            <Icon size={16} />
          </IconButton>
        </Tooltip>
      ))}
    </div>
  );
}
