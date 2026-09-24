import { Copy, FileText, FolderInput, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ContextMenu, useSnackbar } from "components-ui";

const folders = ["Invoices", "Contracts", "Archive"];

export default function FileList() {
  const [files, setFiles] = useState([
    "Invoice 2026-041.pdf",
    "Contract Acme.docx",
    "Price list 2026.xlsx",
  ]);
  const { enqueueSnackbar } = useSnackbar();

  return (
    <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {files.map((file) => (
        <ContextMenu
          aria-label={`Actions for ${file}`}
          items={[
            {
              icon: <Pencil size={16} />,
              label: "Rename",
              onClick: () => enqueueSnackbar(`Renaming ${file}`),
              shortcut: "f2",
            },
            {
              icon: <Copy size={16} />,
              label: "Duplicate",
              onClick: () =>
                setFiles((current) => [...current, `Copy of ${file}`]),
              shortcut: "mod+d",
            },
            {
              icon: <FolderInput size={16} />,
              items: folders.map((folder) => ({
                label: folder,
                onClick: () => enqueueSnackbar(`Moved to ${folder}`, "success"),
              })),
              label: "Move to",
            },
            { type: "separator" },
            {
              danger: true,
              icon: <Trash2 size={16} />,
              label: "Delete",
              onClick: () =>
                setFiles((current) => current.filter((name) => name !== file)),
              shortcut: "delete",
            },
          ]}
          key={file}
        >
          {/* Focusable, so Shift + F10 or the context menu key open the menu */}
          <li
            className="flex cursor-default items-center gap-3 px-4 py-2.5 text-sm outline-none first:rounded-t-md last:rounded-b-md hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-neutral-900"
            tabIndex={0}
          >
            <FileText className="shrink-0 text-neutral-400" size={18} />
            <span className="truncate">{file}</span>
          </li>
        </ContextMenu>
      ))}
    </ul>
  );
}
