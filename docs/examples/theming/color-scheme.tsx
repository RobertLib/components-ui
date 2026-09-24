import { ColorSchemeToggle, useColorScheme } from "components-ui";

// The same choice as the switch in the navbar of these docs
export default function ColorScheme() {
  const { colorScheme, resolvedColorScheme } = useColorScheme();

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <ColorSchemeToggle />
      <ColorSchemeToggle size="sm" />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Chosen: <b>{colorScheme}</b>, shown: <b>{resolvedColorScheme}</b>
      </p>
    </div>
  );
}
