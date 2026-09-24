import { useRef, useState } from "react";
import {
  Dialog,
  Input,
  Kbd,
  useDisclosure,
  useHotkeys,
  useSnackbar,
} from "components-ui";

const shortcuts = [
  { description: "New task", shortcut: "n" },
  { description: "Save the tasks", shortcut: "mod+s" },
  { description: "Keyboard shortcuts", shortcut: "?" },
];

export default function Hotkeys() {
  const [tasks, setTasks] = useState(["Send the offer to Acme"]);
  const inputRef = useRef<HTMLInputElement>(null);
  const help = useDisclosure();
  const { enqueueSnackbar } = useSnackbar();

  useHotkeys([
    ["n", () => inputRef.current?.focus()],
    // Ctrl / ⌘ + S also saves while typing a task
    [
      "mod+s",
      () => enqueueSnackbar("Tasks saved", "success"),
      { allowInFields: true },
    ],
    ["?", help.onOpen],
  ]);

  return (
    <div className="max-w-md space-y-3">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Press <Kbd>N</Kbd> for a new task, <Kbd shortcut="mod+s" /> to save,{" "}
        <Kbd>?</Kbd> for help.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const input = inputRef.current;
          if (!input?.value) return;
          setTasks((current) => [...current, input.value]);
          input.value = "";
        }}
      >
        <Input label="New task" ref={inputRef} />
      </form>
      <ul className="list-inside list-disc text-sm">
        {tasks.map((task, index) => (
          <li key={index}>{task}</li>
        ))}
      </ul>
      <Dialog
        onClose={help.onClose}
        open={help.open}
        title="Keyboard shortcuts"
      >
        <dl className="space-y-2 text-sm">
          {shortcuts.map(({ description, shortcut }) => (
            <div className="flex items-center justify-between" key={shortcut}>
              <dt>{description}</dt>
              <dd>
                <Kbd shortcut={shortcut} />
              </dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}
