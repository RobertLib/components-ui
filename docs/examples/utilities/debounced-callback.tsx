import { useState } from "react";
import { Textarea, useDebouncedCallback, useLocale } from "components-ui";

export default function DebouncedCallback() {
  const { code } = useLocale();
  const [note, setNote] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Saves 800 ms after the last keystroke - and right away when the field
  // is left, or the component unmounts
  const save = useDebouncedCallback(
    (_text: string) => {
      // await fetch("/api/orders/42/note", { method: "PUT", body: text });
      setSavedAt(new Date());
    },
    800,
    { flushOnUnmount: true },
  );

  return (
    <div className="max-w-md space-y-2">
      <Textarea
        label="Internal note"
        onBlur={() => save.flush()}
        onChange={(event) => {
          setNote(event.target.value);
          save(event.target.value);
        }}
        value={note}
      />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {savedAt
          ? `Saved at ${savedAt.toLocaleTimeString(code)}`
          : "Saved as you type"}
      </p>
    </div>
  );
}
