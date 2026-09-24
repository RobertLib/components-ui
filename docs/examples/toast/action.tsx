import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { IconButton, useSnackbar } from "components-ui";

const initialFiles = ["contract.pdf", "invoice-2026-0042.pdf", "offer.docx"];

export default function Action() {
  const [files, setFiles] = useState(initialFiles);
  const listRef = useRef<HTMLUListElement>(null);
  const { enqueueSnackbar } = useSnackbar();

  const remove = (file: string) => {
    const index = files.indexOf(file);
    setFiles((current) => current.filter((other) => other !== file));
    // The focused button goes with its row - the list keeps the focus
    listRef.current?.focus();
    enqueueSnackbar(`${file} was deleted`, "default", {
      action: {
        label: "Undo",
        onClick: () => setFiles((current) => current.toSpliced(index, 0, file)),
      },
    });
  };

  return (
    <ul
      aria-label="Attachments"
      className="max-w-sm divide-y divide-neutral-200 rounded focus:outline-none dark:divide-neutral-800"
      ref={listRef}
      tabIndex={-1}
    >
      {files.map((file) => (
        <li className="flex items-center justify-between py-2" key={file}>
          <span className="text-sm">{file}</span>
          <IconButton
            aria-label={`Delete ${file}`}
            onClick={() => remove(file)}
          >
            <Trash2 size={16} />
          </IconButton>
        </li>
      ))}
      {files.length === 0 && (
        <li className="py-2 text-sm text-neutral-500 dark:text-neutral-400">
          No files
        </li>
      )}
    </ul>
  );
}
