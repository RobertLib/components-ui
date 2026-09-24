import {
  Archive,
  FolderInput,
  Inbox,
  Link,
  Mail,
  MoreHorizontal,
  Share2,
  Star,
} from "lucide-react";
import { Dropdown, IconButton, useSnackbar } from "components-ui";

export default function Submenus() {
  const { enqueueSnackbar } = useSnackbar();
  const moveTo = (folder: string) => () =>
    enqueueSnackbar(`Moved to ${folder}`, "success");

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="min-w-0">
        <div className="truncate font-medium">Quarterly report</div>
        <div className="truncate text-sm text-neutral-500 dark:text-neutral-400">
          Jana Nováková · 9:41
        </div>
      </div>
      <Dropdown
        buttonTrigger
        items={[
          {
            icon: <Star size={16} />,
            label: "Mark as important",
            onClick: () => enqueueSnackbar("Marked as important"),
          },
          {
            icon: <FolderInput size={16} />,
            items: [
              {
                icon: <Inbox size={16} />,
                label: "Inbox",
                onClick: moveTo("Inbox"),
              },
              {
                icon: <Archive size={16} />,
                // Submenus nest
                items: [
                  { label: "2026", onClick: moveTo("Archive 2026") },
                  { label: "2025", onClick: moveTo("Archive 2025") },
                ],
                label: "Archive",
              },
            ],
            label: "Move to",
          },
          {
            icon: <Share2 size={16} />,
            items: [
              {
                icon: <Link size={16} />,
                label: "Copy link",
                onClick: () => enqueueSnackbar("Link copied"),
              },
              {
                icon: <Mail size={16} />,
                label: "Forward",
                onClick: () => enqueueSnackbar("Forwarding…"),
              },
            ],
            label: "Share",
          },
        ]}
        trigger={
          <IconButton aria-label="Message actions">
            <MoreHorizontal size={18} />
          </IconButton>
        }
      />
    </div>
  );
}
