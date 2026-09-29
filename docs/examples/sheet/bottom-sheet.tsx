import { Copy, Link, Mail, Share2 } from "lucide-react";
import { useState } from "react";
import { Button, Sheet, useSnackbar } from "components-ui";

const actions = [
  { icon: Link, label: "Copy link" },
  { icon: Mail, label: "Send by e-mail" },
  { icon: Copy, label: "Duplicate" },
];

export default function BottomSheet() {
  const [open, setOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        <Share2 aria-hidden="true" size={16} /> Share
      </Button>
      <Sheet
        closeOnBackdropClick
        onClose={() => setOpen(false)}
        open={open}
        side="bottom"
        size="sm"
        title="Share the report"
      >
        <ul className="-mx-2 space-y-1">
          {actions.map(({ icon: Icon, label }) => (
            <li key={label}>
              <button
                className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-start text-sm hover:bg-neutral-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-800"
                onClick={() => {
                  setOpen(false);
                  enqueueSnackbar(label, "success");
                }}
                type="button"
              >
                <Icon aria-hidden="true" size={18} />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
