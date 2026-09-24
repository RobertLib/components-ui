import { Chip, useIsMobile, useMediaQuery } from "components-ui";

// Resize the window or switch the dark mode of your system
export default function MediaQuery() {
  const queries = [
    ["useIsMobile()", useIsMobile()],
    ['"(min-width: 1280px)"', useMediaQuery("(min-width: 1280px)")],
    [
      '"(prefers-color-scheme: dark)"',
      useMediaQuery("(prefers-color-scheme: dark)"),
    ],
    [
      '"(prefers-reduced-motion: reduce)"',
      useMediaQuery("(prefers-reduced-motion: reduce)"),
    ],
  ] as const;

  return (
    <ul className="space-y-2 text-sm">
      {queries.map(([query, matches]) => (
        <li
          className="flex flex-wrap items-center justify-between gap-2"
          key={query}
        >
          <code className="break-all">{query}</code>
          <Chip color={matches ? "success" : "neutral"}>
            {matches ? "matches" : "does not match"}
          </Chip>
        </li>
      ))}
    </ul>
  );
}
