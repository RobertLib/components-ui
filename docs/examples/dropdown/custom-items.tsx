import { ChevronDown } from "lucide-react";
import { Avatar, Dropdown, useSnackbar } from "components-ui";

export default function CustomItems() {
  const { enqueueSnackbar } = useSnackbar();
  const isAdmin = true;

  return (
    <Dropdown
      items={[
        // Any element is rendered as it is - a header, a divider, …
        <div
          className="px-4 py-2 text-xs text-neutral-500 dark:text-neutral-400"
          key="header"
        >
          Signed in as <strong>jana@example.com</strong>
        </div>,
        { href: "/components/avatar", label: "Profile (link)" },
        // `false` / `null` entries are skipped
        isAdmin && { href: "/components/data-table", label: "Administration" },
        <hr
          className="my-1 border-neutral-200 dark:border-neutral-800"
          key="divider"
        />,
        { label: "Log out", onClick: () => enqueueSnackbar("Logged out") },
      ]}
      trigger={
        <span className="flex items-center gap-2 text-sm">
          <Avatar alt="" name="Jana Nováková" />
          Jana Nováková
          <ChevronDown size={14} />
        </span>
      }
    />
  );
}
