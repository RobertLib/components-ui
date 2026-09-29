import { Badge } from "components-ui";

export default function Counts() {
  return (
    <div className="space-y-4">
      {/* On their own, after a text - e.g. in a menu */}
      <ul className="w-56 space-y-1 text-sm">
        <li className="flex items-center justify-between">
          Inbox <Badge color="primary" count={12} label="12 unread" />
        </li>
        <li className="flex items-center justify-between">
          Alerts <Badge count={240} label="240 alerts" />
        </li>
        <li className="flex items-center justify-between">
          Drafts <Badge color="neutral" count={0} showZero />
        </li>
        <li className="flex items-center justify-between">
          Updates <Badge color="success" dot label="New updates" />
        </li>
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        {(
          [
            "primary",
            "secondary",
            "success",
            "danger",
            "warning",
            "info",
            "neutral",
          ] as const
        ).map((color) => (
          <Badge color={color} count={8} key={color} />
        ))}
        <Badge count={1000} max={999} size="sm" />
      </div>
    </div>
  );
}
