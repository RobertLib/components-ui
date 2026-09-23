import { MoreHorizontal } from "lucide-react";
import { Dropdown, useSnackbar } from "components-ui";

export default function Basic() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <Dropdown
      aria-label="Actions"
      items={[
        { label: "Edit", onClick: () => enqueueSnackbar("Edit clicked") },
        {
          label: "Duplicate",
          onClick: () => enqueueSnackbar("Duplicated", "success"),
        },
        {
          label: "Archive",
          onClick: () => enqueueSnackbar("Archived", "info"),
        },
      ]}
      trigger={<MoreHorizontal size={18} />}
    />
  );
}
