import { Kbd } from "components-ui";

export default function Basic() {
  return (
    <div className="space-y-4 text-sm">
      <p>
        Press <Kbd>Esc</Kbd> to close the dialog, or <Kbd>/</Kbd> to search.
      </p>
      <p>
        Open the command menu with <Kbd shortcut="mod+k" /> and save with{" "}
        <Kbd shortcut="mod+s" />.
      </p>
      <p className="flex flex-wrap items-center gap-3">
        <Kbd shortcut="mod+shift+p" />
        <Kbd shortcut="alt+arrowup" />
        <Kbd shortcut="ctrl+enter" size="sm" />
      </p>
    </div>
  );
}
